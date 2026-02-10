import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "./App";
import { useToast } from "./components/ToastContext";
import { apiBase } from "./api";
import AmigosSidebar from "./components/AmigosSidebar";
import {
	IconGamepad,
	IconHomeMobile,
	IconStarMobile,
	IconTrophyMobile,
	IconPlus,
	IconChatMobile,
} from "./components/Icons";

const NAV_ITEMS = [
	{ to: "/", end: true, label: "Inicio", Icon: IconHomeMobile },
	{ to: "/ranking", end: false, label: "Top juegos", Icon: IconStarMobile },
	{ to: "/amigos", end: false, label: "+ PUTO FRIKI", Icon: IconTrophyMobile },
];

const PENDING_FIRST_LOGIN_KEY = "juegos_app_pending_first_login";

export default function Layout() {
	const { currentUser, users, refreshJugadosTrigger } = useUser();
	const { addToast } = useToast();
	const location = useLocation();
	const navigate = useNavigate();
	const isHome = location.pathname === "/";
	const [topCovers, setTopCovers] = useState([]);
	const [carouselIndex, setCarouselIndex] = useState(0);

	useEffect(() => {
		const slug = currentUser?.slug;
		if (!slug) {
			setTopCovers([]);
			return;
		}
		fetch(`${apiBase}/api/users/${slug}/perfil`)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (!data?.jugados) return;
				const covers = data.jugados
					.filter((g) => g.image_url)
					.map((g) => ({ image_url: g.image_url }));
				setTopCovers(covers);
			})
			.catch(() => setTopCovers([]));
	}, [currentUser?.slug, refreshJugadosTrigger]);

	// Al volver a la pantalla principal, cambiar el fondo a una portada de la colección (cualquier jugado)
	useEffect(() => {
		if (location.pathname !== "/" || topCovers.length === 0) return;
		setCarouselIndex((prev) => {
			const next = Math.floor(Math.random() * topCovers.length);
			return next === prev && topCovers.length > 1 ? (next + 1) % topCovers.length : next;
		});
	}, [location.pathname, topCovers.length]);

	useEffect(() => {
		const slug = sessionStorage.getItem(PENDING_FIRST_LOGIN_KEY);
		if (!slug || !currentUser || currentUser.slug !== slug) return;
		sessionStorage.removeItem(PENDING_FIRST_LOGIN_KEY);
		fetch(`${apiBase}/api/users/${slug}/achievements/first-login`, { method: "POST" })
			.then((r) => (r.ok ? r.json() : { newlyUnlocked: [] }))
			.then((data) => {
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				navigate("/amigos?library=1", { replace: true });
			})
			.catch(() => {});
	}, [currentUser, addToast, navigate]);

	const linkClass = ({ isActive }) =>
		`min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
			isActive
				? "bg-orange-600 text-white shadow-lg shadow-orange-600/30"
				: "text-zinc-200 hover:text-white hover:bg-zinc-800"
		}`;

	return (
		<div className="min-h-screen flex flex-col pb-16 md:pb-0 relative">
			{/* Fondo: portada de un juego de la colección del usuario; cambia al volver a Inicio */}
			{topCovers.length > 0 && (
				<div
					className="fixed inset-0 z-0 overflow-hidden"
					aria-hidden
				>
					<div className="absolute inset-0 bg-black/20 z-[1]" />
					{topCovers.map((item, i) => (
					<div
						key={item.image_url + i}
						className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
						style={{ opacity: i === carouselIndex ? 1 : 0 }}
					>
						<img
							src={item.image_url}
							alt=""
							className="w-full h-full object-cover object-center scale-105 brightness-75"
						/>
					</div>
					))}
				</div>
			)}

			<header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm safe-area-inset-top">
				<div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 sm:gap-3 min-w-0">
						<IconGamepad className="flex-shrink-0 text-zinc-500" size={22} strokeWidth={1.8} aria-hidden />
						<div className="min-w-0">
							<NavLink to="/" className="font-bold text-white text-base sm:text-lg hover:opacity-90 truncate block">
								P*** Friki
							</NavLink>
							<p className="text-zinc-500 text-xs hidden sm:block">Tu biblioteca de juegos</p>
						</div>
					</div>
					{/* Escritorio: nav completo */}
					<nav className="hidden md:flex items-center gap-2 flex-wrap">
						{NAV_ITEMS.map(({ to, end, label }) => (
							<NavLink key={to} to={to} end={end} className={linkClass}>
								{label}
							</NavLink>
						))}
						<NavLink
							to="/chat"
							className={linkClass}
						>
							Chat
						</NavLink>
						<NavLink
							to="/buscar"
							className="ml-2 min-h-[44px] flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-500 transition-colors"
						>
							Añadir
						</NavLink>
						{currentUser && (
							<NavLink
								to={`/perfil/${currentUser.slug}`}
								className={linkClass}
							>
								Perfil
							</NavLink>
						)}
						{users
							.filter((u) => u.slug !== currentUser?.slug)
							.map((u) => (
								<NavLink key={u.id} to={`/perfil/${u.slug}`} className={linkClass}>
									{u.name}
								</NavLink>
							))}
					</nav>
					{/* Móvil: enlace a mi perfil */}
					{currentUser && (
						<NavLink
							to={`/perfil/${currentUser.slug}`}
							className="md:hidden flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-800/90 flex items-center justify-center text-white font-bold"
							aria-label="Mi perfil"
						>
							{currentUser.avatar ? (
								<img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
							) : (
								<span>{currentUser.name?.charAt(0) ?? "?"}</span>
							)}
						</NavLink>
					)}
				</div>
			</header>
			<main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 relative z-10">
				<div className={`flex gap-4 lg:gap-8 flex-col ${isHome ? "lg:flex-row" : ""}`}>
					<div className={isHome ? "order-1 lg:order-2 flex-1 min-w-0" : "flex-1 min-w-0"}>
						<Outlet />
					</div>
					{isHome && (
						<div className="order-2 lg:order-1">
							<AmigosSidebar />
						</div>
					)}
				</div>
			</main>
			{/* Barra inferior móvil: Inicio, Chat, Añadir, Top juegos, + PUTO FRIKI */}
			<nav
				className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
				aria-label="Navegación principal"
			>
				<div className="flex items-stretch justify-around min-h-[56px]">
					{NAV_ITEMS.slice(0, 1).map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
									isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-300 active:bg-zinc-800/80"
								}`
							}
						>
							<Icon className="text-current" aria-hidden />
							<span>{label}</span>
						</NavLink>
					))}
					<NavLink
						to="/chat"
						className={({ isActive }) =>
							`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
								isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-300 active:bg-zinc-800/80"
							}`
						}
					>
						<IconChatMobile className="text-current" aria-hidden />
						<span>Chat</span>
					</NavLink>
					<NavLink
						to="/buscar"
						className={({ isActive }) =>
							`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
								isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-300 active:bg-zinc-800/80"
							}`
						}
					>
						<IconPlus className="text-current" aria-hidden />
						<span>Añadir</span>
					</NavLink>
					{NAV_ITEMS.slice(1, 3).map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
									`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
										isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-300 active:bg-zinc-800/80"
									}`
							}
						>
							<Icon className="text-current" aria-hidden />
							<span>{label}</span>
						</NavLink>
					))}
				</div>
			</nav>
		</div>
	);
}
