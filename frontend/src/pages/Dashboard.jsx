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
	IconPlus,
} from "../components/Icons";

const MAX_PREVIEW = 3;

const TABS = [
	{ key: "jugados", label: "Jugados", Icon: IconStarStats },
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
	const validTab = TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : "jugados";
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState(validTab);
	const [expanded, setExpanded] = useState({ pendientes: false, esperados: false });

	useEffect(() => {
		const t = searchParams.get("tab");
		setTab(TABS.some((x) => x.key === t) ? t : "jugados");
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
	const pendientesTab = pendientes.filter((g) => isAlreadyReleased(g.released));
	const esperadosTab = pendientes.filter((g) => isUpcoming(g.released));
	const total = jugados.length + pendientes.length;

	const stats = [
		{ label: "Total", value: total, Icon: IconGamepadStats },
		{ label: "Jugados", value: jugados.length, Icon: IconStarStats },
		{ label: "Pendientes", value: pendientesTab.length, Icon: IconClockStats },
		{ label: "Esperados", value: esperadosTab.length, Icon: IconCalendarStats },
	];

	const switchTab = (key) => {
		setTab(key);
		setSearchParams(key === "jugados" ? {} : { tab: key });
	};

	const emptyMessages = {
		jugados: "No hay juegos jugados. Agrega juegos que ya hayas completado y califícalos.",
		pendientes: "No hay juegos pendientes que ya hayan salido. Añade juegos lanzados desde Buscar.",
		esperados: "No hay juegos por salir. Añade pendientes con fecha futura o por confirmar desde Buscar.",
	};

	const listByTab = {
		jugados,
		pendientes: pendientesTab,
		esperados: esperadosTab,
	};
	const currentList = listByTab[tab];
	const isJugados = tab === "jugados";
	const displayedList = isJugados
		? currentList.slice(0, MAX_PREVIEW)
		: currentList.slice(0, expanded[tab] ? currentList.length : MAX_PREVIEW);
	const hasMore = currentList.length > MAX_PREVIEW;
	const showVerMas = hasMore && (isJugados || !expanded[tab]);

	return (
		<>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
								? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
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
								isJugado={tab === "jugados"}
								isOwn
								slug={slug}
								onRemove={refresh}
							/>
						))}
						{showVerMas && (
							<div className="flex justify-center pt-2">
								{isJugados ? (
									<Link
										to="/ranking"
										className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
									>
										<IconPlus className="text-current" size={18} strokeWidth={1.8} aria-hidden />
										Ver más en Top juegos
									</Link>
								) : (
									<button
										type="button"
										onClick={() => setExpanded((e) => ({ ...e, [tab]: true }))}
										className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors"
									>
										<IconPlus className="text-current" size={18} strokeWidth={1.8} aria-hidden />
										Ver más
									</button>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
