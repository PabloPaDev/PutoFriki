import initSqlJs from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, "juegos.db");

let db = null;

function save() {
	if (!db) return;
	try {
		const data = db.export();
		writeFileSync(dbPath, Buffer.from(data));
	} catch (e) {
		console.warn("No se pudo guardar la base de datos:", e.message);
	}
}

function wrapStmt(stmt) {
	return {
		run(...params) {
			stmt.bind(params);
			while (stmt.step()) {}
			stmt.free();
			save();
		},
		get(...params) {
			stmt.bind(params);
			const row = stmt.step() ? stmt.getAsObject() : null;
			stmt.free();
			return row ?? undefined;
		},
		all(...params) {
			stmt.bind(params);
			const rows = [];
			while (stmt.step()) rows.push(stmt.getAsObject());
			stmt.free();
			return rows;
		},
	};
}

export async function getDb() {
	if (db) return db;
	const SqlJs = await initSqlJs();
	const fileBuffer = existsSync(dbPath) ? readFileSync(dbPath) : null;
	db = new SqlJs.Database(fileBuffer);

	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			slug TEXT UNIQUE NOT NULL
		);

		CREATE TABLE IF NOT EXISTS games (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rawg_id INTEGER UNIQUE NOT NULL,
			name TEXT NOT NULL,
			released TEXT,
			image_url TEXT,
			genres TEXT,
			platforms TEXT,
			metacritic INTEGER,
			raw_json TEXT
		);

		CREATE TABLE IF NOT EXISTS user_played (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			game_id INTEGER NOT NULL,
			rating REAL NOT NULL,
			opinion TEXT,
			played_at TEXT NOT NULL,
			completed INTEGER NOT NULL DEFAULT 1,
			UNIQUE(user_id, game_id),
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (game_id) REFERENCES games(id)
		);

		CREATE TABLE IF NOT EXISTS user_pending (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			game_id INTEGER NOT NULL,
			added_at TEXT NOT NULL,
			UNIQUE(user_id, game_id),
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (game_id) REFERENCES games(id)
		);

		CREATE TABLE IF NOT EXISTS user_achievements (
			user_id INTEGER NOT NULL,
			achievement_id TEXT NOT NULL,
			unlocked_at TEXT NOT NULL,
			PRIMARY KEY (user_id, achievement_id),
			FOREIGN KEY (user_id) REFERENCES users(id)
		);

		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			from_user_id INTEGER NOT NULL,
			to_user_id INTEGER NOT NULL,
			body TEXT NOT NULL,
			game_id INTEGER,
			created_at TEXT NOT NULL,
			FOREIGN KEY (from_user_id) REFERENCES users(id),
			FOREIGN KEY (to_user_id) REFERENCES users(id),
			FOREIGN KEY (game_id) REFERENCES games(id)
		);
		CREATE TABLE IF NOT EXISTS push_subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			endpoint TEXT NOT NULL,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			UNIQUE(user_id),
			FOREIGN KEY (user_id) REFERENCES users(id)
		);
		CREATE TABLE IF NOT EXISTS released_notification_sent (
			user_id INTEGER NOT NULL,
			game_id INTEGER NOT NULL,
			sent_at TEXT NOT NULL,
			PRIMARY KEY (user_id, game_id),
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (game_id) REFERENCES games(id)
		);

		CREATE INDEX IF NOT EXISTS idx_user_played_user ON user_played(user_id);
		CREATE INDEX IF NOT EXISTS idx_user_played_played_at ON user_played(played_at);
		CREATE INDEX IF NOT EXISTS idx_user_pending_user ON user_pending(user_id);
		CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
		CREATE INDEX IF NOT EXISTS idx_messages_to_from ON messages(to_user_id, from_user_id);
	`);

	try {
		db.run("ALTER TABLE user_played ADD COLUMN completed INTEGER NOT NULL DEFAULT 1");
		save();
	} catch (_) {}
	try {
		db.run("ALTER TABLE users ADD COLUMN bio TEXT");
		save();
	} catch (_) {}
	try {
		db.run("ALTER TABLE users ADD COLUMN avatar TEXT");
		save();
	} catch (_) {}

	const countResult = db.exec("SELECT COUNT(*) as c FROM users");
	const c = countResult.length && countResult[0].values[0][0];
	if (c === 0) {
		db.run("INSERT INTO users (name, slug) VALUES (?, ?), (?, ?)", ["Pablo", "pablo", "Iñaki", "inaki"]);
		save();
	}

	const rawPrepare = db.prepare.bind(db);
	db.prepare = function (sql) {
		return wrapStmt(rawPrepare(sql));
	};

	return db;
}
