import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrentUserSlug, useUser } from "../App";
import GameRow from "../components/GameRow";
import { apiBase } from "../api";
import {
	IconGamepadStats,
	IconStarStats,
	IconClockStats,
	IconCalendarStats,
	IconCircleSlashStats,
	IconPlayStats,
	IconChatStats,
	IconPlus,
} from "../components/Icons";
import { useToast } from "../components/ToastContext";
import { formatReleaseDate } from "../utils/formatReleaseDate";

const MAX_PREVIEW = 3;

const TABS = [
	{ key: "completados", label: "Completados", Icon: IconStarStats },
	{ key: "jugando", label: "Jugando", Icon: IconPlayStats },
	{ key: "abandonados", label: "Abandonados", Icon: IconCircleSlashStats },
	{ key: "pendientes", label: "Pendientes", Icon: IconClockStats },
	{ key: "esperados", label: "Wishlist", Icon: IconCalendarStats },
	{ key: "recomendados", label: "Recomendados", Icon: IconChatStats },
];

const today = () => {
	const t = new Date();
	t.setHours(0, 0, 0, 0);
	return t;
};

/** Ya han salido (fecha en el pasado) */
function isAlreadyReleased(released) {
	if (!released) return false;
	const d = new Date(released);
	if (Number.isNaN(d.getTime())) return false;
	d.setHours(0, 0, 0, 0);
	return d < today();
}

/** Aún no se han lanzado (fecha futura o sin fecha / por confirmar) */
function isUpcoming(released) {
	if (!released) return true;
	const d = new Date(released);
	if (Number.isNaN(d.getTime())) return true;
	d.setHours(0, 0, 0, 0);
	return d >= today();
}

export default function Dashboard() {
	const slug = useCurrentUserSlug();
	const { refreshJugadosTrigger, setRefreshJugadosTrigger } = useUser();
	const { addToast } = useToast();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabFromUrl = searchParams.get("tab");
	const validTab = TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : "completados";
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState(validTab);
	const [expanded, setExpanded] = useState({ completados: false, jugando: false, abandonados: false, pendientes: false, esperados: false, recomendados: false });
	const [recommendations, setRecommendations] = useState([]);
	const [recommendationsLoading, setRecommendationsLoading] = useState(false);
	const [actingRecId, setActingRecId] = useState(null);

	useEffect(() => {
		const t = searchParams.get("tab");
		setTab(TABS.some((x) => x.key === t) ? t : "completados");
	}, [searchParams]);

	useEffect(() => {
		if (!slug) return;
		setLoading(true);
		let cancelled = false;
		const timeoutId = setTimeout(() => {
			if (!cancelled) {
				setData(null);
				setLoading(false);
			}
		}, 12000);
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => { if (!cancelled) setData(d); })
			.catch(() => { if (!cancelled) setData(null); })
			.finally(() => {
				if (!cancelled) setLoading(false);
				clearTimeout(timeoutId);
			});
		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
		};
	}, [slug, refreshJugadosTrigger]);

	useEffect(() => {
		if (!slug || tab !== "recomendados") return;
		setRecommendationsLoading(true);
		fetch(`${apiBase}/api/users/${slug}/recommendations`)
			.then((r) => (r.ok ? r.json() : { recommendations: [] }))
			.then((d) => setRecommendations(d.recommendations || []))
			.catch(() => setRecommendations([]))
			.finally(() => setRecommendationsLoading(false));
	}, [slug, tab, refreshJugadosTrigger]);

	const refresh = () => {
		if (!slug) return;
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => r.json())
			.then((d) => {
				setData(d);
				setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => {});
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}
	if (!data) {
		return <p className="text-zinc-400 py-12">Error al cargar.</p>;
	}

	const { jugados, pendientes, jugando = [] } = data;
	const completadosTab = jugados.filter((g) => g.completed !== false);
	const abandonadosTab = jugados.filter((g) => g.completed === false);
	const pendientesTab = pendientes.filter((g) => isAlreadyReleased(g.released));
	const esperadosTab = pendientes.filter((g) => isUpcoming(g.released));
	const jugandoTab = Array.isArray(jugando) ? jugando : [];
	const total = jugados.length + pendientes.length + jugandoTab.length;

	const stats = [
		{ label: "Total", value: total, Icon: IconGamepadStats },
		{ label: "Completados", value: completadosTab.length, Icon: IconStarStats },
		{ label: "Jugando", value: jugandoTab.length, Icon: IconPlayStats },
		{ label: "Abandonados", value: abandonadosTab.length, Icon: IconCircleSlashStats },
		{ label: "Pendientes", value: pendientesTab.length, Icon: IconClockStats },
		{ label: "Wishlist", value: esperadosTab.length, Icon: IconCalendarStats },
	];

	const switchTab = (key) => {
		setTab(key);
		setSearchParams(key === "completados" ? {} : { tab: key });
	};

	const emptyMessages = {
		completados: "No hay juegos completados. Añade juegos desde Buscar y márcalos como completados.",
		jugando: "No hay juegos en curso. Añade desde Buscar a «Jugando» o mueve uno de Pendientes.",
		abandonados: "No hay juegos abandonados. Puedes marcar como abandonado desde la pestaña Completados.",
		pendientes: "No hay juegos pendientes que ya hayan salido. Añade juegos lanzados desde Buscar.",
		esperados: "No hay juegos por salir. Añade pendientes con fecha futura o por confirmar desde Buscar.",
		recomendados: "No tienes recomendaciones. Cuando alguien te recomiende un juego aparecerá aquí.",
	};

	const listByTab = {
		completados: completadosTab,
		jugando: jugandoTab,
		abandonados: abandonadosTab,
		pendientes: pendientesTab,
		esperados: esperadosTab,
		recomendados: recommendations,
	};
	const currentList = listByTab[tab];

	const gamePayload = (g) => ({
		rawg_id: Number(g.rawg_id) ?? g.rawg_id,
		name: g.name,
		released: g.released ?? null,
		image_url: g.image_url ?? null,
		genres: g.genres ?? [],
	});

	const handleAddRecommended = (messageId, listType, game) => {
		if (!slug || !game?.rawg_id) return;
		setActingRecId(`${messageId}-${listType}`);
		const endpoint = listType === "jugando" ? "jugando" : "pendientes";
		fetch(`${apiBase}/api/users/${slug}/${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(gamePayload(game)),
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
				addToast({ title: "Añadido", description: listType === "jugando" ? "Añadido a Jugando" : "Añadido a tu lista" });
				setRefreshJugadosTrigger?.((t) => t + 1);
				return fetch(`${apiBase}/api/users/${slug}/recommendations/${messageId}/dismiss`, { method: "POST" });
			})
			.then((r) => r?.ok && setRecommendations((prev) => prev.filter((r) => r.id !== messageId)))
			.catch(() => addToast({ title: "Error", description: "No se pudo añadir" }))
			.finally(() => setActingRecId(null));
	};

	const handleDismissRecommendation = (messageId) => {
		if (!slug) return;
		setActingRecId(`dismiss-${messageId}`);
		fetch(`${apiBase}/api/users/${slug}/recommendations/${messageId}/dismiss`, { method: "POST" })
			.then((r) => r.ok && setRecommendations((prev) => prev.filter((r) => r.id !== messageId)))
			.finally(() => setActingRecId(null));
	};
	const isCompletados = tab === "completados";
	const isAbandonados = tab === "abandonados";
	const isJugando = tab === "jugando";
	const isJugadoTab = isCompletados || isAbandonados;
	const displayedList = currentList.slice(0, expanded[tab] ? currentList.length : MAX_PREVIEW);
	const hasMore = currentList.length > MAX_PREVIEW;
	const showVerMas = hasMore && !expanded[tab];

	return (
		<>
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
				{stats.map((s) => (
					<div
						key={s.label}
						className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 flex items-center gap-3"
					>
						<s.Icon className="text-zinc-600" aria-hidden />
						<div>
							<p className="text-zinc-600 text-sm">{s.label}</p>
							<p className="text-xl font-bold text-white">{s.value}</p>
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2 mb-6 rounded-2xl bg-zinc-900/85 border border-zinc-800 p-3">
				{TABS.map(({ key, label, Icon }) => (
					<button
						key={key}
						type="button"
						onClick={() => switchTab(key)}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
							tab === key
								? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
								: "text-zinc-200 hover:text-white hover:bg-zinc-800"
						}`}
					>
						<Icon className="text-current" size={18} strokeWidth={1.8} aria-hidden />
						{label}
					</button>
				))}
			</div>
			<div className="space-y-4">
				{tab === "recomendados" ? (
					<>
						{recommendationsLoading ? (
							<p className="text-zinc-500 text-center py-12">Cargando recomendaciones…</p>
						) : recommendations.length === 0 ? (
							<p className="text-zinc-600 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
								{emptyMessages.recomendados}
							</p>
						) : (
							recommendations.map((rec) => (
								<div
									key={rec.id}
									className="flex gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors"
								>
									{rec.game?.image_url && (
										<img
											src={rec.game.image_url}
											alt=""
											className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded-lg flex-shrink-0 shadow-md"
										/>
									)}
									<div className="flex-1 min-w-0">
										<h3 className="text-base sm:text-lg font-semibold text-white mb-0.5">{rec.game?.name ?? "Juego"}</h3>
										<p className="text-zinc-500 text-xs sm:text-sm mb-2">
											Te lo recomendó <span className="text-zinc-400 font-medium">{rec.from?.name}</span>
											{rec.created_at && (
												<span className="text-zinc-600 ml-1">
													· {new Date(rec.created_at).toLocaleDateString("es")}
												</span>
											)}
										</p>
										{rec.game?.released && (
											<p className="text-zinc-500 text-xs mb-2">{formatReleaseDate(rec.game.released)}</p>
										)}
										<div className="flex flex-wrap gap-2 mt-2">
											<button
												type="button"
												onClick={() => handleAddRecommended(rec.id, "pendientes", rec.game)}
												disabled={!!actingRecId}
												className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
											>
												{actingRecId === `${rec.id}-pendientes` ? "…" : isUpcoming(rec.game?.released) ? "Wishlist" : "Pendiente"}
											</button>
											<button
												type="button"
												onClick={() => handleAddRecommended(rec.id, "jugando", rec.game)}
												disabled={!!actingRecId}
												className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/90 text-white hover:bg-amber-500 disabled:opacity-50"
											>
												{actingRecId === `${rec.id}-jugando` ? "…" : "Jugando"}
											</button>
											<button
												type="button"
												onClick={() => handleDismissRecommendation(rec.id)}
												disabled={!!actingRecId}
												className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 disabled:opacity-50"
											>
												{actingRecId === `dismiss-${rec.id}` ? "…" : "Descartar"}
											</button>
										</div>
									</div>
								</div>
							))
						)}
					</>
				) : currentList.length === 0 ? (
					<p className="text-zinc-600 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
						{emptyMessages[tab]}
					</p>
				) : (
					<>
						{displayedList.map((g) => (
							<GameRow
								key={g.game_id}
								game={g}
								isJugado={isJugadoTab}
								isJugandoTab={isJugando}
								isPendientesTab={tab === "pendientes" || tab === "esperados"}
								isCompletadosTab={isCompletados}
								isAbandonadosTab={isAbandonados}
								isOwn
								slug={slug}
								onRemove={refresh}
							/>
						))}
						{showVerMas && (
							<div className="flex justify-center pt-2">
								<button
									type="button"
									onClick={() => setExpanded((e) => ({ ...e, [tab]: true }))}
									className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
									aria-label={`Ver todos (${currentList.length - MAX_PREVIEW} más)`}
								>
									<IconPlus className="text-current" size={18} strokeWidth={1.8} aria-hidden />
									+ Ver todos ({currentList.length - MAX_PREVIEW} más)
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
