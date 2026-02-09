import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { copyFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { getDb } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { searchGames, getGameByRawgId } from "./rawg.js";
import { checkAchievements, unlockAchievement, getAchievementProgress, revokeAchievementsIfNeeded, ACHIEVEMENTS } from "./achievements.js";
import { sendPushToUser, isPushConfigured } from "./push.js";
import { startBackupCron } from "./backupCron.js";

const app = express();
const PORT = process.env.PORT || 3001;
const RAWG_API_KEY = process.env.RAWG_API_KEY || "";

const corsOrigin = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
	: true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

let db;
let broadcastToUser = () => {};

function getOrCreateGame(rawgGame) {
	const row = db.prepare("SELECT id FROM games WHERE rawg_id = ?").get(rawgGame.rawg_id);
	if (row) return row.id;
	db.prepare(
		`INSERT INTO games (rawg_id, name, released, image_url, genres, platforms, metacritic, raw_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		rawgGame.rawg_id,
		rawgGame.name,
		rawgGame.released,
		rawgGame.image_url,
		JSON.stringify(rawgGame.genres || []),
		JSON.stringify(rawgGame.platforms || []),
		rawgGame.metacritic ?? null,
		JSON.stringify(rawgGame)
	);
	return db.prepare("SELECT last_insert_rowid() as id").get().id;
}

app.get("/api/access", (req, res) => {
	const r = db.prepare(
		"SELECT COUNT(DISTINCT user_id) as c FROM user_achievements WHERE achievement_id = ?"
	).get("quien_eres");
	const registrationClosed = (r?.c ?? 0) >= 2;
	res.json({ registrationClosed });
});

app.get("/api/users", (req, res) => {
	const users = db.prepare("SELECT id, name, slug FROM users ORDER BY name").all();
	res.json(users);
});

app.get("/api/users/:slug", (req, res) => {
	const user = db.prepare("SELECT id, name, slug, bio, avatar FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	res.json(user);
});

app.get("/api/users/:slug/perfil", (req, res) => {
	const user = db.prepare("SELECT id, name, slug, bio, avatar FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const jugados = db
		.prepare(
			`SELECT up.rating, up.opinion, up.played_at, up.completed, g.id as game_id, g.rawg_id, g.name, g.released, g.image_url, g.genres, g.metacritic
			 FROM user_played up
			 JOIN games g ON g.id = up.game_id
			 WHERE up.user_id = ?
			 ORDER BY up.rating DESC, up.played_at DESC`
		)
		.all(user.id)
		.map((r) => ({
			...r,
			completed: r.completed === 1,
			genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres,
		}));

	const pendientes = db
		.prepare(
			`SELECT up.added_at, g.id as game_id, g.rawg_id, g.name, g.released, g.image_url, g.genres
			 FROM user_pending up
			 JOIN games g ON g.id = up.game_id
			 WHERE up.user_id = ?
			 ORDER BY up.added_at DESC`
		)
		.all(user.id)
		.map((r) => ({
			...r,
			genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres,
		}));

	res.json({ user, jugados, pendientes });
});

const MAX_AVATAR_LENGTH = 300000;

app.patch("/api/users/:slug/profile", (req, res) => {
	const row = db.prepare("SELECT id, bio, avatar FROM users WHERE slug = ?").get(req.params.slug);
	if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
	const { bio, avatar } = req.body;
	if (avatar != null && typeof avatar === "string" && avatar.length > MAX_AVATAR_LENGTH) {
		return res.status(400).json({ error: "Imagen de perfil demasiado grande" });
	}
	const newBio = req.body.hasOwnProperty("bio") ? bio : row.bio;
	const newAvatar = req.body.hasOwnProperty("avatar") ? avatar : row.avatar;
	db.prepare("UPDATE users SET bio = ?, avatar = ? WHERE id = ?").run(newBio ?? null, newAvatar ?? null, row.id);
	const updated = db.prepare("SELECT id, name, slug, bio, avatar FROM users WHERE id = ?").get(row.id);
	res.json(updated);
});

app.get("/api/users/:slug/conversation", (req, res) => {
	const me = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!me) return res.status(404).json({ error: "Usuario no encontrado" });
	const otherSlug = req.query.with;
	if (!otherSlug) return res.status(400).json({ error: "Falta with=slug" });
	const other = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(otherSlug);
	if (!other) return res.status(404).json({ error: "Otro usuario no encontrado" });
	const rows = db
		.prepare(
			`SELECT m.id, m.body, m.game_id, m.created_at, u.name as from_name, u.slug as from_slug
			 FROM messages m
			 JOIN users u ON u.id = m.from_user_id
			 WHERE (m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?)
			 ORDER BY m.created_at ASC`
		)
		.all(me.id, other.id, other.id, me.id);
	const games = {};
	rows.forEach((r) => {
		if (r.game_id && !games[r.game_id]) {
			const g = db.prepare("SELECT id, rawg_id, name, released, image_url FROM games WHERE id = ?").get(r.game_id);
			if (g) games[r.game_id] = g;
		}
	});
	const messages = rows.map((r) => ({
		id: r.id,
		body: r.body,
		game_id: r.game_id ?? undefined,
		game: r.game_id ? games[r.game_id] : undefined,
		created_at: r.created_at,
		from: { name: r.from_name, slug: r.from_slug },
	}));
	res.json({ messages, other });
});

app.post("/api/users/:slug/messages", async (req, res) => {
	const me = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(req.params.slug);
	if (!me) return res.status(404).json({ error: "Usuario no encontrado" });
	const { to_slug, body, game_id: bodyGameId, rawg_id } = req.body;
	if (!to_slug || typeof body !== "string" || !body.trim()) {
		return res.status(400).json({ error: "to_slug y body son obligatorios" });
	}
	const toUser = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(to_slug);
	if (!toUser) return res.status(404).json({ error: "Destinatario no encontrado" });
	let game_id = bodyGameId ?? null;
	if (rawg_id != null && !game_id) {
		const rawgGame = await getGameByRawgId(String(rawg_id), RAWG_API_KEY);
		if (rawgGame) game_id = getOrCreateGame(rawgGame);
	}
	const createdAt = new Date().toISOString();
	db.prepare(
		"INSERT INTO messages (from_user_id, to_user_id, body, game_id, created_at) VALUES (?, ?, ?, ?, ?)"
	).run(me.id, toUser.id, body.trim(), game_id, createdAt);
	const row = db.prepare("SELECT id FROM messages WHERE from_user_id = ? AND created_at = ?").get(me.id, createdAt);
	const msgId = row?.id;
	let game = null;
	if (game_id) {
		game = db.prepare("SELECT id, rawg_id, name, released, image_url FROM games WHERE id = ?").get(game_id);
	}
	const payload = {
		id: msgId,
		body: body.trim(),
		game_id: game_id ?? undefined,
		game: game ?? undefined,
		created_at: createdAt,
		from: { name: me.name, slug: me.slug },
	};
	if (typeof broadcastToUser === "function") broadcastToUser(toUser.slug, { type: "message", ...payload });
	sendPushToUser(db, toUser.id, {
		title: me.name,
		body: body.trim().slice(0, 100),
		url: "/chat",
		type: "message",
	}).catch(() => {});
	res.status(201).json({ id: msgId, created_at: createdAt });
});

app.get("/api/push-config", (req, res) => {
	res.json({ enabled: isPushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/users/:slug/push-subscription", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const { endpoint, keys } = req.body;
	if (!endpoint || !keys?.p256dh || !keys?.auth) {
		return res.status(400).json({ error: "Suscripción inválida" });
	}
	db.prepare(
		"INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)"
	).run(user.id, endpoint, keys.p256dh, keys.auth);
	res.json({ ok: true });
});

app.get("/api/games/search", async (req, res) => {
	const q = (req.query.q || "").trim();
	if (!q) return res.json({ results: [] });
	const { results, error } = await searchGames(q, RAWG_API_KEY);
	if (error) return res.status(502).json({ error, results: [] });
	res.json({ results });
});

app.get("/api/games/rawg/:rawgId", async (req, res) => {
	const rawgId = req.params.rawgId;
	const game = await getGameByRawgId(rawgId, RAWG_API_KEY);
	if (!game) return res.status(404).json({ error: "Juego no encontrado" });
	res.json(game);
});

app.post("/api/users/:slug/jugados", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const { rawg_id, name, released, image_url, genres, platforms, metacritic, rating, opinion, completed } = req.body;
	if (rating == null || rating < 0 || rating > 10) {
		return res.status(400).json({ error: "Valoración entre 0 y 10" });
	}
	const completedVal = completed === false || completed === 0 ? 0 : 1;

	const rawgGame = {
		rawg_id: rawg_id,
		name: name || "Sin nombre",
		released: released || null,
		image_url: image_url || null,
		genres: genres || [],
		platforms: platforms || [],
		metacritic: metacritic ?? null,
	};
	const gameId = getOrCreateGame(rawgGame);
	const playedAt = new Date().toISOString();

	try {
		db.prepare(
			`INSERT INTO user_played (user_id, game_id, rating, opinion, played_at, completed)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO UPDATE SET rating = ?, opinion = ?, played_at = ?, completed = ?`
		).run(user.id, gameId, rating, opinion || null, playedAt, completedVal, rating, opinion || null, playedAt, completedVal);
		db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
	const newlyUnlocked = checkAchievements(db, user.id);
	res.status(201).json({ ok: true, game_id: gameId, played_at: playedAt, newlyUnlocked });
});

app.post("/api/users/:slug/pendientes", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const { rawg_id, name, released, image_url, genres, platforms, metacritic } = req.body;
	const rawgGame = {
		rawg_id: rawg_id,
		name: name || "Sin nombre",
		released: released || null,
		image_url: image_url || null,
		genres: genres || [],
		platforms: platforms || [],
		metacritic: metacritic ?? null,
	};
	const gameId = getOrCreateGame(rawgGame);
	const addedAt = new Date().toISOString();

	try {
		db.prepare(
			`INSERT INTO user_pending (user_id, game_id, added_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO NOTHING`
		).run(user.id, gameId, addedAt);
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
	const newlyUnlocked = checkAchievements(db, user.id);
	res.status(201).json({ ok: true, game_id: gameId, added_at: addedAt, newlyUnlocked });
});

app.patch("/api/users/:slug/jugados/:gameId", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const gameId = parseInt(req.params.gameId, 10);
	if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
	const completed = req.body.completed === false || req.body.completed === 0 ? 0 : 1;
	db.prepare("UPDATE user_played SET completed = ? WHERE user_id = ? AND game_id = ?").run(completed, user.id, gameId);
	revokeAchievementsIfNeeded(db, user.id);
	const newlyUnlocked = checkAchievements(db, user.id);
	res.json({ ok: true, completed: completed === 1, newlyUnlocked });
});

app.delete("/api/users/:slug/jugados/:gameId", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const gameId = parseInt(req.params.gameId, 10);
	if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
	db.prepare("DELETE FROM user_played WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	revokeAchievementsIfNeeded(db, user.id);
	res.json({ ok: true });
});

app.delete("/api/users/:slug/pendientes/:gameId", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const gameId = parseInt(req.params.gameId, 10);
	if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
	db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	revokeAchievementsIfNeeded(db, user.id);
	res.json({ ok: true });
});

app.get("/api/users/:slug/achievements", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const rows = db.prepare(
		"SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?"
	).all(user.id);
	const unlockedBy = Object.fromEntries(rows.map((r) => [r.achievement_id, r.unlocked_at]));
	const achievements = ACHIEVEMENTS.map((a) => {
		const unlocked_at = unlockedBy[a.id] ?? null;
		const progress = !unlocked_at ? getAchievementProgress(db, user.id, a.id) : null;
		return {
			id: a.id,
			title: a.title,
			description: a.description,
			category: a.category,
			difficulty: a.difficulty ?? "easy",
			rarity: a.rarity,
			icon: a.icon,
			unlocked_at,
			...(progress && { progress }),
		};
	});
	res.json({ achievements });
});

app.post("/api/users/:slug/achievements/first-login", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const unlocked = unlockAchievement(db, user.id, "quien_eres");
	res.json({ ok: true, newlyUnlocked: unlocked ? [unlocked] : [] });
});

app.get("/api/users/:slug/ranking", (req, res) => {
	const order = (req.query.order || "rating").toLowerCase();
	const valid = ["rating", "played_at"];
	const orderBy = valid.includes(order) ? order : "rating";
	const user = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const jugados = db
		.prepare(
			`SELECT up.rating, up.opinion, up.played_at, g.id as game_id, g.rawg_id, g.name, g.released, g.image_url, g.genres, g.metacritic
			 FROM user_played up
			 JOIN games g ON g.id = up.game_id
			 WHERE up.user_id = ? AND up.completed = 1
			 ORDER BY up.${orderBy} DESC`
		)
		.all(user.id)
		.map((r) => ({
			...r,
			genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres,
		}));

	res.json({ user, ranking: jugados });
});

// Ranking entre usuarios: solo juegos jugados (user_played), no pendientes ni esperados
app.get("/api/ranking/competencia", (req, res) => {
	const period = (req.query.period || "all").toLowerCase();
	const valid = ["month", "year", "all"];
	const p = valid.includes(period) ? period : "all";

	let since = null;
	if (p === "month") {
		const d = new Date();
		d.setDate(1);
		d.setUTCHours(0, 0, 0, 0);
		since = d.toISOString().slice(0, 10);
	} else if (p === "year") {
		const d = new Date();
		d.setMonth(0, 1);
		d.setUTCHours(0, 0, 0, 0);
		since = d.toISOString().slice(0, 10);
	}

	let ranking;
	if (since) {
		ranking = db
			.prepare(
				`SELECT u.id, u.name, u.slug, COUNT(up.id) as count
				 FROM users u
				 LEFT JOIN user_played up ON up.user_id = u.id AND date(up.played_at) >= date(?)
				 GROUP BY u.id
				 ORDER BY count DESC`
			)
			.all(since);
	} else {
		ranking = db
			.prepare(
				`SELECT u.id, u.name, u.slug, COUNT(up.id) as count
				 FROM users u
				 LEFT JOIN user_played up ON up.user_id = u.id
				 GROUP BY u.id
				 ORDER BY count DESC`
			)
			.all();
	}

	const result = ranking.map((r) => ({
		user: { id: r.id, name: r.name, slug: r.slug },
		count: r.count,
	}));

	res.json({ period: p, since: since || null, ranking: result });
});

app.get("/api/admin/inspect", (req, res) => {
	const key = req.query.key || req.headers["x-inspect-key"];
	if (!process.env.INSPECT_DB_KEY || key !== process.env.INSPECT_DB_KEY) {
		return res.status(401).json({ error: "No autorizado" });
	}
	try {
		const tables = ["users", "games", "user_played", "user_pending", "user_achievements", "messages"];
		const counts = {};
		for (const t of tables) {
			const r = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
			counts[t] = r.c;
		}
		const users = db.prepare("SELECT id, name, slug FROM users").all();
		const games = db.prepare("SELECT id, rawg_id, name FROM games LIMIT 20").all();
		const achievements = db.prepare("SELECT user_id, achievement_id, unlocked_at FROM user_achievements").all();
		res.json({
			counts,
			users,
			games,
			achievements,
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

(async () => {
	const dbPath = process.env.DB_PATH;
	if (dbPath && !existsSync(dbPath)) {
		const seedPath = join(__dirname, "juegos_backup_manual.db");
		if (existsSync(seedPath)) {
			copyFileSync(seedPath, dbPath);
			console.log("[Producción] Base de datos inicializada con copia de seguridad (juegos_backup_manual.db)");
		}
	}
	const database = await getDb();
	db = database;
		const server = http.createServer(app);
		const wss = new WebSocketServer({ server, path: "/ws" });
		const usersBySlug = new Map();

		wss.on("connection", (ws, req) => {
			let slug = null;
			ws.on("message", (raw) => {
				try {
					const data = JSON.parse(raw.toString());
					if (data.type === "auth" && data.slug) {
						slug = data.slug;
						if (!usersBySlug.has(slug)) usersBySlug.set(slug, new Set());
						usersBySlug.get(slug).add(ws);
						ws.on("close", () => {
							const set = usersBySlug.get(slug);
							if (set) {
								set.delete(ws);
								if (set.size === 0) usersBySlug.delete(slug);
							}
						});
					}
				} catch (_) {}
			});
		});

		broadcastToUser = (targetSlug, payload) => {
			const set = usersBySlug.get(targetSlug);
			if (!set) return;
			const text = JSON.stringify(payload);
			set.forEach((client) => {
				if (client.readyState === 1) client.send(text);
			});
		};

		server.listen(Number(PORT), "0.0.0.0", () => {
			console.log(`Backend escuchando en puerto ${PORT} (HTTP + WS /ws)`);
		});

		startBackupCron();

		// Notificaciones de juegos pendientes lanzados (cada hora)
		const today = () => new Date().toISOString().slice(0, 10);
		setInterval(() => {
			const rows = db
				.prepare(
					`SELECT up.user_id, up.game_id, g.name as game_name
					 FROM user_pending up
					 JOIN games g ON g.id = up.game_id
					 WHERE g.released IS NOT NULL AND date(g.released) <= date(?)
					 AND NOT EXISTS (SELECT 1 FROM released_notification_sent r WHERE r.user_id = up.user_id AND r.game_id = up.game_id)`
				)
				.all(today());
			rows.forEach((r) => {
				const user = db.prepare("SELECT slug, name FROM users WHERE id = ?").get(r.user_id);
				if (!user) return;
				sendPushToUser(db, r.user_id, {
					title: "¡Ya está disponible!",
					body: `${r.game_name} ya ha salido.`,
					url: "/chat",
					type: "game_released",
					game_id: r.game_id,
				}).catch(() => {});
				db.prepare("INSERT INTO released_notification_sent (user_id, game_id, sent_at) VALUES (?, ?, ?)").run(
					r.user_id,
					r.game_id,
					new Date().toISOString()
				);
			});
		}, 60 * 60 * 1000);
})().catch((err) => {
	console.error("Error al iniciar la base de datos:", err);
	process.exit(1);
});
