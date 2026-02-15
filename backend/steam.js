/**
 * Steam OpenID 2.0 y Steam Web API.
 * Requiere STEAM_API_KEY en .env (obtener en https://steamcommunity.com/dev/apikey).
 * BACKEND_URL o baseUrl para el callback de OpenID (ej. https://tu-api.onrender.com).
 */

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const STEAM_API_BASE = "https://api.steampowered.com";

/**
 * Genera la URL a la que redirigir al usuario para login con Steam.
 * @param {string} returnTo - URL absoluta del callback (backend), ej. https://api.com/api/users/pablo/steam/callback
 * @param {string} realm - Origen del sitio (ej. https://tu-app.vercel.app)
 */
export function getSteamLoginUrl(returnTo, realm) {
	const params = new URLSearchParams({
		"openid.ns": "http://specs.openid.net/auth/2.0",
		"openid.mode": "checkid_setup",
		"openid.return_to": returnTo,
		"openid.realm": realm || returnTo,
		"openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
		"openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
	});
	return `${STEAM_OPENID}?${params.toString()}`;
}

/**
 * Valida la respuesta de Steam y extrae el Steam ID (64-bit).
 * @param {URLSearchParams} query - Parámetros GET del callback
 * @returns {Promise<string|null>} Steam ID o null si falla
 */
export async function validateSteamCallback(query) {
	const params = new URLSearchParams();
	params.set("openid.mode", "check_authentication");
	for (const [key, value] of query.entries()) {
		if (key.startsWith("openid.")) params.set(key, value);
	}
	const res = await fetch(STEAM_OPENID, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	});
	const text = await res.text();
	if (!text.includes("is_valid:true")) return null;
	const claimed = query.get("openid.claimed_id");
	if (!claimed) return null;
	const match = claimed.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
	return match ? match[1] : null;
}

/**
 * Obtiene resumen del perfil Steam (avatar, nombre, etc.).
 */
export async function getSteamPlayerSummaries(apiKey, steamIds) {
	if (!apiKey || !steamIds) return null;
	const ids = Array.isArray(steamIds) ? steamIds.join(",") : String(steamIds);
	const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${ids}`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	return data?.response?.players?.[0] || null;
}

/**
 * Juegos jugados recientemente (últimas 2 semanas por defecto).
 */
export async function getRecentlyPlayedGames(apiKey, steamId) {
	if (!apiKey || !steamId) return [];
	const url = `${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}`;
	const res = await fetch(url);
	if (!res.ok) return [];
	const data = await res.json();
	return data?.response?.games || [];
}

/**
 * Biblioteca completa (juegos que posee el usuario). Respeta privacidad del perfil Steam.
 */
export async function getOwnedGames(apiKey, steamId, opts = {}) {
	if (!apiKey || !steamId) return [];
	const includeAppInfo = opts.includeAppInfo !== false ? "1" : "0";
	const includePlayedFreeGames = opts.includePlayedFreeGames ? "1" : "0";
	const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=${includeAppInfo}&include_played_free_games=${includePlayedFreeGames}`;
	const res = await fetch(url);
	if (!res.ok) return [];
	const data = await res.json();
	return data?.response?.games || [];
}

/**
 * Logros del usuario para un juego (appid).
 */
export async function getPlayerAchievements(apiKey, steamId, appId) {
	if (!apiKey || !steamId || !appId) return null;
	const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=${appId}&l=spanish`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	return data?.playerstats || null;
}

/**
 * Esquema del juego (nombres e iconos de logros).
 */
export async function getSchemaForGame(apiKey, appId) {
	if (!apiKey || !appId) return null;
	const url = `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}&l=spanish`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	return data?.game || null;
}
