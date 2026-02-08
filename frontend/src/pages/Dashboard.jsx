import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useCurrentUserSlug, useUser } from "../App";
import GameRow from "../components/GameRow";
import { apiBase } from "../api";
import {
	IconGamepadStats,
	IconStarStats,
	IconClockStats,
	IconCalendarStats,
	IconCircleSlashStats,
	IconPlus,
} from "../components/Icons";

const MAX_PREVIEW = 3;

const TABS = [
	{ key: "completados", label: "Completados", Icon: IconStarStats },
	{ key: "abandonados", label: "Abandonados", Icon: IconCircleSlashStats },
	{ key: "pendientes", label: "Pendientes", Icon: IconClockStats },
	{ key: "esperados", label: "Esperados", Icon: IconCalendarStats },
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
	const { setRefreshJugadosTrigger } = useUser();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabFromUrl = searchParams.get("tab");
	const validTab = TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : "completados";
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState(validTab);
	const [expanded, setExpanded] = useState({ completados: false, abandonados: false, pendientes: false, esperados: false });

	useEffect(() => {
		const t = searchParams.get("tab");
		setTab(TABS.some((x) => x.key === t) ? t : "completados");
	}, [searchParams]);

	useEffect(() => {
		if (!slug) return;
		setLoading(true);
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => (r.ok ? r.json() : null))
			.then(setData)
			.catch(() => setData(null))
			.finally(() => setLoading(false));
	}, [slug]);

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

	const { jugados, pendientes } = data;
	const completadosTab = jugados.filter((g) => g.completed !== false);
	const abandonadosTab = jugados.filter((g) => g.completed === false);
	const pendientesTab = pendientes.filter((g) => isAlreadyReleased(g.released));
	const esperadosTab = pendientes.filter((g) => isUpcoming(g.released));
	const total = jugados.length + pendientes.length;

	const stats = [
		{ label: "Total", value: total, Icon: IconGamepadStats },
		{ label: "Completados", value: completadosTab.length, Icon: IconStarStats },
		{ label: "Abandonados", value: abandonadosTab.length, Icon: IconCircleSlashStats },
		{ label: "Pendientes", value: pendientesTab.length, Icon: IconClockStats },
		{ label: "Esperados", value: esperadosTab.length, Icon: IconCalendarStats },
	];

	const switchTab = (key) => {
		setTab(key);
		setSearchParams(key === "completados" ? {} : { tab: key });
	};

	const emptyMessages = {
		completados: "No hay juegos completados. Añade juegos desde Buscar y márcalos como completados.",
		abandonados: "No hay juegos abandonados. Puedes marcar como abandonado desde la pestaña Completados.",
		pendientes: "No hay juegos pendientes que ya hayan salido. Añade juegos lanzados desde Buscar.",
		esperados: "No hay juegos por salir. Añade pendientes con fecha futura o por confirmar desde Buscar.",
	};

	const listByTab = {
		completados: completadosTab,
		abandonados: abandonadosTab,
		pendientes: pendientesTab,
		esperados: esperadosTab,
	};
	const currentList = listByTab[tab];
	const isCompletados = tab === "completados";
	const isAbandonados = tab === "abandonados";
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
						<s.Icon className="text-zinc-400" aria-hidden />
						<div>
							<p className="text-zinc-500 text-sm">{s.label}</p>
							<p className="text-xl font-bold text-white">{s.value}</p>
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2 mb-6 border-b border-zinc-800 pb-3">
				{TABS.map(({ key, label, Icon }) => (
					<button
						key={key}
						type="button"
						onClick={() => switchTab(key)}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
							tab === key
								? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
								: "text-zinc-400 hover:text-white hover:bg-zinc-800"
						}`}
					>
						<Icon className="text-current" size={18} strokeWidth={1.8} aria-hidden />
						{label}
					</button>
				))}
				<Link
					to="/buscar"
					className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors ml-auto"
				>
					<IconPlus className="text-current" size={18} strokeWidth={1.8} aria-hidden />
					Añadir
				</Link>
			</div>
			<div className="space-y-4">
				{currentList.length === 0 ? (
					<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
						{emptyMessages[tab]}
					</p>
				) : (
					<>
						{displayedList.map((g) => (
							<GameRow
								key={g.game_id}
								game={g}
								isJugado={isJugadoTab}
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
