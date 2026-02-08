/**
 * Genera iconos PWA (192 y 512) desde Logo.png con fondo blanco.
 * Uso: node scripts/generate-pwa-icons.js
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "images", "Logo.png");
const outDir = join(root, "public", "icons");

const BLACK_THRESHOLD = 45;

async function main() {
	if (!existsSync(logoPath)) {
		console.error("No se encuentra public/images/Logo.png");
		process.exit(1);
	}
	if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

	const img = sharp(logoPath);
	const meta = await img.metadata();
	const { width, height } = meta;
	const raw = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { data, info } = raw;
	const channels = info.channels;

	for (let i = 0; i < data.length; i += channels) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
			data[i] = 255;
			data[i + 1] = 255;
			data[i + 2] = 255;
		}
	}

	const rawOpt = { width: info.width, height: info.height, channels: info.channels };
	await sharp(data, { raw: rawOpt }).png().resize(512, 512).toFile(join(outDir, "icon-512.png"));
	await sharp(data, { raw: rawOpt }).png().resize(192, 192).toFile(join(outDir, "icon-192.png"));
	console.log("Iconos PWA generados: icon-192.png, icon-512.png (fondo blanco)");
}

main().catch((err) => {
	console.error(err.message || err);
	process.exit(1);
});
