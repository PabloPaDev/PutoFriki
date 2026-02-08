import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../App";
import { apiBase } from "../api";
import { IconTrophy, IconPlus } from "./Icons";

export default function AmigosSidebar() {
	const { currentUser, users, refreshJugadosTrigger } = useUser();
	const [countBySlug, setCountBySlug] = useState({});

	const fetchCounts = () => {
		fetch(`${apiBase}/api/ranking/competencia?period=all`)
			.then((r) => r.json())
			.then((data) => {
				const map = {};
				(data?.ranking ?? []).forEach((r) => {
					map[r.user.slug] = r.count ?? 0;
				});
				setCountBySlug(map);
			})
			.catch(() => setCountBySlug({}));
	};

	useEffect(() => {
		fetchCounts();
	}, [refreshJugadosTrigger]);

	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible") fetchCounts();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, []);

	const list = users && users.length > 0 ? users : [];

	return (
		<aside className="w-full lg:w-72 flex-shrink-0">
			<div className="lg:sticky lg:top-24 rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4">
				<div className="flex items-center justify-between mb-3">
					<Link
						to="/amigos"
						className="flex items-center gap-2 text-zinc-300 hover:text-white font-medium transition-colors"
					>
						<IconTrophy className="text-current" size={20} strokeWidth={1.8} aria-hidden />
						+ Friki
					</Link>
					<Link
						to="/amigos"
						className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
						title="Ver + Friki"
					>
						<IconPlus className="text-current" size={18} strokeWidth={1.8} aria-hidden />
					</Link>
				</div>
				<ul className="space-y-3 mt-3">
					{list.map((u) => {
						const initial = (u.name || "?").charAt(0).toUpperCase();
						const isCurrent = currentUser?.slug === u.slug;
						const count = countBySlug[u.slug] ?? 0;
						return (
							<li key={u.id}>
								<Link
									to={isCurrent ? "/" : `/perfil/${u.slug}`}
									className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
										isCurrent
											? "bg-violet-600/20 text-violet-300"
											: "hover:bg-zinc-800 text-zinc-300 hover:text-white"
									}`}
								>
									<span className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-base font-semibold flex-shrink-0 text-white">
										{initial}
									</span>
									<div className="flex-1 min-w-0">
										<p className="font-semibold text-white truncate">{u.name}</p>
										<p className="text-zinc-500 text-sm">
											{count} {count === 1 ? "juego jugado" : "juegos jugados"}
										</p>
									</div>
								</Link>
							</li>
						);
					})}
				</ul>
				{list.length === 0 && (
					<p className="text-zinc-500 text-sm py-2">Cargando amigos…</p>
				)}
			</div>
		</aside>
	);
}
