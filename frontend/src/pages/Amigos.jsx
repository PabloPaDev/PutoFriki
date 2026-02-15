import { useState, useEffect, useRef } from "react";
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
import { Link } from "react-router-dom";

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
	const { refreshJugadosTrigger, setRefreshJugadosTrigger } = useUser();
	const currentSlug = useCurrentUserSlug();
	const [searchParams, setSearchParams] = useSearchParams();
	const [period, setPeriod] = useState("all");
	const [data, setData] = useState(null);
	const [achievements, setAchievements] = useState([]);
	const [detailAchievement, setDetailAchievement] = useState(null);
	const [insigniasExpanded, setInsigniasExpanded] = useState(false);
	// Steam: perfil, biblioteca y logros (estilo app)
	const [steamProfile, setSteamProfile] = useState(null);
	const [steamLibrary, setSteamLibrary] = useState([]);
	const [steamLibraryLoading, setSteamLibraryLoading] = useState(false);
	const [steamAchievementsModal, setSteamAchievementsModal] = useState(null);
	const [steamAchievementsData, setSteamAchievementsData] = useState(null);
	const [steamAchievementsLoading, setSteamAchievementsLoading] = useState(false);
	const [steamSyncLoading, setSteamSyncLoading] = useState(false);
	const [steamSyncResult, setSteamSyncResult] = useState(null);
	const steamSyncDoneRef = useRef(false);

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

	useEffect(() => {
		if (!currentSlug) return;
		fetch(`${apiBase}/api/users/${currentSlug}/steam/profile`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => (d?.linked ? setSteamProfile(d) : setSteamProfile(null)))
			.catch(() => setSteamProfile(null));
	}, [currentSlug, refreshJugadosTrigger]);

	useEffect(() => {
		if (!currentSlug || !steamProfile?.linked) {
			setSteamLibrary([]);
			return;
		}
		setSteamLibraryLoading(true);
		fetch(`${apiBase}/api/users/${currentSlug}/steam/library`)
			.then((r) => (r.ok ? r.json() : { games: [] }))
			.then((d) => setSteamLibrary(d.games || []))
			.catch(() => setSteamLibrary([]))
			.finally(() => setSteamLibraryLoading(false));
	}, [currentSlug, steamProfile?.linked, refreshJugadosTrigger]);

	useEffect(() => {
		if (!currentSlug || !steamAchievementsModal?.appId) return;
		setSteamAchievementsData(null);
		setSteamAchievementsLoading(true);
		fetch(`${apiBase}/api/users/${currentSlug}/steam/achievements/${steamAchievementsModal.appId}`)
			.then((r) => (r.ok ? r.json() : null))
			.then(setSteamAchievementsData)
			.catch(() => setSteamAchievementsData({ achievements: [] }))
			.finally(() => setSteamAchievementsLoading(false));
	}, [currentSlug, steamAchievementsModal?.appId]);

	// Al entrar a la biblioteca Steam: sincronizar juegos con la app (Jugando / Wishlist)
	useEffect(() => {
		if (!currentSlug || !steamProfile?.linked || steamLibrary.length === 0 || steamLibraryLoading || steamSyncDoneRef.current) return;
		steamSyncDoneRef.current = true;
		setSteamSyncLoading(true);
		setSteamSyncResult(null);
		fetch(`${apiBase}/api/users/${currentSlug}/steam/sync-library`, { method: "POST" })
			.then((r) => (r.ok ? r.json() : { error: "Error al sincronizar" }))
			.then((data) => {
				setSteamSyncResult(data);
				if (data.addedPlaying > 0 || data.addedPending > 0) setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => setSteamSyncResult({ error: "Error al sincronizar" }))
			.finally(() => setSteamSyncLoading(false));
	}, [currentSlug, steamProfile?.linked, steamLibrary.length, steamLibraryLoading, setRefreshJugadosTrigger]);

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

			{/* Biblioteca Steam: perfil + juegos + logros con apariencia del frontend */}
			<div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
				<h2 className="text-lg font-semibold text-zinc-300 mb-3">Steam</h2>
				{!steamProfile?.linked ? (
					<>
						<p className="text-zinc-500 text-sm mb-2">
							Conecta tu cuenta de Steam en tu perfil para ver aquí tu biblioteca y logros.
						</p>
						<Link
							to={currentSlug ? `/perfil/${currentSlug}` : "/"}
							className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1b2838] text-white hover:bg-[#2a475e] border border-[#416a8c] transition-colors"
						>
							<span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold">S</span>
							Ir a perfil para conectar Steam
						</Link>
					</>
				) : (
					<>
						<div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 mb-4">
							{steamProfile?.summary?.avatarfull ? (
								<img
									src={steamProfile.summary.avatarfull}
									alt=""
									className="w-14 h-14 rounded-xl object-cover border border-zinc-600"
								/>
							) : (
								<div className="w-14 h-14 rounded-xl bg-zinc-700 border border-zinc-600 flex items-center justify-center text-zinc-400 text-xl font-bold">S</div>
							)}
							<div>
								<p className="font-semibold text-white">{steamProfile?.summary?.personaname || "Steam"}</p>
								<p className="text-zinc-500 text-xs">Biblioteca y logros con la apariencia de P*** Friki</p>
							</div>
						</div>
						{steamSyncLoading && (
							<p className="text-amber-400/90 text-sm mb-2">Sincronizando tu biblioteca con Jugando y Wishlist…</p>
						)}
						{steamSyncResult && !steamSyncLoading && (
							<p className="text-zinc-400 text-sm mb-2">
								{steamSyncResult.error ? (
									<span className="text-amber-400/90">{steamSyncResult.error}</span>
								) : (
									<>
										Añadidos <strong className="text-white">{steamSyncResult.addedPlaying || 0}</strong> a Jugando y{" "}
										<strong className="text-white">{steamSyncResult.addedPending || 0}</strong> a Wishlist.
										{(steamSyncResult.addedPlaying || 0) + (steamSyncResult.addedPending || 0) === 0 && steamSyncResult.skipped > 0 && (
											<span className="text-zinc-500"> (ya estaban en tus listas)</span>
										)}
									</>
								)}
							</p>
						)}
						<h3 className="text-sm font-medium text-zinc-500 mb-2">Tu biblioteca</h3>
						{steamLibraryLoading ? (
							<p className="text-zinc-500 text-sm py-4">Cargando biblioteca…</p>
						) : steamLibrary.length === 0 ? (
							<p className="text-zinc-500 text-sm py-2">
								No se pudo cargar la biblioteca (puede que tu perfil Steam sea privado).
							</p>
						) : (
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
								{steamLibrary.slice(0, 30).map((g) => {
									const playtimeHours = g.playtime_forever ? Math.round(g.playtime_forever / 60) : 0;
									const iconUrl = g.img_icon_url
										? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
										: null;
									return (
										<button
											key={g.appid}
											type="button"
											onClick={() => setSteamAchievementsModal({ appId: g.appid, gameName: g.name || `App ${g.appid}` })}
											className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-left"
										>
											{iconUrl ? (
												<img src={iconUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-zinc-900" />
											) : (
												<div className="w-16 h-16 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs">?</div>
											)}
											<span className="text-zinc-200 text-xs font-medium line-clamp-2 text-center w-full">{g.name || `App ${g.appid}`}</span>
											{playtimeHours > 0 && (
												<span className="text-zinc-500 text-[10px] tabular-nums">{playtimeHours}h jugadas</span>
											)}
										</button>
									);
								})}
							</div>
						)}
						{steamLibrary.length > 30 && (
							<p className="text-zinc-500 text-xs mt-2">Mostrando 30 de {steamLibrary.length} juegos. Pulsa en uno para ver sus logros.</p>
						)}
					</>
				)}
			</div>

			{steamAchievementsModal && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
					role="dialog"
					aria-modal="true"
					aria-labelledby="steam-achievements-amigos-title"
				>
					<div className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col">
						<div className="p-4 border-b border-zinc-800 flex items-center justify-between">
							<h2 id="steam-achievements-amigos-title" className="text-lg font-semibold text-white truncate">
								{steamAchievementsModal.gameName}
							</h2>
							<button
								type="button"
								onClick={() => setSteamAchievementsModal(null)}
								className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
								aria-label="Cerrar"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>
						<div className="p-4 overflow-y-auto flex-1">
							{steamAchievementsLoading ? (
								<p className="text-zinc-500 text-sm">Cargando logros…</p>
							) : steamAchievementsData?.achievements?.length ? (
								<ul className="space-y-2">
									{steamAchievementsData.achievements.map((a) => (
										<li key={a.apiname} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
											{(a.icon || a.iconGray) ? (
												<img
													src={`https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${steamAchievementsModal.appId}/${a.achieved ? (a.icon || a.iconGray) : (a.iconGray || a.icon)}.jpg`}
													alt=""
													className="w-10 h-10 rounded-lg object-cover bg-zinc-800"
												/>
											) : (
												<div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-lg">{a.achieved ? "✓" : "○"}</div>
											)}
											<div className="flex-1 min-w-0">
												<p className={`text-sm font-medium ${a.achieved ? "text-white" : "text-zinc-500"}`}>{a.displayName || a.apiname}</p>
												{a.description && <p className="text-xs text-zinc-500 truncate">{a.description}</p>}
												{a.achieved && a.unlocktime > 0 && (
													<p className="text-xs text-zinc-600">{new Date(a.unlocktime * 1000).toLocaleDateString("es")}</p>
												)}
											</div>
										</li>
									))}
								</ul>
							) : (
								<p className="text-zinc-500 text-sm">Sin logros o no disponibles para este juego.</p>
							)}
						</div>
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
