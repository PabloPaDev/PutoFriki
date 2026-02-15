import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useUser } from "../App";
import { apiBase } from "../api";
import GameRow from "../components/GameRow";
import { IconPlus } from "../components/Icons";
import { useToast } from "../components/ToastContext";

const PABLO_SLUG = "pablo";
const AVATAR_SIZE = 256;
const MAX_PREVIEW = 3;
const CROP_VIEW_SIZE = 280;
const AVATAR_QUALITY = 0.82;

	function cropImageToCircle(imageSrc, scale, offsetX, offsetY, imgWidth, imgHeight) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = AVATAR_SIZE;
			canvas.height = AVATAR_SIZE;
			const ctx = canvas.getContext("2d");
			const canvasScale = scale * (AVATAR_SIZE / CROP_VIEW_SIZE);
			const half = AVATAR_SIZE / 2;
			const imgCenterX = imgWidth / 2 - offsetX / scale;
			const imgCenterY = imgHeight / 2 - offsetY / scale;
			const drawX = half - imgCenterX * canvasScale;
			const drawY = half - imgCenterY * canvasScale;
			ctx.beginPath();
			ctx.arc(half, half, half, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(
				img,
				0, 0, imgWidth, imgHeight,
				drawX, drawY, imgWidth * canvasScale, imgHeight * canvasScale
			);
			resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
		};
		img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
		img.src = imageSrc;
	});
}

export default function Perfil({ slug: propSlug }) {
	const { slug: paramSlug } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const { currentUser, refreshJugadosTrigger, setRefreshJugadosTrigger, setUser, clearOptimisticAdds } = useUser();
	const currentSlug = currentUser?.slug ?? null;
	const slug = propSlug || paramSlug;
	const fileInputRef = useRef(null);

	const tabParam = searchParams.get("tab");
	const validTab = ["completados", "jugando", "abandonados", "pendientes"].includes(tabParam) ? tabParam : "completados";
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState(validTab);
	const [expanded, setExpanded] = useState({ completados: false, jugando: false, abandonados: false, pendientes: false });
	const [editBio, setEditBio] = useState("");
	const [editAvatar, setEditAvatar] = useState(null);
	const [saving, setSaving] = useState(false);
	const [cropImageUrl, setCropImageUrl] = useState(null);
	const [cropImageSize, setCropImageSize] = useState({ w: 1, h: 1 });
	const [cropScale, setCropScale] = useState(1);
	const [cropOffsetX, setCropOffsetX] = useState(0);
	const [cropOffsetY, setCropOffsetY] = useState(0);
	const [cropDragging, setCropDragging] = useState(false);
	const cropDragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
	const cropContainerRef = useRef(null);
	const [steamProfile, setSteamProfile] = useState(null);
	const [steamGames, setSteamGames] = useState([]);
	const [steamGamesLoading, setSteamGamesLoading] = useState(false);
	const [achievementsModal, setAchievementsModal] = useState(null);
	const [achievementsData, setAchievementsData] = useState(null);
	const [achievementsLoading, setAchievementsLoading] = useState(false);
	const { addToast } = useToast();

	const isOwn = !!slug && currentSlug === slug;

	useEffect(() => {
		const steam = searchParams.get("steam");
		if (steam === "linked") {
			addToast({ title: "Steam conectado", description: "Tu cuenta de Steam se ha vinculado correctamente." });
			const next = new URLSearchParams(searchParams);
			next.delete("steam");
			setSearchParams(next, { replace: true });
			if (slug) fetch(`${apiBase}/api/users/${slug}/steam/profile`).then((r) => r.ok ? r.json() : null).then(setSteamProfile);
		} else if (steam === "error") {
			addToast({ title: "Error", description: "No se pudo conectar con Steam." });
			const next = new URLSearchParams(searchParams);
			next.delete("steam");
			setSearchParams(next, { replace: true });
		}
	}, [searchParams.get("steam"), slug]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!slug || !isOwn) return;
		fetch(`${apiBase}/api/users/${slug}/steam/profile`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => d?.linked ? setSteamProfile(d) : setSteamProfile(null))
			.catch(() => setSteamProfile(null));
	}, [slug, isOwn, refreshJugadosTrigger]);

	const fetchSteamGames = () => {
		if (!slug) return;
		setSteamGamesLoading(true);
		fetch(`${apiBase}/api/users/${slug}/steam/games`)
			.then((r) => (r.ok ? r.json() : { games: [] }))
			.then((d) => setSteamGames(d.games || []))
			.catch(() => setSteamGames([]))
			.finally(() => setSteamGamesLoading(false));
	};

	const openAchievements = (appId, gameName) => {
		setAchievementsModal({ appId, gameName });
		setAchievementsData(null);
		setAchievementsLoading(true);
		fetch(`${apiBase}/api/users/${slug}/steam/achievements/${appId}`)
			.then((r) => (r.ok ? r.json() : null))
			.then(setAchievementsData)
			.catch(() => setAchievementsData({ achievements: [] }))
			.finally(() => setAchievementsLoading(false));
	};

	useEffect(() => {
		const t = searchParams.get("tab");
		setTab(["completados", "jugando", "abandonados", "pendientes"].includes(t) ? t : "completados");
	}, [searchParams]);

	useEffect(() => {
		if (!slug) return;
		setLoading(true);
		setEditAvatar(null);
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				setData(d);
				clearOptimisticAdds?.();
				if (d?.user && currentSlug === slug) {
					setEditBio(d.user.bio || "");
					if (setUser) setUser(d.user);
				}
			})
			.catch(() => setData(null))
			.finally(() => setLoading(false));
	}, [slug, currentSlug, refreshJugadosTrigger]);

	useEffect(() => {
		if (!cropDragging) return;
		const up = () => setCropDragging(false);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
		return () => {
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
		};
	}, [cropDragging]);

	useEffect(() => {
		if (!cropDragging) return;
		const move = (e) => {
			const { x, y, offsetX, offsetY } = cropDragStartRef.current;
			setCropOffsetX(offsetX + (e.clientX - x));
			setCropOffsetY(offsetY + (e.clientY - y));
		};
		window.addEventListener("pointermove", move);
		return () => window.removeEventListener("pointermove", move);
	}, [cropDragging]);

	const refresh = () => {
		if (!slug) return;
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => r.json())
			.then((d) => {
				setData(d);
				clearOptimisticAdds?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => {});
	};

	const user = data?.user;
	const jugados = data?.jugados ?? [];
	const pendientes = data?.pendientes ?? [];
	const jugando = data?.jugando ?? [];
	const completadosTab = jugados.filter((g) => g.completed !== false);
	const abandonadosTab = jugados.filter((g) => g.completed === false);

	const listByTab = { completados: completadosTab, jugando, abandonados: abandonadosTab, pendientes };
	const currentList = listByTab[tab];
	const displayedList = currentList.slice(0, expanded[tab] ? currentList.length : MAX_PREVIEW);
	const showVerMas = currentList.length > MAX_PREVIEW && !expanded[tab];

	const switchTab = (key) => {
		setTab(key);
		setSearchParams(key === "completados" ? {} : { tab: key });
	};

	const tabButton = (key, label, count) => (
		<button
			type="button"
			onClick={() => switchTab(key)}
			className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
				tab === key
					? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
					: "text-zinc-200 hover:text-white hover:bg-zinc-800"
			}`}
		>
			{label} ({count})
		</button>
	);

	const displayAvatar =
		editAvatar === "" ? null : (editAvatar ?? user?.avatar ?? null);
	const saveProfile = () => {
		if (!isOwn || !slug) return;
		setSaving(true);
		const body = { bio: editBio };
		if (editAvatar !== undefined) body.avatar = editAvatar || null;
		fetch(`${apiBase}/api/users/${slug}/profile`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
			.then((r) => {
				if (!r.ok) throw new Error();
				return r.json();
			})
			.then((updated) => {
				setData((prev) => (prev ? { ...prev, user: { ...prev.user, ...updated } } : prev));
				setEditAvatar(undefined);
				if (currentSlug === slug && setUser) setUser(updated);
			})
			.catch(() => {})
			.finally(() => setSaving(false));
	};

	const onFileChange = (e) => {
		const file = e.target.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth || img.width;
			const h = img.naturalHeight || img.height;
			const coverScale = Math.max(CROP_VIEW_SIZE / w, CROP_VIEW_SIZE / h);
			setCropImageSize({ w, h });
			setCropScale(coverScale);
			setCropOffsetX(0);
			setCropOffsetY(0);
			setCropImageUrl(url);
		};
		img.onerror = () => URL.revokeObjectURL(url);
		img.src = url;
		e.target.value = "";
	};

	const closeCrop = () => {
		if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
		setCropImageUrl(null);
	};

	const applyCrop = () => {
		if (!cropImageUrl) return;
		cropImageToCircle(
			cropImageUrl,
			cropScale,
			cropOffsetX,
			cropOffsetY,
			cropImageSize.w,
			cropImageSize.h
		)
			.then((dataUrl) => {
				setEditAvatar(dataUrl);
				closeCrop();
			})
			.catch(() => {});
	};

	const onCropPointerDown = (e) => {
		e.preventDefault();
		cropDragStartRef.current = {
			x: e.clientX,
			y: e.clientY,
			offsetX: cropOffsetX,
			offsetY: cropOffsetY,
		};
		setCropDragging(true);
	};
	const onCropPointerMove = (e) => {
		if (!cropDragging) return;
		const { x, y, offsetX, offsetY } = cropDragStartRef.current;
		setCropOffsetX(offsetX + (e.clientX - x));
		setCropOffsetY(offsetY + (e.clientY - y));
	};
	const onCropPointerUp = () => setCropDragging(false);
	const onCropPointerLeave = () => setCropDragging(false);

	return (
		<>
			{loading && (
				<div className="flex items-center justify-center py-20">
					<p className="text-zinc-400">Cargando perfil…</p>
				</div>
			)}
			{!loading && (!data || !user) && (
				<p className="text-zinc-400 py-12">Usuario no encontrado.</p>
			)}
			{!loading && data && user && (
				<>
			{/* Modal encuadre circular */}
			{cropImageUrl && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
					role="dialog"
					aria-modal="true"
					aria-label="Encuadrar foto"
				>
					<div className="w-full max-w-sm">
						<p className="text-center text-zinc-300 text-sm mb-3">
							Mueve la imagen y ajusta el zoom para encuadrarla en el círculo.
						</p>
						<div
							ref={cropContainerRef}
							className="relative mx-auto rounded-full overflow-hidden border-2 border-zinc-600 bg-zinc-800 select-none touch-none"
							style={{
								width: CROP_VIEW_SIZE,
								height: CROP_VIEW_SIZE,
								cursor: cropDragging ? "grabbing" : "grab",
							}}
							onPointerDown={onCropPointerDown}
							onPointerMove={onCropPointerMove}
							onPointerUp={onCropPointerUp}
							onPointerLeave={onCropPointerLeave}
							onPointerCancel={onCropPointerUp}
						>
							<img
								src={cropImageUrl}
								alt=""
								className="absolute pointer-events-none"
								style={{
									width: cropImageSize.w,
									height: cropImageSize.h,
									left: CROP_VIEW_SIZE / 2 - (cropImageSize.w * cropScale) / 2 + cropOffsetX,
									top: CROP_VIEW_SIZE / 2 - (cropImageSize.h * cropScale) / 2 + cropOffsetY,
									transform: `scale(${cropScale})`,
									transformOrigin: "top left",
								}}
								draggable={false}
							/>
						</div>
						<div className="mt-4 flex flex-col gap-2">
							<label className="text-zinc-400 text-xs font-medium">
								Zoom
							</label>
							<input
								type="range"
								min="0.5"
								max="3"
								step="0.05"
								value={cropScale}
								onChange={(e) => setCropScale(Number(e.target.value))}
								className="w-full h-2 rounded-full bg-zinc-700 appearance-none accent-orange-500"
							/>
						</div>
						<div className="flex gap-2 mt-4">
							<button
								type="button"
								onClick={closeCrop}
								className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={applyCrop}
								className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-500"
							>
								Aplicar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Bloque perfil: foto + descripción */}
			<div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:p-6 mb-6">
				<div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
					<div className="flex-shrink-0">
						{isOwn ? (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="block rounded-full overflow-hidden w-20 h-20 sm:w-24 sm:h-24 border-2 border-zinc-700 bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
								aria-label="Cambiar foto de perfil"
							>
								{displayAvatar ? (
									<img src={displayAvatar} alt="" className="w-full h-full object-cover" />
								) : (
									<span className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-bold text-zinc-400">
										{user.name?.charAt(0) ?? "?"}
									</span>
								)}
							</button>
						) : (
							<div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-800 flex items-center justify-center">
								{user.avatar ? (
									<img src={user.avatar} alt="" className="w-full h-full object-cover" />
								) : (
									<span className="text-2xl sm:text-3xl font-bold text-zinc-400">
										{user.name?.charAt(0) ?? "?"}
									</span>
								)}
							</div>
						)}
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={onFileChange}
							className="hidden"
							aria-hidden
						/>
						{isOwn && displayAvatar && (
							<button
								type="button"
								onClick={() => setEditAvatar("")}
								className="mt-1 text-xs text-zinc-500 hover:text-zinc-300"
							>
								Quitar foto
							</button>
						)}
					</div>
					<div className="flex-1 min-w-0">
						<h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
							{user.name}
						</h1>
						{isOwn ? (
							<>
								<label className="block text-zinc-400 text-sm font-medium mb-1 mt-2">
									Descripción
								</label>
								<textarea
									value={editBio}
									onChange={(e) => setEditBio(e.target.value)}
									placeholder="Escribe algo sobre ti..."
									rows={3}
									className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-y text-sm"
								/>
								<button
									type="button"
									onClick={saveProfile}
									disabled={saving}
									className="mt-3 px-4 py-2 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
								>
									{saving ? "Guardando…" : "Guardar"}
								</button>
							</>
						) : (
							<p className="text-zinc-400 text-sm mt-1 whitespace-pre-wrap">
								{user.bio || "Sin descripción."}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Steam: conectar y ver logros */}
			{isOwn && (
				<div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 mb-6">
					<h3 className="text-sm font-semibold text-zinc-300 mb-2">Steam</h3>
					{!steamProfile?.linked ? (
						<a
							href={`${apiBase || ""}/api/users/${slug}/steam/connect?redirect_origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
							className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1b2838] text-white hover:bg-[#2a475e] border border-[#416a8c] transition-colors"
						>
							<span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold">S</span>
							Conectar con Steam
						</a>
					) : (
						<>
							<div className="flex items-center gap-2 mb-2">
								{steamProfile?.summary?.avatarfull && (
									<img src={steamProfile.summary.avatarfull} alt="" className="w-10 h-10 rounded-full" />
								)}
								<div>
									<p className="text-white font-medium">{steamProfile?.summary?.personaname || "Steam conectado"}</p>
									<p className="text-zinc-500 text-xs">Logros de juegos que juegas o has jugado (Steam). PS5 no tiene API pública para logros.</p>
								</div>
							</div>
							<button
								type="button"
								onClick={fetchSteamGames}
								disabled={steamGamesLoading}
								className="px-4 py-2 rounded-xl text-sm font-medium bg-[#1b2838] text-white hover:bg-[#2a475e] border border-[#416a8c] disabled:opacity-50"
							>
								{steamGamesLoading ? "Cargando…" : "Ver juegos recientes"}
							</button>
							{steamGames.length > 0 && (
								<ul className="mt-3 space-y-2">
									{steamGames.slice(0, 15).map((g) => (
										<li key={g.appid} className="flex items-center gap-2 py-1.5">
											{g.img_icon_url && (
												<img
													src={`https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`}
													alt=""
													className="w-8 h-8 rounded object-cover bg-zinc-800"
												/>
											)}
											<span className="flex-1 text-sm text-zinc-200 truncate">{g.name}</span>
											<button
												type="button"
												onClick={() => openAchievements(g.appid, g.name)}
												className="text-xs text-orange-400 hover:text-orange-300"
											>
												Ver logros
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					)}
				</div>
			)}

			{/* Modal logros Steam */}
			{achievementsModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-labelledby="steam-achievements-title">
					<div className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col">
						<div className="p-4 border-b border-zinc-800 flex items-center justify-between">
							<h2 id="steam-achievements-title" className="text-lg font-semibold text-white truncate">
								{achievementsModal.gameName}
							</h2>
							<button type="button" onClick={() => setAchievementsModal(null)} className="text-zinc-400 hover:text-white p-1">✕</button>
						</div>
						<div className="p-4 overflow-y-auto flex-1">
							{achievementsLoading ? (
								<p className="text-zinc-500 text-sm">Cargando logros…</p>
							) : achievementsData?.achievements?.length ? (
								<ul className="space-y-2">
									{achievementsData.achievements.map((a) => (
										<li key={a.apiname} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
											{(a.icon || a.iconGray) ? (
												<img src={`https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${achievementsModal.appId}/${a.achieved ? (a.icon || a.iconGray) : (a.iconGray || a.icon)}.jpg`} alt="" className="w-10 h-10 rounded object-cover bg-zinc-800" />
											) : (
												<div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-lg">{a.achieved ? "✓" : "○"}</div>
											)}
											<div className="flex-1 min-w-0">
												<p className={`text-sm font-medium ${a.achieved ? "text-white" : "text-zinc-500"}`}>{a.displayName || a.apiname}</p>
												{a.description && <p className="text-xs text-zinc-500 truncate">{a.description}</p>}
												{a.achieved && a.unlocktime > 0 && <p className="text-xs text-zinc-600">{new Date(a.unlocktime * 1000).toLocaleDateString("es")}</p>}
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

			{isOwn && slug === PABLO_SLUG && (
				<div className="mb-6">
					<Link
						to="/agenda"
						className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
					>
						Agenda
					</Link>
				</div>
			)}

			<h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
				Juegos
			</h2>
			<div className="flex flex-wrap gap-2 mb-6 rounded-2xl bg-zinc-900/85 border border-zinc-800 p-3">
				{tabButton("completados", "Completados", completadosTab.length)}
				{tabButton("jugando", "Jugando", jugando.length)}
				{tabButton("abandonados", "Abandonados", abandonadosTab.length)}
				{tabButton("pendientes", "Pendientes", pendientes.length)}
			</div>
			{tab === "completados" && (
				<div className="space-y-4">
					{completadosTab.length === 0 ? (
						<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
							Aún no hay juegos completados.
						</p>
					) : (
						<>
							{displayedList.map((g) => (
								<GameRow
									key={g.game_id}
									game={g}
									isJugado
									isCompletadosTab={true}
									isAbandonadosTab={false}
									isOwn={isOwn}
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
			)}
			{tab === "jugando" && (
				<div className="space-y-4">
					{jugando.length === 0 ? (
						<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
							No hay juegos en curso.
						</p>
					) : (
						<>
							{displayedList.map((g) => (
								<GameRow
									key={g.game_id}
									game={g}
									isJugado={false}
									isJugandoTab={true}
									isCompletadosTab={false}
									isAbandonadosTab={false}
									isOwn={isOwn}
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
			)}
			{tab === "abandonados" && (
				<div className="space-y-4">
					{abandonadosTab.length === 0 ? (
						<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
							No hay juegos abandonados.
						</p>
					) : (
						<>
							{displayedList.map((g) => (
								<GameRow
									key={g.game_id}
									game={g}
									isJugado
									isCompletadosTab={false}
									isAbandonadosTab={true}
									isOwn={isOwn}
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
			)}
			{tab === "pendientes" && (
				<div className="space-y-4">
					{pendientes.length === 0 ? (
						<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
							No hay juegos pendientes.
						</p>
					) : (
						<>
							{displayedList.map((g) => (
								<GameRow
									key={g.game_id}
									game={g}
									isJugado={false}
									isJugandoTab={false}
									isPendientesTab={true}
									isCompletadosTab={false}
									isAbandonadosTab={false}
									isOwn={isOwn}
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
			)}
				</>
			)}
		</>
	);
}
