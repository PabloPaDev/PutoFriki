/**
 * Base URL para las peticiones al backend.
 * En desarrollo sin VITE_API_URL se usa ruta relativa (/api) y el proxy de Vite.
 * En producción configurar VITE_API_URL con la URL del backend.
 */
export const apiBase = import.meta.env.VITE_API_URL || "";

/**
 * URL base para WebSocket. En desarrollo con proxy usamos el mismo host y puerto del backend.
 * Si VITE_WS_URL está definida se usa; si no, se deriva de VITE_API_URL (http->ws, https->wss).
 */
function getWsBase() {
	if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
	const api = import.meta.env.VITE_API_URL || "";
	if (api.startsWith("https")) return api.replace(/^https/, "wss").replace(/\/?$/, "");
	if (api.startsWith("http")) return api.replace(/^http/, "ws").replace(/\/?$/, "");
	// Sin API URL (proxy): mismo origin, protocol ws
	const { protocol, host } = window.location;
	const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
	return `${wsProtocol}//${host}`;
}
export const wsBase = typeof window !== "undefined" ? getWsBase() : "";
