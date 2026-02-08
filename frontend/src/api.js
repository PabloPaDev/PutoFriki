/**
 * Base URL para las peticiones al backend.
 * En desarrollo sin VITE_API_URL se usa ruta relativa (/api) y el proxy de Vite.
 * En producción (Vercel) configurar VITE_API_URL con la URL del backend (Render).
 */
export const apiBase = import.meta.env.VITE_API_URL || "";
