import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./db.js";
import { searchGames, getGameByRawgId } from "./rawg.js";

const app = express();
const PORT = process.env.PORT || 3001;
const RAWG_API_KEY = process.env.RAWG_API_KEY || "";

const corsOrigin = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
	: true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

let db;

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

app.get("/api/users", (req, res) => {
	const users = db.prepare("SELECT id, name, slug FROM users ORDER BY name").all();
	res.json(users);
});

app.get("/api/users/:slug", (req, res) => {
	const user = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	res.json(user);
});

app.get("/api/users/:slug/perfil", (req, res) => {
	const user = db.prepare("SELECT id, name, slug FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

	const jugados = db
		.prepare(
			`SELECT up.rating, up.opinion, up.played_at, g.id as game_id, g.rawg_id, g.name, g.released, g.image_url, g.genres, g.metacritic
			 FROM user_played up
			 JOIN games g ON g.id = up.game_id
			 WHERE up.user_id = ?
			 ORDER BY up.rating DESC, up.played_at DESC`
		)
		.all(user.id)
		.map((r) => ({
			...r,
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

	const { rawg_id, name, released, image_url, genres, platforms, metacritic, rating, opinion } = req.body;
	if (rating == null || rating < 0 || rating > 10) {
		return res.status(400).json({ error: "Valoración entre 0 y 10" });
	}

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
			`INSERT INTO user_played (user_id, game_id, rating, opinion, played_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, game_id) DO UPDATE SET rating = ?, opinion = ?, played_at = ?`
		).run(user.id, gameId, rating, opinion || null, playedAt, rating, opinion || null, playedAt);
		db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
	res.status(201).json({ ok: true, game_id: gameId, played_at: playedAt });
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
	res.status(201).json({ ok: true, game_id: gameId, added_at: addedAt });
});

app.delete("/api/users/:slug/jugados/:gameId", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const gameId = parseInt(req.params.gameId, 10);
	if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
	db.prepare("DELETE FROM user_played WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	res.json({ ok: true });
});

app.delete("/api/users/:slug/pendientes/:gameId", (req, res) => {
	const user = db.prepare("SELECT id FROM users WHERE slug = ?").get(req.params.slug);
	if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
	const gameId = parseInt(req.params.gameId, 10);
	if (Number.isNaN(gameId)) return res.status(400).json({ error: "game_id inválido" });
	db.prepare("DELETE FROM user_pending WHERE user_id = ? AND game_id = ?").run(user.id, gameId);
	res.json({ ok: true });
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
			 WHERE up.user_id = ?
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

getDb()
	.then((database) => {
		db = database;
		app.listen(Number(PORT), "0.0.0.0", () => {
			console.log(`Backend escuchando en puerto ${PORT}`);
		});
	})
	.catch((err) => {
		console.error("Error al iniciar la base de datos:", err);
		process.exit(1);
	});
