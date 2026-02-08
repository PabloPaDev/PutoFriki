import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useUser } from "./App";
import AmigosSidebar from "./components/AmigosSidebar";
import {
	IconGamepad,
	IconHomeMobile,
	IconSearchMobile,
	IconStarMobile,
	IconTrophyMobile,
	IconPlusMobile,
} from "./components/Icons";

const NAV_ITEMS = [
	{ to: "/", end: true, label: "Inicio", Icon: IconHomeMobile },
	{ to: "/buscar", end: false, label: "Buscar", Icon: IconSearchMobile },
	{ to: "/ranking", end: false, label: "Top juegos", Icon: IconStarMobile },
	{ to: "/amigos", end: false, label: "+ Friki", Icon: IconTrophyMobile },
];

export default function Layout() {
	const { currentUser, users } = useUser();
	const location = useLocation();
	const isHome = location.pathname === "/";

	const linkClass = ({ isActive }) =>
		`min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
			isActive
				? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
				: "text-zinc-400 hover:text-white hover:bg-zinc-800"
		}`;

	return (
		<div className="min-h-screen flex flex-col pb-16 md:pb-0">
			<header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md safe-area-inset-top">
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
							className="ml-2 min-h-[44px] flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors"
						>
							+ Buscar
						</NavLink>
						{users
							.filter((u) => u.slug !== currentUser?.slug)
							.map((u) => (
								<NavLink key={u.id} to={`/perfil/${u.slug}`} className={linkClass}>
									{u.name}
								</NavLink>
							))}
					</nav>
					{/* Móvil: botón que abre navegación inferior (solo indicador) */}
					<div className="md:hidden flex-shrink-0 w-10 h-10" aria-hidden />
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
			{/* Barra inferior móvil (PWA-style) */}
			<nav
				className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
				aria-label="Navegación principal"
			>
				<div className="flex items-stretch justify-around min-h-[56px]">
					{NAV_ITEMS.slice(0, 2).map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
									isActive ? "text-violet-400 bg-violet-600/10" : "text-zinc-500 active:bg-zinc-800/80"
								}`
							}
						>
							<Icon className="text-current" aria-hidden />
							<span>{label}</span>
						</NavLink>
					))}
					<NavLink
						to="/buscar"
						className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium text-emerald-400 active:bg-zinc-800/80"
					>
						<IconPlusMobile className="text-current" aria-hidden />
						<span>Añadir</span>
					</NavLink>
					{NAV_ITEMS.slice(2, 4).map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
									isActive ? "text-violet-400 bg-violet-600/10" : "text-zinc-500 active:bg-zinc-800/80"
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
