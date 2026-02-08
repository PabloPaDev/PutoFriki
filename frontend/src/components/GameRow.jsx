import { useUser } from "../App";
import { useToast } from "./ToastContext";
import { apiBase } from "../api";
import { formatReleaseDate } from "../utils/formatReleaseDate";

export default function GameRow({ game, isJugado, isOwn, slug, onRemove, isCompletadosTab, isAbandonadosTab }) {
	const { setRefreshJugadosTrigger } = useUser();
	const { addToast } = useToast();

	const handleRemove = () => {
		if (!confirm("¿Quitar de la lista?")) return;
		const path = isJugado ? "jugados" : "pendientes";
		fetch(`${apiBase}/api/users/${slug}/${path}/${game.game_id}`, { method: "DELETE" })
			.then((r) => r.json())
			.then(() => {
				onRemove?.();
				if (isJugado) setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => alert("Error"));
	};

	const handleToggleCompleted = (completed) => {
		fetch(`${apiBase}/api/users/${slug}/jugados/${game.game_id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ completed }),
		})
			.then((r) => r.json())
			.then((data) => {
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				onRemove?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => alert("Error"));
	};

	const releaseLabel = formatReleaseDate(game.released);
	const genres = Array.isArray(game.genres) ? game.genres.join(", ") : "";

	return (
		<div className="flex gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
			{game.image_url && (
				<img
					src={game.image_url}
					alt=""
					className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded-lg flex-shrink-0 shadow-md"
				/>
			)}
			<div className="flex-1 min-w-0">
				<h3 className="text-base sm:text-lg font-semibold text-white mb-0.5">{game.name}</h3>
				<p className="text-zinc-400 text-xs sm:text-sm">
					{releaseLabel}
					{genres && ` · ${genres}`}
					{isJugado && (
						<span className="inline-block ml-1.5 px-2 py-0.5 rounded-md bg-orange-600/80 text-white text-xs font-medium">
							{game.rating}/10
						</span>
					)}
				</p>
				{isJugado && game.opinion && (
					<p className="text-zinc-500 text-xs mt-1.5 leading-snug line-clamp-2">{game.opinion}</p>
				)}
				{isOwn && (
					<div className="mt-2 flex flex-wrap gap-2">
						{isCompletadosTab && (
							<button
								type="button"
								onClick={() => handleToggleCompleted(false)}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/80 text-white hover:bg-amber-500 transition-colors"
							>
								Marcar como abandonado
							</button>
						)}
						{isAbandonadosTab && (
							<button
								type="button"
								onClick={() => handleToggleCompleted(true)}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 text-white hover:bg-emerald-500 transition-colors"
							>
								Marcar como completado
							</button>
						)}
						<button
							type="button"
							onClick={handleRemove}
							className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
						>
							Quitar
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
