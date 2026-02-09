import cron from "node-cron";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, "juegos.db");

function runDailyBackup() {
	const backupDir = join(dirname(dbPath), "backups");
	const date = new Date().toISOString().slice(0, 10);
	const dest = join(backupDir, `juegos_${date}.db`);

	if (!existsSync(dbPath)) {
		console.warn("[Backup] No se encontró la base de datos en", dbPath);
		return;
	}
	if (existsSync(dest)) {
		return;
	}
	try {
		if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
		copyFileSync(dbPath, dest);
		console.log("[Backup] Copia diaria creada:", dest);
	} catch (err) {
		console.error("[Backup] Error:", err.message);
	}
}

export function startBackupCron() {
	cron.schedule("0 3 * * *", runDailyBackup, { timezone: "Europe/Madrid" });
}
