import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUserSlug, useUser } from "../App";
import { useToast } from "../components/ToastContext";
import { apiBase } from "../api";
import { formatReleaseDate } from "../utils/formatReleaseDate";

function GameResult({ game, onAddJugado, onAddPendiente }) {
	const [showForm, setShowForm] = useState(false);
	const [rating, setRating] = useState(7);
	const [opinion, setOpinion] = useState("");
	const [abandoned, setAbandoned] = useState(false);
	const slug = useCurrentUserSlug();
	const navigate = useNavigate();
	const { setRefreshJugadosTrigger } = useUser();
	const { addToast } = useToast();

	const releaseLabel = formatReleaseDate(game.released);
	const genres = Array.isArray(game.genres) ? game.genres.join(", ") : game.genres || "—";

	const handleAddJugado = (e) => {
		e.preventDefault();
		fetch(`${apiBase}/api/users/${slug}/jugados`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				rawg_id: game.rawg_id,
				name: game.name,
				released: game.released,
				image_url: game.image_url,
				genres: game.genres,
				platforms: game.platforms,
				metacritic: game.metacritic,
				rating: Number(rating),
				opinion: opinion.trim() || null,
				completed: !abandoned,
			}),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data.error) {
					alert(data?.error || "Error al guardar");
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				setShowForm(false);
				onAddJugado?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
				navigate(abandoned ? "/?tab=abandonados" : "/ranking", { replace: false });
			})
			.catch(() => alert("Error al añadir. ¿Está el backend en marcha?"));
	};

	const handleAddPendiente = () => {
		fetch(`${apiBase}/api/users/${slug}/pendientes`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				rawg_id: game.rawg_id,
				name: game.name,
				released: game.released,
				image_url: game.image_url,
				genres: game.genres,
				platforms: game.platforms,
				metacritic: game.metacritic,
			}),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data.error) {
					alert(data?.error || "Error al guardar");
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				onAddPendiente?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
				navigate("/perfil?tab=pendientes", { replace: false });
			})
			.catch(() => alert("Error al añadir. ¿Está el backend en marcha?"));
	};

	return (
		<div className="flex gap-5 sm:gap-6 p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
			{game.image_url && (
				<img
					src={game.image_url}
					alt=""
					className="w-32 h-44 sm:w-40 sm:h-56 object-cover rounded-xl flex-shrink-0 shadow-lg"
				/>
			)}
			<div className="flex-1 min-w-0">
				<h3 className="text-lg sm:text-xl font-semibold text-white mb-1">{game.name}</h3>
				<p className="text-zinc-400 text-sm sm:text-base mb-3">
					{releaseLabel} · {genres}
					{game.metacritic != null && (
						<span className="text-amber-400/90 ml-1">· Metacritic {game.metacritic}</span>
					)}
				</p>
				{!showForm ? (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setShowForm(true)}
							className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-500 transition-colors"
						>
							Lo he jugado (valorar)
						</button>
						<button
							type="button"
							onClick={handleAddPendiente}
							className="px-4 py-2 rounded-xl text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
						>
							Pendiente
						</button>
					</div>
				) : (
					<form onSubmit={handleAddJugado} className="space-y-3 mt-2">
						<div>
							<label className="block text-zinc-400 text-sm font-medium mb-1">
								Valoración (0-10)
							</label>
							<input
								type="number"
								min="0"
								max="10"
								step="0.5"
								value={rating}
								onChange={(e) => setRating(e.target.value)}
								className="w-full max-w-[120px] px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
							/>
						</div>
						<div>
							<label className="block text-zinc-400 text-sm font-medium mb-1">
								Opinión (opcional)
							</label>
							<textarea
								rows={2}
								value={opinion}
								onChange={(e) => setOpinion(e.target.value)}
								placeholder="Tu opinión..."
								className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
							/>
						</div>
						<label className="flex items-center gap-2 text-zinc-400 text-sm cursor-pointer">
							<input
								type="checkbox"
								checked={abandoned}
								onChange={(e) => setAbandoned(e.target.checked)}
								className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-orange-500"
							/>
							Lo abandoné (no lo completé)
						</label>
						<div className="flex gap-2">
							<button
								type="submit"
								className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-500 transition-colors"
							>
								Guardar
							</button>
							<button
								type="button"
								onClick={() => setShowForm(false)}
								className="px-4 py-2 rounded-xl text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
							>
								Cancelar
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

export default function Buscar() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const search = (e) => {
		e?.preventDefault();
		const q = query.trim();
		if (!q) return;
		setLoading(true);
		setError(null);
		fetch(`${apiBase}/api/games/search?q=${encodeURIComponent(q)}`)
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				setResults(data.results || []);
				const err = data.error;
				if (err) setError(err === "Búsqueda no disponible" ? "La búsqueda de juegos no está disponible en este momento. Inténtalo más tarde." : err);
				if (!ok && !err) setError("Error en la búsqueda");
			})
			.catch(() => {
				setError("No se pudo conectar con el servidor. ¿Está el backend en marcha (puerto 3001)?");
				setResults([]);
			})
			.finally(() => setLoading(false));
	};

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Buscar juegos</h1>
			<p className="text-zinc-400 mb-6">
				Juegos desde 2005. Al buscar verás nombre, género, año y más.
			</p>
			<form onSubmit={search} className="mb-8">
				<div className="flex flex-wrap gap-3">
					<input
						type="text"
						placeholder="Nombre del juego..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="flex-1 min-w-[200px] max-w-md px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
					/>
					<button
						type="submit"
						disabled={loading}
						className="px-6 py-3 rounded-xl font-medium bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? "Buscando…" : "Buscar"}
					</button>
				</div>
			</form>
			{error && (
				<p className="text-amber-400 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2">
					{error}
				</p>
			)}
			<div className="space-y-4">
				{results.length === 0 && !loading && query.trim() && !error && (
					<p className="text-zinc-500 text-center py-12">Sin resultados. Prueba otro nombre.</p>
				)}
				{results.map((g) => (
					<GameResult key={g.rawg_id} game={g} />
				))}
			</div>
		</>
	);
}
