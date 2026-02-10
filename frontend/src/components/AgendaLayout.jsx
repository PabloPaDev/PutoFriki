import { useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useUser } from "../App";
import { IconCalendar, IconTarget, IconLayers, IconGamepad } from "./Icons";

const PABLO_SLUG = "pablo";

const AGENDA_NAV = [
	{ to: "/agenda", end: true, label: "Calendario", Icon: IconCalendar },
	{ to: "/agenda/metas", end: false, label: "Metas", Icon: IconTarget },
	{ to: "/agenda/ambitos", end: false, label: "Ámbitos", Icon: IconLayers },
];

export default function AgendaLayout() {
	const { currentUser } = useUser();
	const navigate = useNavigate();

	useEffect(() => {
		if (currentUser && currentUser.slug !== PABLO_SLUG) {
			navigate("/", { replace: true });
		}
	}, [currentUser, navigate]);

	if (!currentUser || currentUser.slug !== PABLO_SLUG) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-zinc-950">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col pb-20 md:pb-0 relative bg-zinc-950">
			<header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm safe-area-inset-top">
				<div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 min-w-0">
						<IconCalendar className="flex-shrink-0 text-violet-500" size={22} strokeWidth={1.8} aria-hidden />
						<NavLink to="/agenda" className="font-bold text-white text-base sm:text-lg hover:opacity-90 truncate">
							Agenda
						</NavLink>
					</div>
					<div className="flex items-center gap-2">
						<NavLink
							to="/"
							className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
						>
							<IconGamepad size={18} strokeWidth={1.8} aria-hidden />
							<span className="hidden sm:inline">Juegos</span>
						</NavLink>
						<NavLink
							to={`/perfil/${currentUser.slug}`}
							className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-800 flex items-center justify-center text-white font-bold"
							aria-label="Mi perfil"
						>
							{currentUser.avatar ? (
								<img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
							) : (
								<span>{currentUser.name?.charAt(0) ?? "?"}</span>
							)}
						</NavLink>
					</div>
				</div>
			</header>
			<main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10">
				<Outlet />
			</main>
			<nav
				className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
				aria-label="Agenda"
			>
				<div className="flex items-stretch justify-around min-h-[56px]">
					{AGENDA_NAV.map(({ to, end, label, Icon }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-2 text-xs font-medium transition-colors ${
									isActive ? "text-violet-400 bg-violet-600/10" : "text-zinc-300 active:bg-zinc-800/80"
								}`
							}
						>
							<Icon className="text-current" aria-hidden size={22} />
							<span>{label}</span>
						</NavLink>
					))}
				</div>
			</nav>
		</div>
	);
}
