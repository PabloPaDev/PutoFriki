import { useState, useEffect } from "react";
import { useCurrentUserSlug } from "../App";
import { apiBase } from "../api";
import { formatReleaseDate } from "../utils/formatReleaseDate";

function fetchRanking(slug, order) {
	return fetch(`${apiBase}/api/users/${slug}/ranking?order=${order}`)
		.then((r) => r.json())
		.then((data) => data)
		.catch(() => null);
}

export default function Ranking() {
	const slug = useCurrentUserSlug();
	const [order, setOrder] = useState("rating");
	const [data, setData] = useState(null);

	useEffect(() => {
		if (!slug) return;
		fetchRanking(slug, order).then(setData);
	}, [slug, order]);

	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible" && slug) {
				fetchRanking(slug, order).then(setData);
			}
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [slug, order]);

	if (!data) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-zinc-400">Cargando top juegos…</p>
			</div>
		);
	}

	const { user, ranking } = data;

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
				Top juegos — {user.name}
			</h1>
			<p className="text-zinc-400 mb-6">
				Tus juegos ordenados por valoración o por fecha.
			</p>
			<div className="flex gap-2 mb-8">
				<button
					type="button"
					onClick={() => setOrder("rating")}
					className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
						order === "rating"
							? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
							: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
					}`}
				>
					Por valoración
				</button>
				<button
					type="button"
					onClick={() => setOrder("played_at")}
					className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
						order === "played_at"
							? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
							: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
					}`}
				>
					Por fecha
				</button>
			</div>
			{ranking.length === 0 ? (
				<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
					Aún no tienes juegos en tu top. Añade jugados desde Buscar.
				</p>
			) : (
				<ul className="space-y-4">
					{ranking.map((g, i) => (
						<li
							key={g.game_id}
							className="flex gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors items-start"
						>
							<span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-600/80 text-white font-bold text-sm flex items-center justify-center">
								#{i + 1}
							</span>
							{g.image_url && (
								<img
									src={g.image_url}
									alt=""
									className="w-24 h-32 sm:w-32 sm:h-44 object-cover rounded-xl flex-shrink-0 shadow-lg"
								/>
							)}
							<div className="flex-1 min-w-0">
								<div className="flex flex-wrap items-center gap-2 mb-1">
									<h3 className="text-lg sm:text-xl font-semibold text-white">{g.name}</h3>
									<span className="px-2.5 py-0.5 rounded-lg bg-orange-600/80 text-white text-sm font-medium">
										{g.rating}/10
									</span>
								</div>
								<p className="text-zinc-400 text-sm">
									{formatReleaseDate(g.released)}
									{Array.isArray(g.genres) && g.genres.length
										? ` · ${g.genres.join(", ")}`
										: ""}
								</p>
								{g.opinion && (
									<p className="text-zinc-500 text-sm mt-2 leading-relaxed">{g.opinion}</p>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
