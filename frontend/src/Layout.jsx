import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "./App";
import { useToast } from "./components/ToastContext";
import { apiBase } from "./api";
import AmigosSidebar from "./components/AmigosSidebar";
import Chat from "./pages/Chat";
import {
	IconGamepad,
	IconHomeMobile,
	IconStarMobile,
	IconTrophyMobile,
	IconSearchMobile,
	IconChatMobile,
} from "./components/Icons";

const NAV_ITEMS = [
	{ to: "/", end: true, label: "Inicio", Icon: IconHomeMobile },
	{ to: "/ranking", end: false, label: "Top juegos", Icon: IconStarMobile },
	{ to: "/amigos", end: false, label: "+ PUTO FRIKI", Icon: IconTrophyMobile },
];

const PENDING_FIRST_LOGIN_KEY = "juegos_app_pending_first_login";

export default function Layout() {
	const { currentUser, users } = useUser();
	const { addToast } = useToast();
	const location = useLocation();
	const navigate = useNavigate();
	const isHome = location.pathname === "/";
	const [chatOpen, setChatOpen] = useState(false);

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
				: "text-zinc-400 hover:text-white hover:bg-zinc-800"
		}`;

	return (
		<div className="min-h-screen flex flex-col pb-16 md:pb-0">
			<header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-black/95 backdrop-blur-md safe-area-inset-top">
				<div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 sm:gap-3 min-w-0">
						<IconGamepad className="flex-shrink-0 text-zinc-400" size={22} strokeWidth={1.8} aria-hidden />
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
							to="/buscar"
							className="ml-2 min-h-[44px] flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-500 transition-colors"
						>
							Buscar
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
							className="md:hidden flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-800 flex items-center justify-center text-white font-bold"
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
			<main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
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
			{/* Panel flotante de chat (estilo chat bot) */}
			{chatOpen && (
				<div
					className="fixed right-4 bottom-[5.5rem] md:bottom-24 w-[min(calc(100vw-2rem),380px)] h-[min(70vh,520px)] z-50 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
					role="dialog"
					aria-label="Chat"
				>
					<div className="flex items-center justify-between flex-shrink-0 px-3 py-2 border-b border-zinc-800 bg-zinc-900/95">
						<span className="text-white font-semibold text-sm">Chat</span>
						<button
							type="button"
							onClick={() => setChatOpen(false)}
							className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
							aria-label="Cerrar chat"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
						<Chat embedded />
					</div>
				</div>
			)}

			{/* Botón flotante: abrir chat (oculto cuando el panel está abierto para no tapar Enviar) */}
			{!chatOpen && (
				<button
					type="button"
					onClick={() => setChatOpen(true)}
					className="fixed right-4 bottom-20 md:bottom-6 z-50 w-14 h-14 rounded-full bg-orange-600 text-white shadow-lg shadow-orange-600/40 flex items-center justify-center hover:bg-orange-500 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-black"
					aria-label="Abrir chat"
				>
					<IconChatMobile className="w-7 h-7" aria-hidden />
				</button>
			)}

			{/* Barra inferior móvil: Inicio, Buscar, Top juegos, + PUTO FRIKI */}
			<nav
				className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-black/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
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
									isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-500 active:bg-zinc-800/80"
								}`
							}
						>
							<Icon className="text-current" aria-hidden />
							<span>{label}</span>
						</NavLink>
					))}
					<NavLink
						to="/buscar"
						className={({ isActive }) =>
							`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
								isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-500 active:bg-zinc-800/80"
							}`
						}
					>
						<IconSearchMobile className="text-current" aria-hidden />
						<span>Buscar</span>
					</NavLink>
					{NAV_ITEMS.slice(1, 3).map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
									isActive ? "text-orange-400 bg-orange-600/10" : "text-zinc-500 active:bg-zinc-800/80"
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
