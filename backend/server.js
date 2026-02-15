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
import { searchGames, getGameByRawgId, listGames } from "./rawg.js";
import { checkAchievements, unlockAchievement, getAchievementProgress, revokeAchievementsIfNeeded, ACHIEVEMENTS } from "./achievements.js";
import {
	getSteamLoginUrl,
	validateSteamCallback,
	getSteamPlayerSummaries,
	getRecentlyPlayedGames,
	getOwnedGames,
	getPlayerAchievements,
	getSchemaForGame,
} from "./steam.js";
import { sendPushToUser, isPushConfigured } from "./push.js";
import { startBackupCron } from "./backupCron.js";

const app = express();
const PORT = process.env.PORT || 3001;
const RAWG_API_KEY = process.env.RAWG_API_KEY || "";
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";

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
	const user = db.prepare("SELECT id, name, slug, bio, avatar, steam_id FROM users WHERE slug = ?").get(req.params.slug);
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

	const jugando = db
		.prepare(
			`SELECT up.added_at, g.id as game_id, g.rawg_id, g.name, g.released, g.image_url, g.genres
			 FROM user_playing up
			 JOIN games g ON g.id = up.game_id
			 WHERE up.user_id = ?
			 ORDER BY up.added_at DESC`
		)
		.all(user.id)
		.map((r) => ({
			...r,
			genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres,
		}));

	res.json({ user, jugados, pendientes, jugando });
});

// Mapeo nombre de género (RAWG) -> slug RAWG para filtros API
const GENRE_TO_SLUG = {
	Action: "action",
	Adventure: "adventure",
	Indie: "indie",
	RPG: "role-playing-games-rpg",
	"Role-Playing": "role-playing-games-rpg",
	Strategy: "strategy",
	Shooter: "shooter",
	Simulation: "simulation",
	Puzzle: "puzzle",
	Arcade: "arcade",
	Platformer: "platformer",
	Fighting: "fighting",
	Racing: "racing",
	Sports: "sports",
	"Massively Multiplayer": "massively-multiplayer",
	Family: "family",
	Board: "board-games",
	Card: "card",
	Educational: "educational",
};

function genreNameToSlug(name) {
	if (!name || typeof name !== "string") return null;
	const slug = GENRE_TO_SLUG[name] || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	return slug || null;
}

app.get("/api/users/:slug/brain", async (req, res) => {
	const user = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const jugados = db
		.prepare(
			`SELECT up.rating, g.rawg_id, g.genres
			 FROM user_played up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`
		)
		.all(user.id)
		.map((r) => ({ rawg_id: r.rawg_id, rating: r.rating ?? 5, genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres || [] }));

	const pendientes = db
		.prepare(
			`SELECT g.rawg_id, g.genres FROM user_pending up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`
		)
		.all(user.id)
		.map((r) => ({ rawg_id: r.rawg_id, genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres || [] }));

	const jugando = db
		.prepare(
			`SELECT g.rawg_id, g.genres FROM user_playing up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`
		)
		.all(user.id)
		.map((r) => ({ rawg_id: r.rawg_id, genres: typeof r.genres === "string" ? JSON.parse(r.genres || "[]") : r.genres || [] }));

	const excludeRawgIds = new Set([
		...jugados.map((x) => Number(x.rawg_id)),
		...pendientes.map((x) => Number(x.rawg_id)),
		...jugando.map((x) => Number(x.rawg_id)),
	].filter(Number.isFinite));

	const genreScores = {};
	for (const { rating, genres } of jugados) {
		const weight = (rating != null && rating >= 0) ? (Number(rating) / 10) : 0.5;
		for (const name of genres) if (name) genreScores[name] = (genreScores[name] || 0) + weight;
	}
	for (const { genres } of [...pendientes, ...jugando]) {
		for (const name of genres) if (name) genreScores[name] = (genreScores[name] || 0) + 0.5;
	}

	const topGenres = Object.entries(genreScores)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([name]) => name);

	const seen = new Set();
	const recommendations = [];
	const MAX_RECOMMENDATIONS = 25;

	// Recomendaciones por géneros que te gustan (juegos ya salidos, orden por metacritic)
	for (const genreName of topGenres) {
		const slug = genreNameToSlug(genreName);
		if (!slug || recommendations.length >= MAX_RECOMMENDATIONS) break;
		const { results, error } = await listGames(RAWG_API_KEY, {
			genreSlug: slug,
			ordering: "-metacritic",
			pageSize: 15,
		});
		if (error) continue;
		const genreLabel = genreName;
		for (const g of results) {
			const id = g.rawg_id;
			if (seen.has(id) || excludeRawgIds.has(id)) continue;
			seen.add(id);
			recommendations.push({
				...g,
				reason: `Porque te gustan los juegos de ${genreLabel}`,
			});
			if (recommendations.length >= MAX_RECOMMENDATIONS) break;
		}
	}

	// Próximos lanzamientos (fecha desde hoy)
	if (recommendations.length < MAX_RECOMMENDATIONS && RAWG_API_KEY) {
		const today = new Date().toISOString().slice(0, 10);
		const { results } = await listGames(RAWG_API_KEY, {
			ordering: "released",
			dates: `${today},2099-12-31`,
			pageSize: 15,
		});
		for (const g of results || []) {
			const id = g.rawg_id;
			if (seen.has(id) || excludeRawgIds.has(id)) continue;
			seen.add(id);
			recommendations.push({
				...g,
				reason: g.released ? `Próximo lanzamiento (${g.released})` : "Próximo lanzamiento",
			});
			if (recommendations.length >= MAX_RECOMMENDATIONS) break;
		}
	}

	res.json({
		recommendations,
		profile: { topGenres },
	});
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

app.get("/api/users/:slug/recommendations", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const rows = db
		.prepare(
			`SELECT m.id, m.body, m.game_id, m.created_at, u.name as from_name, u.slug as from_slug
			 FROM messages m
			 JOIN users u ON u.id = m.from_user_id
			 WHERE m.to_user_id = ? AND m.game_id IS NOT NULL
			 AND NOT EXISTS (SELECT 1 FROM user_recommendation_dismissed d WHERE d.user_id = ? AND d.message_id = m.id)
			 ORDER BY m.created_at DESC`
		)
		.all(user.id, user.id);
	const games = {};
	rows.forEach((r) => {
		if (r.game_id && !games[r.game_id]) {
			const g = db.prepare("SELECT id, rawg_id, name, released, image_url FROM games WHERE id = ?").get(r.game_id);
			if (g) games[r.game_id] = g;
		}
	});
	const recommendations = rows.map((r) => ({
		id: r.id,
		body: r.body,
		game_id: r.game_id,
		game: r.game_id ? games[r.game_id] : undefined,
		created_at: r.created_at,
		from: { name: r.from_name, slug: r.from_slug },
	}));
	res.json({ recommendations });
});

app.post("/api/users/:slug/recommendations/:messageId/dismiss", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const messageId = parseInt(req.params.messageId, 10);
	if (Number.isNaN(messageId)) return res.status(400).json({ error: "message_id inválido" });
	db.prepare(
		"INSERT OR IGNORE INTO user_recommendation_dismissed (user_id, message_id) VALUES (?, ?)"
	).run(user.id, messageId);
	res.json({ ok: true });
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

// Origen del frontend para redirigir tras Steam callback (en local el callback va al backend, no al frontend)
const steamRedirectOriginBySlug = new Map();
const STEAM_REDIRECT_TTL_MS = 5 * 60 * 1000;

function clearSteamRedirect(slug) {
	steamRedirectOriginBySlug.delete(slug);
}

// Typo frecuente en móvil: conecct -> redirect a connect
app.get("/api/users/:slug/steam/conecct", (req, res) => {
	const q = req.originalUrl && req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
	res.redirect(302, `/api/users/${req.params.slug}/steam/connect${q}`);
});

app.get("/api/users/:slug/steam/connect", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const redirectOrigin =
		req.query.redirect_origin ||
		(req.get("referer") && new URL(req.get("referer")).origin) ||
		FRONTEND_URL;
	const safeOrigin = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(redirectOrigin) ? redirectOrigin : FRONTEND_URL;
	steamRedirectOriginBySlug.set(req.params.slug, safeOrigin);
	setTimeout(() => clearSteamRedirect(req.params.slug), STEAM_REDIRECT_TTL_MS);
	const returnTo = `${BACKEND_URL}/api/users/${req.params.slug}/steam/callback`;
	const realm = safeOrigin;
	const url = getSteamLoginUrl(returnTo, realm);
	res.redirect(302, url);
});

app.get("/api/users/:slug/steam/callback", async (req, res) => {
	const slug = req.params.slug;
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(slug);
	const frontOrigin = steamRedirectOriginBySlug.get(slug) || FRONTEND_URL;
	clearSteamRedirect(slug);
	const redirectBase = frontOrigin.replace(/\/$/, "");
	const go = (path, qs = "") => {
		res.redirect(302, `${redirectBase}${path}${qs ? `?${qs}` : ""}`);
	};
	if (!user) {
		go("/perfil", "steam=error");
		return;
	}
	const query = new URLSearchParams(req.originalUrl.includes("?") ? req.originalUrl.split("?")[1] : "");
	const steamId = await validateSteamCallback(query);
	if (!steamId) {
		go(`/perfil/${req.params.slug}`, "steam=error");
		return;
	}
	db.prepare("UPDATE users SET steam_id = ? WHERE id = ?").run(steamId, user.id);
	go(`/perfil/${req.params.slug}`, "steam=linked");
});

app.get("/api/users/:slug/steam/profile", async (req, res) => {
	const user = db.prepare("SELECT id, steam_id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	if (!user.steam_id) return res.json({ linked: false });
	if (!STEAM_API_KEY) return res.json({ linked: true, steam_id: user.steam_id, summary: null });
	try {
		const summary = await getSteamPlayerSummaries(STEAM_API_KEY, user.steam_id);
		res.json({ linked: true, steam_id: user.steam_id, summary: summary || null });
	} catch (e) {
		res.json({ linked: true, steam_id: user.steam_id, summary: null });
	}
});

app.get("/api/users/:slug/steam/games", async (req, res) => {
	const user = db.prepare("SELECT id, steam_id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	if (!user.steam_id) return res.json({ games: [] });
	if (!STEAM_API_KEY) return res.json({ games: [] });
	try {
		const games = await getRecentlyPlayedGames(STEAM_API_KEY, user.steam_id);
		res.json({ games });
	} catch (e) {
		res.status(502).json({ games: [], error: e.message });
	}
});

app.get("/api/users/:slug/steam/library", async (req, res) => {
	const user = db.prepare("SELECT id, steam_id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	if (!user.steam_id) return res.json({ games: [] });
	if (!STEAM_API_KEY) return res.json({ games: [] });
	try {
		const games = await getOwnedGames(STEAM_API_KEY, user.steam_id, { includeAppInfo: true, includePlayedFreeGames: true });
		res.json({ games });
	} catch (e) {
		res.status(502).json({ games: [], error: e.message });
	}
});

const STEAM_SYNC_MAX_GAMES = 35;

app.post("/api/users/:slug/steam/sync-library", async (req, res) => {
	const user = db.prepare("SELECT id, steam_id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	if (!user.steam_id) return res.status(400).json({ error: "Steam no conectado" });
	if (!RAWG_API_KEY) return res.status(503).json({ error: "RAWG API no configurada; no se puede buscar juegos." });
	try {
		const steamGames = await getOwnedGames(STEAM_API_KEY, user.steam_id, { includeAppInfo: true, includePlayedFreeGames: true });
		const toProcess = steamGames.slice(0, STEAM_SYNC_MAX_GAMES);
		let addedPlaying = 0;
		let addedPending = 0;
		let skipped = 0;
		const notFound = [];
		const now = new Date().toISOString();

		for (const g of toProcess) {
			const name = (g.name || "").trim();
			if (!name) continue;
			const { results } = await searchGames(name, RAWG_API_KEY);
			const first = results && results[0];
			if (!first) {
				notFound.push(name);
				continue;
			}
			const gameId = getOrCreateGame(first);
			const hasPlaytime = (g.playtime_forever || 0) > 0;
			try {
				if (hasPlaytime) {
					db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
					db.prepare(
						`INSERT INTO user_playing (user_id, game_id, added_at) VALUES (?, ?, ?) ON CONFLICT(user_id, game_id) DO NOTHING`
					).run(user.id, gameId, now);
					const c = db.prepare("SELECT changes() as c").get();
					if (c && c.c > 0) addedPlaying++;
					else skipped++;
				} else {
					db.prepare("DELETE FROM user_playing WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
					db.prepare(
						`INSERT INTO user_pending (user_id, game_id, added_at) VALUES (?, ?, ?) ON CONFLICT(user_id, game_id) DO NOTHING`
					).run(user.id, gameId, now);
					const c = db.prepare("SELECT changes() as c").get();
					if (c && c.c > 0) addedPending++;
					else skipped++;
				}
			} catch (e) {
				skipped++;
			}
		}

		res.json({
			addedPlaying,
			addedPending,
			skipped,
			notFound: notFound.slice(0, 10),
		});
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
});

app.get("/api/users/:slug/steam/achievements/:appId", async (req, res) => {
	const user = db.prepare("SELECT id, steam_id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	if (!user.steam_id) return res.status(400).json({ error: "Steam no conectado" });
	const appId = req.params.appId;
	if (!appId) return res.status(400).json({ error: "Falta appId" });
	if (!STEAM_API_KEY) return res.status(503).json({ error: "Steam API no configurada" });
	try {
		const [playerStats, schema] = await Promise.all([
			getPlayerAchievements(STEAM_API_KEY, user.steam_id, appId),
			getSchemaForGame(STEAM_API_KEY, appId),
		]);
		const achievements = (playerStats?.achievements || []).map((a) => {
			const def = schema?.availableGameStats?.achievements?.find((s) => s.name === a.apiname);
			return {
				apiname: a.apiname,
				achieved: a.achieved === 1,
				unlocktime: a.unlocktime,
				description: def?.description || "",
				displayName: def?.displayName || a.apiname,
				icon: def?.icon || "",
				iconGray: def?.icongray || "",
			};
		});
		res.json({
			gameName: playerStats?.gameName || schema?.gameName || appId,
			achievements,
		});
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
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
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

		const body = req.body || {};
		const rawgGame = buildRawgGameFromBody(body);
		if (!rawgGame) return res.status(400).json({ error: "Falta rawg_id del juego" });

		const rating = body.rating != null ? Number(body.rating) : null;
		if (rating == null || Number.isNaN(rating) || rating < 0 || rating > 10) {
			return res.status(400).json({ error: "Valoración entre 0 y 10" });
		}
		const completedVal = body.completed === false || body.completed === 0 ? 0 : 1;
		const opinion = typeof body.opinion === "string" ? body.opinion.trim() || null : null;

		const gameId = getOrCreateGame(rawgGame);
		const playedAt = new Date().toISOString();

		db.prepare(
			`INSERT INTO user_played (user_id, game_id, rating, opinion, played_at, completed)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO UPDATE SET rating = ?, opinion = ?, played_at = ?, completed = ?`
		).run(user.id, gameId, rating, opinion, playedAt, completedVal, rating, opinion, playedAt, completedVal);
		db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
		db.prepare("DELETE FROM user_playing WHERE user_id = ? AND game_id = ?").run(user.id, gameId);

		const newlyUnlocked = checkAchievements(db, user.id);
		res.status(201).json({ ok: true, game_id: gameId, played_at: playedAt, newlyUnlocked });
	} catch (e) {
		console.error("POST jugados:", e);
		res.status(500).json({ error: e.message || "Error al añadir a jugados" });
	}
});

app.post("/api/users/:slug/pendientes", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

		const rawgGame = buildRawgGameFromBody(req.body);
		if (!rawgGame) return res.status(400).json({ error: "Falta rawg_id del juego" });

		const gameId = getOrCreateGame(rawgGame);
		const addedAt = new Date().toISOString();

		db.prepare(
			`INSERT INTO user_pending (user_id, game_id, added_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO NOTHING`
		).run(user.id, gameId, addedAt);
		const newlyUnlocked = checkAchievements(db, user.id);
		res.status(201).json({ ok: true, game_id: gameId, added_at: addedAt, newlyUnlocked });
	} catch (e) {
		console.error("POST pendientes:", e);
		res.status(500).json({ error: e.message || "Error al añadir a pendientes" });
	}
});

app.post("/api/users/:slug/jugando", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

		const rawgGame = buildRawgGameFromBody(req.body);
		if (!rawgGame) return res.status(400).json({ error: "Falta rawg_id del juego" });

		const gameId = getOrCreateGame(rawgGame);
		const addedAt = new Date().toISOString();

		db.prepare(
			`INSERT INTO user_playing (user_id, game_id, added_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO NOTHING`
		).run(user.id, gameId, addedAt);
		const newlyUnlocked = checkAchievements(db, user.id);
		res.status(201).json({ ok: true, game_id: gameId, added_at: addedAt, newlyUnlocked });
	} catch (e) {
		console.error("POST jugando:", e);
		res.status(500).json({ error: e.message || "Error al añadir a jugando" });
	}
});

app.patch("/api/users/:slug/jugados/:gameId", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
		const gameId = parseGameId(req.params.gameId);
		if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
		const body = req.body || {};
		const completed = body.completed === false || body.completed === 0 ? 0 : 1;
		db.prepare("UPDATE user_played SET completed = ? WHERE user_id = ? AND game_id = ?").run(completed, user.id, gameId);
		revokeAchievementsIfNeeded(db, user.id);
		const newlyUnlocked = checkAchievements(db, user.id);
		res.json({ ok: true, completed: completed === 1, newlyUnlocked });
	} catch (e) {
		console.error("PATCH jugados:", e);
		res.status(500).json({ error: e.message || "Error al actualizar" });
	}
});

function parseGameId(param) {
	if (param == null || param === "") return NaN;
	const n = parseInt(String(param).trim(), 10);
	return Number.isNaN(n) || n < 1 ? NaN : n;
}

function normalizeRawgId(v) {
	if (v == null || v === "") return null;
	const n = Number(v);
	if (Number.isNaN(n) || n < 1) return null;
	return n;
}

function toArray(v) {
	if (Array.isArray(v)) return v;
	if (v == null) return [];
	if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
	return [];
}

function buildRawgGameFromBody(body) {
	const b = body || {};
	let rawg_id = normalizeRawgId(b.rawg_id);
	let name = b.name || "Sin nombre";
	let released = b.released || null;
	let image_url = b.image_url || null;
	let genres = toArray(b.genres);
	let platforms = toArray(b.platforms);
	let metacritic = b.metacritic ?? null;

	if (rawg_id == null && b.game_id != null) {
		const gameId = parseGameId(b.game_id);
		if (!Number.isNaN(gameId)) {
			const row = db.prepare("SELECT rawg_id, name, released, image_url, genres, platforms, metacritic FROM games WHERE id = ?").get(gameId);
			if (row) {
				rawg_id = Number(row.rawg_id);
				if (!name || name === "Sin nombre") name = row.name || name;
				if (released == null) released = row.released;
				if (image_url == null) image_url = row.image_url;
				if (genres.length === 0) genres = typeof row.genres === "string" ? JSON.parse(row.genres || "[]") : (row.genres || []);
				if (platforms.length === 0) platforms = typeof row.platforms === "string" ? JSON.parse(row.platforms || "[]") : (row.platforms || []);
				if (metacritic == null) metacritic = row.metacritic;
			}
		}
	}
	if (rawg_id == null) return null;
	return {
		rawg_id,
		name,
		released,
		image_url,
		genres,
		platforms,
		metacritic,
	};
}

app.delete("/api/users/:slug/jugados/:gameId", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
		const gameId = parseGameId(req.params.gameId);
		if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
		db.prepare("DELETE FROM user_played WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
		revokeAchievementsIfNeeded(db, user.id);
		res.json({ ok: true });
	} catch (e) {
		console.error("DELETE jugados:", e);
		res.status(500).json({ error: e.message || "Error al eliminar" });
	}
});

app.delete("/api/users/:slug/pendientes/:gameId", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
		const gameId = parseGameId(req.params.gameId);
		if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
		db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
		revokeAchievementsIfNeeded(db, user.id);
		res.json({ ok: true });
	} catch (e) {
		console.error("DELETE pendientes:", e);
		res.status(500).json({ error: e.message || "Error al eliminar" });
	}
});

app.delete("/api/users/:slug/jugando/:gameId", (req, res) => {
	try {
		const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
		if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
		const gameId = parseGameId(req.params.gameId);
		if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
		db.prepare("DELETE FROM user_playing WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
		revokeAchievementsIfNeeded(db, user.id);
		res.json({ ok: true });
	} catch (e) {
		console.error("DELETE jugando:", e);
		res.status(500).json({ error: e.message || "Error al eliminar" });
	}
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

function getAgendaUserId(slug) {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(slug);
	return user?.id ?? null;
}

app.get("/api/users/:slug/agenda/ambitos", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const rows = db.prepare("SELECT id, name, color, sort_order FROM agenda_ambitos WHERE user_id = ? ORDER BY sort_order, id").all(userId);
	res.json({ ambitos: rows });
});

app.post("/api/users/:slug/agenda/ambitos", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const { name, color, sort_order } = req.body || {};
	if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name es obligatorio" });
	db.prepare("INSERT INTO agenda_ambitos (user_id, name, color, sort_order) VALUES (?, ?, ?, ?)").run(
		userId, name.trim(), color && typeof color === "string" ? color.trim() : null, typeof sort_order === "number" ? sort_order : 0
	);
	const row = db.prepare("SELECT id, name, color, sort_order FROM agenda_ambitos WHERE id = last_insert_rowid()").get();
	res.status(201).json(row);
});

app.patch("/api/users/:slug/agenda/ambitos/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const existing = db.prepare("SELECT id FROM agenda_ambitos WHERE id = ? AND user_id = ?").get(req.params.id, userId);
	if (!existing) return res.status(404).json({ error: "Ámbito no encontrado" });
	const { name, color, sort_order } = req.body || {};
	const updates = [];
	const params = [];
	if (name !== undefined) { updates.push("name = ?"); params.push(typeof name === "string" ? name.trim() : ""); }
	if (color !== undefined) { updates.push("color = ?"); params.push(color && typeof color === "string" ? color.trim() : null); }
	if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(typeof sort_order === "number" ? sort_order : 0); }
	if (updates.length === 0) return res.json(db.prepare("SELECT id, name, color, sort_order FROM agenda_ambitos WHERE id = ?").get(req.params.id));
	params.push(req.params.id);
	db.prepare(`UPDATE agenda_ambitos SET ${updates.join(", ")} WHERE id = ?`).run(...params);
	const row = db.prepare("SELECT id, name, color, sort_order FROM agenda_ambitos WHERE id = ?").get(req.params.id);
	res.json(row);
});

app.delete("/api/users/:slug/agenda/ambitos/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const r = db.prepare("DELETE FROM agenda_ambitos WHERE id = ? AND user_id = ?").run(req.params.id, userId);
	if (r.changes === 0) return res.status(404).json({ error: "Ámbito no encontrado" });
	res.status(204).end();
});

app.get("/api/users/:slug/agenda/tasks", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const today = new Date().toISOString().slice(0, 10);
	const fromDate = req.query.from || today;
	const toDate = req.query.to || fromDate;
	let sql = "SELECT t.id, t.ambito_id, t.title, t.task_date, t.time_slot, t.completed_at, t.note, t.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_tasks t LEFT JOIN agenda_ambitos a ON a.id = t.ambito_id WHERE t.user_id = ?";
	const params = [userId];
	if (toDate !== fromDate) {
		sql += " AND date(t.task_date) >= date(?) AND date(t.task_date) <= date(?)";
		params.push(fromDate, toDate);
	} else {
		sql += " AND date(t.task_date) = date(?)";
		params.push(fromDate);
	}
	sql += " ORDER BY t.task_date, t.time_slot, t.id";
	const rows = db.prepare(sql).all(...params);
	res.json({ tasks: rows });
});

app.post("/api/users/:slug/agenda/tasks", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const { ambito_id, title, task_date, time_slot, note } = req.body || {};
	if (!title || typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title es obligatorio" });
	const dateStr = task_date && typeof task_date === "string" ? task_date.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);
	const now = new Date().toISOString();
	db.prepare(
		"INSERT INTO agenda_tasks (user_id, ambito_id, title, task_date, time_slot, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
	).run(userId, ambito_id && Number(ambito_id) ? Number(ambito_id) : null, title.trim(), dateStr, time_slot && typeof time_slot === "string" ? time_slot.trim() : null, note && typeof note === "string" ? note.trim() : null, now);
	const row = db.prepare(
		"SELECT t.id, t.ambito_id, t.title, t.task_date, t.time_slot, t.completed_at, t.note, t.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_tasks t LEFT JOIN agenda_ambitos a ON a.id = t.ambito_id WHERE t.id = last_insert_rowid()"
	).get();
	res.status(201).json(row);
});

app.patch("/api/users/:slug/agenda/tasks/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const existing = db.prepare("SELECT id FROM agenda_tasks WHERE id = ? AND user_id = ?").get(req.params.id, userId);
	if (!existing) return res.status(404).json({ error: "Tarea no encontrada" });
	const { title, task_date, time_slot, completed_at, note, ambito_id } = req.body || {};
	const updates = [];
	const params = [];
	if (title !== undefined) { updates.push("title = ?"); params.push(typeof title === "string" ? title.trim() : ""); }
	if (task_date !== undefined) { updates.push("task_date = ?"); params.push(typeof task_date === "string" ? task_date.slice(0, 10) : new Date().toISOString().slice(0, 10)); }
	if (time_slot !== undefined) { updates.push("time_slot = ?"); params.push(time_slot == null || (typeof time_slot === "string" && !time_slot.trim()) ? null : (typeof time_slot === "string" ? time_slot.trim() : String(time_slot))); }
	if (completed_at !== undefined) { updates.push("completed_at = ?"); params.push(completed_at === true || (typeof completed_at === "string" && completed_at) ? new Date().toISOString() : null); }
	if (note !== undefined) { updates.push("note = ?"); params.push(note && typeof note === "string" ? note.trim() : null); }
	if (ambito_id !== undefined) { updates.push("ambito_id = ?"); params.push(ambito_id && Number(ambito_id) ? Number(ambito_id) : null); }
	if (updates.length === 0) return res.json(db.prepare("SELECT t.id, t.ambito_id, t.title, t.task_date, t.time_slot, t.completed_at, t.note, t.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_tasks t LEFT JOIN agenda_ambitos a ON a.id = t.ambito_id WHERE t.id = ?").get(req.params.id));
	params.push(req.params.id);
	db.prepare(`UPDATE agenda_tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
	const row = db.prepare("SELECT t.id, t.ambito_id, t.title, t.task_date, t.time_slot, t.completed_at, t.note, t.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_tasks t LEFT JOIN agenda_ambitos a ON a.id = t.ambito_id WHERE t.id = ?").get(req.params.id);
	res.json(row);
});

app.delete("/api/users/:slug/agenda/tasks/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const r = db.prepare("DELETE FROM agenda_tasks WHERE id = ? AND user_id = ?").run(req.params.id, userId);
	if (r.changes === 0) return res.status(404).json({ error: "Tarea no encontrada" });
	res.status(204).end();
});

app.get("/api/users/:slug/agenda/goals", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const type = req.query.type;
	const period_key = req.query.period_key;
	let sql = "SELECT g.id, g.ambito_id, g.title, g.goal_type, g.period_key, g.target_value, g.target_unit, g.current_value, g.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_goals g LEFT JOIN agenda_ambitos a ON a.id = g.ambito_id WHERE g.user_id = ?";
	const params = [userId];
	if (type) { sql += " AND g.goal_type = ?"; params.push(type); }
	if (period_key) { sql += " AND g.period_key = ?"; params.push(period_key); }
	sql += " ORDER BY g.goal_type, g.period_key, g.id";
	const rows = db.prepare(sql).all(...params);
	res.json({ goals: rows });
});

app.post("/api/users/:slug/agenda/goals", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const { ambito_id, title, goal_type, period_key, target_value, target_unit, current_value } = req.body || {};
	if (!title || typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title es obligatorio" });
	if (!goal_type || !["weekly", "monthly", "annual"].includes(goal_type)) return res.status(400).json({ error: "goal_type debe ser weekly, monthly o annual" });
	if (!period_key || typeof period_key !== "string" || !period_key.trim()) return res.status(400).json({ error: "period_key es obligatorio (ej: 2026-W06, 2026-02, 2026)" });
	const now = new Date().toISOString();
	db.prepare(
		"INSERT INTO agenda_goals (user_id, ambito_id, title, goal_type, period_key, target_value, target_unit, current_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
	).run(userId, ambito_id && Number(ambito_id) ? Number(ambito_id) : null, title.trim(), goal_type, period_key.trim(), target_value != null ? Number(target_value) : null, target_unit && typeof target_unit === "string" ? target_unit.trim() : null, current_value != null ? Number(current_value) : 0, now);
	const row = db.prepare(
		"SELECT g.id, g.ambito_id, g.title, g.goal_type, g.period_key, g.target_value, g.target_unit, g.current_value, g.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_goals g LEFT JOIN agenda_ambitos a ON a.id = g.ambito_id WHERE g.id = last_insert_rowid()"
	).get();
	res.status(201).json(row);
});

app.patch("/api/users/:slug/agenda/goals/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const existing = db.prepare("SELECT id FROM agenda_goals WHERE id = ? AND user_id = ?").get(req.params.id, userId);
	if (!existing) return res.status(404).json({ error: "Meta no encontrada" });
	const { title, target_value, current_value, target_unit } = req.body || {};
	const updates = [];
	const params = [];
	if (title !== undefined) { updates.push("title = ?"); params.push(typeof title === "string" ? title.trim() : ""); }
	if (target_value !== undefined) { updates.push("target_value = ?"); params.push(target_value != null ? Number(target_value) : null); }
	if (current_value !== undefined) { updates.push("current_value = ?"); params.push(current_value != null ? Number(current_value) : 0); }
	if (target_unit !== undefined) { updates.push("target_unit = ?"); params.push(target_unit && typeof target_unit === "string" ? target_unit.trim() : null); }
	if (updates.length === 0) return res.json(db.prepare("SELECT g.id, g.ambito_id, g.title, g.goal_type, g.period_key, g.target_value, g.target_unit, g.current_value, g.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_goals g LEFT JOIN agenda_ambitos a ON a.id = g.ambito_id WHERE g.id = ?").get(req.params.id));
	params.push(req.params.id);
	db.prepare(`UPDATE agenda_goals SET ${updates.join(", ")} WHERE id = ?`).run(...params);
	const row = db.prepare("SELECT g.id, g.ambito_id, g.title, g.goal_type, g.period_key, g.target_value, g.target_unit, g.current_value, g.created_at, a.name as ambito_name, a.color as ambito_color FROM agenda_goals g LEFT JOIN agenda_ambitos a ON a.id = g.ambito_id WHERE g.id = ?").get(req.params.id);
	res.json(row);
});

app.delete("/api/users/:slug/agenda/goals/:id", (req, res) => {
	const userId = getAgendaUserId(req.params.slug);
	if (!userId) return res.status(404).json({ error: "Usuario no encontrado" });
	const r = db.prepare("DELETE FROM agenda_goals WHERE id = ? AND user_id = ?").run(req.params.id, userId);
	if (r.changes === 0) return res.status(404).json({ error: "Meta no encontrada" });
	res.status(204).end();
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
