/**
 * Script de solo lectura para inspeccionar la base de datos.
 * No modifica nada. Ejecutar: node inspect-db.js
 */
import initSqlJs from "sql.js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, "juegos.db");

if (!existsSync(dbPath)) {
	console.log("No existe el archivo:", dbPath);
	process.exit(1);
}

const SqlJs = await initSqlJs();
const fileBuffer = readFileSync(dbPath);
const db = new SqlJs.Database(fileBuffer);

const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("=== TABLAS Y REGISTROS ===\n");
for (const t of tables[0].values) {
	const name = t[0];
	const count = db.exec(`SELECT COUNT(*) FROM "${name}"`);
	const n = count[0].values[0][0];
	console.log(`${name}: ${n} filas`);
}

console.log("\n=== USUARIOS ===\n");
const users = db.exec("SELECT id, name, slug FROM users");
if (users[0] && users[0].values.length) {
	users[0].values.forEach((r) => console.log(`  id=${r[0]} name=${r[1]} slug=${r[2]}`));
} else {
	console.log("  (ninguno)");
}

console.log("\n=== JUEGOS (games) ===\n");
const games = db.exec("SELECT id, rawg_id, name FROM games LIMIT 10");
if (games[0] && games[0].values.length) {
	games[0].values.forEach((r) => console.log(`  id=${r[0]} rawg_id=${r[1]} ${r[2]}`));
	const total = db.exec("SELECT COUNT(*) FROM games");
	console.log("  ... total:", total[0].values[0][0]);
} else {
	console.log("  (ninguno)");
}

console.log("\n=== JUGADOS (user_played) ===\n");
const played = db.exec("SELECT COUNT(*) FROM user_played");
console.log("  total:", played[0].values[0][0]);

console.log("\n=== PENDIENTES (user_pending) ===\n");
const pending = db.exec("SELECT COUNT(*) FROM user_pending");
console.log("  total:", pending[0].values[0][0]);

console.log("\n=== INSIGNIAS (user_achievements) ===\n");
const achievements = db.exec("SELECT user_id, achievement_id, unlocked_at FROM user_achievements");
if (achievements[0] && achievements[0].values.length) {
	achievements[0].values.forEach((r) => console.log(`  user_id=${r[0]} achievement=${r[1]} ${r[2]}`));
} else {
	console.log("  (ninguno)");
}

db.close();
console.log("\n--- Inspección terminada (solo lectura) ---");
