import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUserSlug, useUser } from "../App";
import { useToast } from "../components/ToastContext";
import { apiBase } from "../api";
import { formatReleaseDate } from "../utils/formatReleaseDate";

function gamePayload(g) {
	return {
		rawg_id: Number(g.rawg_id) || g.rawg_id,
		name: g.name ?? "",
		released: g.released ?? null,
		image_url: g.image_url ?? null,
		genres: g.genres ?? [],
		platforms: g.platforms ?? [],
		metacritic: g.metacritic ?? null,
	};
}

function BrainCard({ item, slug, onAdded, setRefreshJugadosTrigger, addToast }) {
	const [savingPendiente, setSavingPendiente] = useState(false);
	const [savingJugando, setSavingJugando] = useState(false);
	const navigate = useNavigate();
	const g = item;
	const saving = savingPendiente || savingJugando;
	const canAdd = !!slug && !saving;

	const handlePendiente = () => {
		if (!slug || savingPendiente) return;
		setSavingPendiente(true);
		fetch(`${apiBase}/api/users/${slug}/pendientes`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(gamePayload(g)),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data?.error) {
					addToast({ title: "Error", description: data?.error || "No se pudo añadir" });
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				addToast({ title: "Añadido", description: "Añadido a tu lista" });
				setRefreshJugadosTrigger?.((t) => t + 1);
				onAdded?.();
				navigate("/?tab=pendientes", { replace: false });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo añadir" }))
			.finally(() => setSavingPendiente(false));
	};

	const handleJugando = () => {
		if (!slug || savingJugando) return;
		setSavingJugando(true);
		fetch(`${apiBase}/api/users/${slug}/jugando`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(gamePayload(g)),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data?.error) {
					addToast({ title: "Error", description: data?.error || "No se pudo añadir" });
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				addToast({ title: "Añadido", description: "Añadido a Jugando" });
				setRefreshJugadosTrigger?.((t) => t + 1);
				onAdded?.();
				navigate("/?tab=jugando", { replace: false });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo añadir" }))
			.finally(() => setSavingJugando(false));
	};

	const genres = Array.isArray(g.genres) ? g.genres.join(", ") : g.genres || "—";

	return (
		<div className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
			{g.image_url && (
				<img
					src={g.image_url}
					alt=""
					className="w-24 h-32 sm:w-28 sm:h-40 object-cover rounded-lg flex-shrink-0 shadow-md"
				/>
			)}
			<div className="flex-1 min-w-0">
				<h3 className="text-base sm:text-lg font-semibold text-white mb-0.5">{g.name}</h3>
				<p className="text-amber-400/90 text-xs sm:text-sm mb-1">{g.reason}</p>
				<p className="text-zinc-500 text-xs sm:text-sm mb-2">
					{formatReleaseDate(g.released)} · {genres}
					{g.metacritic != null && (
						<span className="text-amber-400/80 ml-1">· Metacritic {g.metacritic}</span>
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={handlePendiente}
						disabled={!canAdd}
						className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{savingPendiente ? "…" : "Pendiente"}
					</button>
					<button
						type="button"
						onClick={handleJugando}
						disabled={!canAdd}
						className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/90 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{savingJugando ? "…" : "Jugando"}
					</button>
				</div>
			</div>
		</div>
	);
}

export default function Cerebro() {
	const slug = useCurrentUserSlug();
	const { setRefreshJugadosTrigger } = useUser();
	const { addToast } = useToast();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState({ recommendations: [], profile: { topGenres: [] } });

	const refresh = () => {
		if (!slug) return;
		setLoading(true);
		fetch(`${apiBase}/api/users/${slug}/brain`)
			.then((r) => (r.ok ? r.json() : { recommendations: [], profile: { topGenres: [] } }))
			.then(setData)
			.catch(() => setData({ recommendations: [], profile: { topGenres: [] } }))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		if (!slug) return;
		setLoading(true);
		fetch(`${apiBase}/api/users/${slug}/brain`)
			.then((r) => (r.ok ? r.json() : { recommendations: [], profile: { topGenres: [] } }))
			.then(setData)
			.catch(() => setData({ recommendations: [], profile: { topGenres: [] } }))
			.finally(() => setLoading(false));
	}, [slug]);

	if (!slug) {
		return (
			<div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-8 text-center text-zinc-500">
				Inicia sesión para ver tus recomendaciones.
			</div>
		);
	}

	const { recommendations, profile } = data;
	const topGenres = profile?.topGenres || [];

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">El Cerebro</h1>
			<p className="text-zinc-400 mb-6">
				Recomendaciones según lo que juegas, tienes pendiente y lo que te gusta. También próximos lanzamientos.
			</p>

			{topGenres.length > 0 && (
				<p className="text-zinc-500 text-sm mb-6 rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-2">
					Te conocemos por: <span className="text-zinc-300 font-medium">{topGenres.join(", ")}</span>
				</p>
			)}

			{loading ? (
				<p className="text-zinc-500 text-center py-12">Cargando recomendaciones…</p>
			) : recommendations.length === 0 ? (
				<div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-8 text-center text-zinc-500">
					<p className="mb-2">Aún no hay recomendaciones para ti.</p>
					<p className="text-sm">
						Añade juegos a <strong>Jugados</strong> o <strong>Pendientes</strong> para que te conozcamos mejor y te recomendemos según tus gustos.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{recommendations.map((item) => (
						<BrainCard
							key={item.rawg_id}
							item={item}
							slug={slug}
							onAdded={refresh}
							setRefreshJugadosTrigger={setRefreshJugadosTrigger}
							addToast={addToast}
						/>
					))}
				</div>
			)}
		</>
	);
}
