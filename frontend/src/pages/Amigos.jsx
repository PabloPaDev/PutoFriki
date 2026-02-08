import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
	Trophy,
	List,
	CircleSlash,
	Calendar,
	Archive,
	Tag,
	User,
	Plus,
	Ghost,
	Swords,
	Target,
	Building2,
	Leaf,
	Map,
	Lock,
} from "lucide-react";
import { useUser, useCurrentUserSlug } from "../App";
import { apiBase } from "../api";

const ACHIEVEMENT_ICONS = {
	trophy: Trophy,
	list: List,
	"circle-slash": CircleSlash,
	calendar: Calendar,
	archive: Archive,
	tag: Tag,
	user: User,
	ghost: Ghost,
	sword: Swords,
	target: Target,
	building2: Building2,
	leaf: Leaf,
	map: Map,
	lock: Lock,
};

const RARITY_CLASSES = {
	common: "bg-zinc-600/90 border-zinc-500 text-zinc-200",
	uncommon: "bg-amber-800/90 border-amber-700 text-amber-200",
	rare: "bg-red-900/90 border-red-800 text-red-200",
};

const LOCKED_CLASS = "bg-zinc-700/90 border-zinc-600 text-zinc-500";
const UNLOCKED_CLASS = "bg-orange-600/90 border-orange-500 text-orange-100";

const DIFFICULTY_ORDER = ["easy", "medium", "hard", "insane"];
const SECTION_ORDER = [
	"mensual",
	"anual",
	"general",
	"terror",
	"soulslike",
	"rpg",
	"hack_and_slash",
	"shooters",
	"strategy",
	"indies",
	"metroidvania",
	"abandonment",
	"hidden",
];
const SECTION_LABELS = {
	mensual: "Mensual",
	anual: "Anual",
	general: "Todo el tiempo",
	terror: "Terror",
	soulslike: "Soulslike",
	rpg: "RPG",
	hack_and_slash: "Hack and Slash",
	shooters: "Shooters",
	strategy: "Estrategia / Gestión",
	indies: "Indies",
	metroidvania: "Metroidvania",
	abandonment: "Abandonados, como tu por tus padres",
	hidden: "Ocultos",
};

const MAIN_UNLOCKED_COUNT = 5;
const BADGES_PER_ROW = 5;

const PERIODS = [
	{ key: "month", label: "Mensual" },
	{ key: "year", label: "Anual" },
	{ key: "all", label: "Histórico" },
];

function periodDescription(period, since) {
	if (period === "month") {
		const d = since ? new Date(since) : new Date();
		return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
	}
	if (period === "year") {
		const d = since ? new Date(since) : new Date();
		return d.getFullYear().toString();
	}
	return "Todos los tiempos";
}

function sortByDifficulty(items) {
	return [...items].sort(
		(a, b) =>
			DIFFICULTY_ORDER.indexOf(a.difficulty || "easy") - DIFFICULTY_ORDER.indexOf(b.difficulty || "easy")
	);
}

/** Separa la descripción en primera frase (resaltada) y resto (línea abajo). */
function formatDescription(description) {
	if (!description || typeof description !== "string") return { first: "", rest: "" };
	const idx = description.indexOf(". ");
	if (idx < 0) return { first: description.trim(), rest: "" };
	return {
		first: description.slice(0, idx + 1).trim(),
		rest: description.slice(idx + 2).trim(),
	};
}

export default function Amigos() {
	const { refreshJugadosTrigger } = useUser();
	const currentSlug = useCurrentUserSlug();
	const [searchParams, setSearchParams] = useSearchParams();
	const [period, setPeriod] = useState("all");
	const [data, setData] = useState(null);
	const [achievements, setAchievements] = useState([]);
	const [detailAchievement, setDetailAchievement] = useState(null);
	const [insigniasExpanded, setInsigniasExpanded] = useState(false);

	// Onboarding: abrir biblioteca si vienen de first-login
	useEffect(() => {
		if (searchParams.get("library") === "1") {
			setSearchParams({}, { replace: true });
			setInsigniasExpanded(true);
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		if (!detailAchievement) return;
		const onKey = (e) => {
			if (e.key === "Escape") setDetailAchievement(null);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [detailAchievement]);

	useEffect(() => {
		fetch(`${apiBase}/api/ranking/competencia?period=${period}`)
			.then((r) => r.json())
			.then(setData)
			.catch(() => setData(null));
	}, [period, refreshJugadosTrigger]);

	useEffect(() => {
		if (!currentSlug) return;
		fetch(`${apiBase}/api/users/${currentSlug}/achievements`)
			.then((r) => (r.ok ? r.json() : { achievements: [] }))
			.then((d) => setAchievements(d.achievements || []))
			.catch(() => setAchievements([]));
	}, [currentSlug, refreshJugadosTrigger]);

	if (!data) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	const { ranking, period: p } = data;
	const title = periodDescription(p, data.since);
	const maxCount = Math.max(...ranking.map((r) => r.count), 1);

	// Solo desbloqueadas, 5 más recientes para la vista principal
	const unlockedOnly = achievements.filter((a) => a.unlocked_at);
	const fiveMostRecent = [...unlockedOnly].sort(
		(a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime()
	).slice(0, MAIN_UNLOCKED_COUNT);

	// Agrupar por categoría y ordenar por dificultad dentro de cada sección
	const bySection = (() => {
		const map = {};
		for (const cat of SECTION_ORDER) map[cat] = [];
		for (const a of achievements) {
			const cat = SECTION_ORDER.includes(a.category) ? a.category : "general";
			map[cat].push(a);
		}
		return SECTION_ORDER.filter((cat) => map[cat].length > 0).map((cat) => ({
			key: cat,
			label: SECTION_LABELS[cat] || cat,
			items: sortByDifficulty(map[cat]),
		}));
	})();

	function BadgeCircle({ a, showTitleBelow = false, sizeClass = "w-12 h-12 sm:w-14 sm:h-14" }) {
		const isLocked = !a.unlocked_at;
		const IconComp = ACHIEVEMENT_ICONS[a.icon] || Lock;
		const circleClass = isLocked ? LOCKED_CLASS : UNLOCKED_CLASS;
		return (
			<div className="flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={() => setDetailAchievement(a)}
					className={`${sizeClass} rounded-full border-2 flex items-center justify-center flex-shrink-0 ${circleClass} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-opacity`}
					title={a.title}
				>
					{isLocked ? (
						<Lock size={22} strokeWidth={1.8} className="opacity-70" />
					) : (
						<IconComp size={22} strokeWidth={1.8} />
					)}
				</button>
				{showTitleBelow && (
					<div className="flex flex-col items-center gap-0.5">
						<span className="text-zinc-400 text-xs text-center max-w-[4.5rem] leading-tight line-clamp-2">
							{a.title}
						</span>
						{a.progress && (
							<span className="text-zinc-500 text-[10px] font-medium tabular-nums">
								{a.progress.current} / {a.progress.target}
							</span>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">+ PUTO FRIKI</h1>

			<div className="mb-8">
				<div className="flex items-center justify-between gap-2 mb-3">
					<div className="flex items-baseline gap-2">
						<h2 className="text-lg font-semibold text-zinc-300">Tus insignias</h2>
						{achievements.length > 0 && (
							<span className="text-zinc-500 text-sm font-medium">
								{achievements.filter((a) => a.id !== "autismo_nivel_serio" && a.unlocked_at).length} / 69
							</span>
						)}
					</div>
					{insigniasExpanded && (
						<button
							type="button"
							onClick={() => setInsigniasExpanded(false)}
							className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
							aria-label="Cerrar insignias"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					)}
				</div>
				{achievements.length === 0 ? (
					<p className="text-zinc-500 text-sm rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-3">
						Cargando insignias…
					</p>
				) : insigniasExpanded ? (
					<>
						{bySection.map((section) => (
							<div key={section.key} className="mb-6">
								<h3 className="text-sm font-medium text-zinc-500 mb-2">{section.label}</h3>
								<div
									className="grid gap-4"
									style={{ gridTemplateColumns: `repeat(${BADGES_PER_ROW}, minmax(0, 1fr))` }}
								>
									{section.items.map((a) => (
										<BadgeCircle key={a.id} a={a} showTitleBelow />
									))}
								</div>
							</div>
						))}
						<button
							type="button"
							onClick={() => setInsigniasExpanded(false)}
							className="mt-2 text-zinc-500 text-sm hover:text-zinc-300"
						>
							Ver menos
						</button>
					</>
				) : (
					<>
						<div
							className="grid gap-3"
							style={{ gridTemplateColumns: `repeat(${BADGES_PER_ROW}, minmax(0, 1fr))` }}
						>
							{fiveMostRecent.map((a) => (
								<div key={a.id} className="flex justify-center">
									<BadgeCircle a={a} />
								</div>
							))}
							<div className="flex justify-center">
								<button
									type="button"
									onClick={() => setInsigniasExpanded(true)}
									className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-zinc-600 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-zinc-500"
									title="Ver biblioteca completa"
								>
									<Plus size={24} strokeWidth={2} />
								</button>
							</div>
						</div>
						{unlockedOnly.length === 0 && (
							<p className="text-zinc-500 text-xs mt-2">
								Aún no has desbloqueado ninguna. Pulsa + para ver la biblioteca.
							</p>
						)}
					</>
				)}
			</div>

			{detailAchievement && (
				<div
					className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70"
					onClick={() => setDetailAchievement(null)}
					role="dialog"
					aria-modal="true"
					aria-label="Detalle del logro"
				>
					<div
						className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 max-w-sm w-full shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center gap-3 mb-3">
							<span
								className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
									detailAchievement.unlocked_at ? UNLOCKED_CLASS : LOCKED_CLASS
								}`}
							>
								{detailAchievement.unlocked_at ? (
									(() => {
										const IconComp = ACHIEVEMENT_ICONS[detailAchievement.icon] || Trophy;
										return <IconComp size={26} strokeWidth={1.8} />;
									})()
								) : (
									<Lock size={26} strokeWidth={1.8} className="opacity-70" />
								)}
							</span>
							<div>
								<h3 className="font-semibold text-white">{detailAchievement.title}</h3>
								<p className="text-zinc-500 text-xs">
									{detailAchievement.unlocked_at
										? `Desbloqueado ${new Date(detailAchievement.unlocked_at).toLocaleDateString("es-ES", {
												day: "numeric",
												month: "long",
												year: "numeric",
											})}`
										: "Bloqueada"}
								</p>
								{!detailAchievement.unlocked_at && detailAchievement.progress && (
									<p className="text-zinc-500 text-xs mt-1 tabular-nums">
										{detailAchievement.progress.current} / {detailAchievement.progress.target}
									</p>
								)}
							</div>
						</div>
						{(() => {
							const { first, rest } = formatDescription(detailAchievement.description);
							return (
								<div className="text-sm">
									{first && (
										<p className="text-zinc-300 font-medium">{first}</p>
									)}
									{rest && (
										<p className="text-zinc-500 mt-1">{rest}</p>
									)}
								</div>
							);
						})()}
						<button
							type="button"
							onClick={() => setDetailAchievement(null)}
							className="mt-4 w-full py-2 rounded-xl bg-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-600"
						>
							Cerrar
						</button>
					</div>
				</div>
			)}

			<div className="flex flex-wrap gap-2 mb-8">
				{PERIODS.map(({ key, label }) => (
					<button
						key={key}
						type="button"
						onClick={() => setPeriod(key)}
						className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
							period === key
								? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
								: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
						}`}
					>
						{label}
					</button>
				))}
			</div>
			<p className="text-zinc-500 text-sm capitalize mb-6">{title}</p>
			<div className="space-y-4 max-w-md">
				{ranking.map((r, i) => {
					const position = i + 1;
					const isFirst = position === 1;
					const isSecond = position === 2;
					const isThird = position === 3;
					const barWidth = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
					return (
						<div
							key={r.user.id}
							className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
								isFirst
									? "bg-amber-500/10 border-amber-500/30"
									: isSecond
										? "bg-zinc-400/10 border-zinc-400/30"
										: isThird
											? "bg-amber-700/10 border-amber-700/30"
											: "bg-zinc-900/80 border-zinc-800"
							}`}
						>
							<span
								className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
									isFirst
										? "bg-amber-500/80 text-black"
										: isSecond
											? "bg-zinc-400/80 text-black"
											: isThird
												? "bg-amber-700/80 text-white"
												: "bg-zinc-700 text-zinc-300"
								}`}
							>
								{position}º
							</span>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between gap-2 mb-1">
									<span className="font-semibold text-white truncate">{r.user.name}</span>
									<span className="text-zinc-400 font-medium flex-shrink-0">
										{r.count} {r.count === 1 ? "juego jugado" : "juegos jugados"}
									</span>
								</div>
								<div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
									<div
										className={`h-full rounded-full transition-all duration-500 ${
											isFirst
												? "bg-amber-500"
												: isSecond
													? "bg-zinc-400"
													: isThird
														? "bg-amber-700"
														: "bg-orange-600"
										}`}
										style={{ width: `${barWidth}%` }}
									/>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
