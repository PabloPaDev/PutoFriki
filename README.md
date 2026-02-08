# Juegos App

App de videojuegos para Pablo e Iñaki: elegir quién eres al entrar, buscar juegos (desde 2005), valorar los jugados con opinión, lista de pendientes y ranking por valoración o fecha. Los perfiles son visibles entre ambos usuarios.

## Requisitos

- Node.js 18+
- API key gratuita de [RAWG](https://rawg.io/apidocs) (para búsqueda e imágenes de juegos)

## Instalación

Backend y frontend son independientes. Instala cada uno en su carpeta:

```bash
# Backend
cd backend && npm install

# Frontend (en otra terminal o después)
cd frontend && npm install
```

## Configuración

En la carpeta `backend`, crea un archivo `.env` (copia de `.env.example`):

```bash
cd backend
copy .env.example .env
```

Edita `.env` y añade tu API key de RAWG:

```
PORT=3001
RAWG_API_KEY=tu_api_key_aqui
```

Obtén la key en: https://rawg.io/apidocs

## Uso

**Desarrollo:** ejecuta backend y frontend por separado (dos terminales).

```bash
# Terminal 1 – Backend
cd backend && npm run dev

# Terminal 2 – Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:5173 (el proxy de Vite reenvía `/api` al backend).
- Backend API: http://localhost:3001

**Producción local:** en `backend`: `npm start`. En `frontend`: `npm run build` y sirve la carpeta `dist` con un servidor estático.

---

## Despliegue

Backend y frontend se despliegan por separado.

| Parte    | Carpeta   | Servicio recomendado |
|----------|-----------|------------------------|
| **Backend**  | `backend/`  | **Render** (Web Service) |
| **Frontend** | `frontend/` | **Vercel** |

### Backend en Render

- **Root Directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Variables de entorno:** `PORT` (Render la asigna), `RAWG_API_KEY`, `CORS_ORIGIN` = URL del frontend en Vercel (ej. `https://tu-app.vercel.app`). Opcional: `DB_PATH` si usas disco persistente.

La base SQLite se crea en el entorno de Render (ephemeral por defecto). Para persistencia, considera un disco o servicio externo y `DB_PATH`.

### Frontend en Vercel

- **Root Directory:** `frontend`
- **Build command:** `npm run build`
- **Output directory:** `dist` (por defecto con Vite)
- **Variable de entorno (build):** `VITE_API_URL` = URL pública del backend en Render (ej. `https://tu-backend.onrender.com`). Sin ella, en producción las peticiones no encontrarán la API.

## Base de datos

SQLite con **sql.js** (sin compilación nativa; no hace falta Python ni build tools). El archivo `backend/juegos.db` se crea al arrancar el backend. Usuarios iniciales: Pablo e Iñaki.

## Funcionalidades

- **Entrada**: pregunta "¿Quién eres?" (Pablo / Iñaki).
- **Buscar**: búsqueda por nombre; resultados con género, año, imagen y Metacritic (juegos desde 2005).
- **Jugados**: añadir desde búsqueda con valoración (0–10) y opinión; se guardan en tu lista y en el ranking.
- **Pendientes**: añadir juegos a "por jugar".
- **Perfil**: ver tus jugados y pendientes; quitar elementos (solo en tu perfil).
- **Ranking**: tus juegos ordenados por valoración o por fecha.
- **Ver perfil del otro**: desde el menú, "Ver Pablo" / "Ver Iñaki" (solo lectura).
