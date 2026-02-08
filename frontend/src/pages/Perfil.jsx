import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useCurrentUserSlug, useUser } from "../App";
import { apiBase } from "../api";
import GameRow from "../components/GameRow";

export default function Perfil({ slug: propSlug }) {
	const { slug: paramSlug } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const currentSlug = useCurrentUserSlug();
	const { setRefreshJugadosTrigger } = useUser();
	const slug = propSlug || paramSlug;

	const tabFromUrl = searchParams.get("tab") === "pendientes" ? "pendientes" : "jugados";
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState(tabFromUrl);

	useEffect(() => {
		setTab(searchParams.get("tab") === "pendientes" ? "pendientes" : "jugados");
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
				<p className="text-zinc-400">Cargando perfil…</p>
			</div>
		);
	}
	if (!data) {
		return (
			<p className="text-zinc-400 py-12">Usuario no encontrado.</p>
		);
	}

	const isOwn = currentSlug === slug;
	const { user, jugados, pendientes } = data;

	const switchTab = (key) => {
		setTab(key);
		setSearchParams(key === "pendientes" ? { tab: "pendientes" } : {});
	};

	const tabButton = (key, label, count) => (
		<button
			type="button"
			onClick={() => switchTab(key)}
			className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
				tab === key
					? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
					: "text-zinc-400 hover:text-white hover:bg-zinc-800"
			}`}
		>
			{label} ({count})
		</button>
	);

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">
				Perfil de {user.name}
			</h1>
			<div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
				{tabButton("jugados", "Jugados", jugados.length)}
				{tabButton("pendientes", "Pendientes", pendientes.length)}
			</div>
			{tab === "jugados" && (
				<div className="space-y-4">
					{jugados.length === 0 ? (
						<p className="text-zinc-500 text-center py-12 rounded-2xl bg-zinc-900/50 border border-zinc-800">
							Aún no hay juegos jugados.
						</p>
					) : (
						jugados.map((g) => (
							<GameRow
								key={g.game_id}
								game={g}
								isJugado
								isOwn={isOwn}
								slug={slug}
								onRemove={refresh}
							/>
						))
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
						pendientes.map((g) => (
							<GameRow
								key={g.game_id}
								game={g}
								isJugado={false}
								isOwn={isOwn}
								slug={slug}
								onRemove={refresh}
							/>
						))
					)}
				</div>
			)}
		</>
	);
}
