import { useState } from "react";
import { useUser } from "../App";
import { useToast } from "./ToastContext";
import { apiBase } from "../api";
import { formatReleaseDate } from "../utils/formatReleaseDate";

export default function GameRow({ game, isJugado, isJugandoTab, isPendientesTab, isOwn, slug, onRemove, isCompletadosTab, isAbandonadosTab }) {
	const { setRefreshJugadosTrigger, users, currentUser } = useUser();
	const { addToast } = useToast();
	const [savingJugando, setSavingJugando] = useState(false);
	const [sendingRecommend, setSendingRecommend] = useState(false);
	const otherUser = users?.find((u) => u.slug !== currentUser?.slug) ?? null;
	const canRecommend = !!slug && !!otherUser && !sendingRecommend;
	const [showCompleteForm, setShowCompleteForm] = useState(false);
	const [completeRating, setCompleteRating] = useState(7);
	const [completeOpinion, setCompleteOpinion] = useState("");
	const [completeAbandoned, setCompleteAbandoned] = useState(false);
	const [savingCompletado, setSavingCompletado] = useState(false);

	const handleRemove = () => {
		if (!confirm("¿Quitar de la lista?")) return;
		const path = isJugandoTab ? "jugando" : isJugado ? "jugados" : "pendientes";
		fetch(`${apiBase}/api/users/${slug}/${path}/${game.game_id}`, { method: "DELETE" })
			.then((r) => r.json())
			.then(() => {
				onRemove?.();
				if (isJugado || isJugandoTab) setRefreshJugadosTrigger?.((t) => t + 1);
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

	const handleMoveToJugando = () => {
		if (!slug || savingJugando) return;
		setSavingJugando(true);
		const payload = {
			rawg_id: Number(game.rawg_id) || game.rawg_id,
			name: game.name,
			released: game.released,
			image_url: game.image_url,
			genres: game.genres,
			platforms: game.platforms,
			metacritic: game.metacritic,
		};
		fetch(`${apiBase}/api/users/${slug}/jugando`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data.error) {
					alert(data?.error || "Error al mover");
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				return fetch(`${apiBase}/api/users/${slug}/pendientes/${game.game_id}`, { method: "DELETE" });
			})
			.then((r) => (r && r.ok ? r.json() : null))
			.then(() => {
				onRemove?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => alert("Error al mover a Jugando"))
			.finally(() => setSavingJugando(false));
	};

	const handleMarkCompleted = (e) => {
		e?.preventDefault();
		if (!slug || savingCompletado) return;
		setSavingCompletado(true);
		const payload = {
			rawg_id: Number(game.rawg_id) || game.rawg_id,
			name: game.name,
			released: game.released,
			image_url: game.image_url,
			genres: game.genres,
			platforms: game.platforms,
			metacritic: game.metacritic,
			rating: Number(completeRating),
			opinion: completeOpinion.trim() || null,
			completed: !completeAbandoned,
		};
		fetch(`${apiBase}/api/users/${slug}/jugados`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, data })))
			.then(({ ok, data }) => {
				if (!ok || data.error) {
					alert(data?.error || "Error al guardar");
					return;
				}
				(data.newlyUnlocked || []).forEach((a) =>
					addToast({ title: a.title, description: a.description, icon: a.icon })
				);
				return fetch(`${apiBase}/api/users/${slug}/jugando/${game.game_id}`, { method: "DELETE" });
			})
			.then((r) => (r && r.ok ? r.json() : null))
			.then(() => {
				setShowCompleteForm(false);
				onRemove?.();
				setRefreshJugadosTrigger?.((t) => t + 1);
			})
			.catch(() => alert("Error al marcar como completado"))
			.finally(() => setSavingCompletado(false));
	};

	const handleRecommend = () => {
		if (!slug || !otherUser || sendingRecommend) return;
		setSendingRecommend(true);
		const body = `Te recomiendo: ${game.name}`;
		fetch(`${apiBase}/api/users/${slug}/messages`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				to_slug: otherUser.slug,
				body,
				game_id: game.game_id ?? null,
				rawg_id: game.rawg_id ?? game.id,
			}),
		})
			.then((r) => (r.ok ? r.json() : r.json().then((d) => ({ error: d.error }))))
			.then((data) => {
				if (data?.error) {
					addToast({ title: "Error", description: data.error || "No se pudo enviar" });
					return;
				}
				addToast({ title: "Enviado", description: `Recomendación enviada a ${otherUser.name} por el chat` });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo enviar la recomendación" }))
			.finally(() => setSendingRecommend(false));
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
					{isJugado && game.rating != null && (
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
						{isPendientesTab && (
							<button
								type="button"
								onClick={handleMoveToJugando}
								disabled={savingJugando}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/90 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
							>
								{savingJugando ? "…" : "Jugando"}
							</button>
						)}
						{isJugandoTab && (
							<>
								{!showCompleteForm ? (
									<>
										<button
											type="button"
											onClick={() => setShowCompleteForm(true)}
											className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/90 text-white hover:bg-emerald-500 transition-colors"
										>
											Completado
										</button>
										<button
											type="button"
											onClick={handleRemove}
											className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
										>
											Quitar
										</button>
									</>
								) : (
									<form onSubmit={handleMarkCompleted} className="mt-2 space-y-2 w-full max-w-sm">
										<div>
											<label className="block text-zinc-400 text-xs font-medium mb-0.5">Valoración (0-10)</label>
											<input
												type="number"
												min="0"
												max="10"
												step="0.5"
												value={completeRating}
												onChange={(e) => setCompleteRating(e.target.value)}
												disabled={savingCompletado}
												className="w-24 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
											/>
										</div>
										<div>
											<label className="block text-zinc-400 text-xs font-medium mb-0.5">Opinión (opcional)</label>
											<textarea
												rows={2}
												value={completeOpinion}
												onChange={(e) => setCompleteOpinion(e.target.value)}
												placeholder="Tu opinión..."
												disabled={savingCompletado}
												className="w-full px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder-zinc-500 resize-none"
											/>
										</div>
										<label className="flex items-center gap-2 text-zinc-400 text-xs cursor-pointer">
											<input
												type="checkbox"
												checked={completeAbandoned}
												onChange={(e) => setCompleteAbandoned(e.target.checked)}
												disabled={savingCompletado}
												className="rounded border-zinc-600 bg-zinc-800 text-amber-500"
											/>
											Lo abandoné
										</label>
										<div className="flex gap-2">
											<button
												type="submit"
												disabled={savingCompletado}
												className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
											>
												{savingCompletado ? "Guardando…" : "Guardar"}
											</button>
											<button
												type="button"
												onClick={() => setShowCompleteForm(false)}
												disabled={savingCompletado}
												className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
											>
												Cancelar
											</button>
										</div>
									</form>
								)}
							</>
						)}
						{!isJugandoTab && isCompletadosTab && (
							<button
								type="button"
								onClick={() => handleToggleCompleted(false)}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/80 text-white hover:bg-amber-500 transition-colors"
							>
								Marcar como abandonado
							</button>
						)}
						{!isJugandoTab && isAbandonadosTab && (
							<button
								type="button"
								onClick={() => handleToggleCompleted(true)}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 text-white hover:bg-emerald-500 transition-colors"
							>
								Marcar como completado
							</button>
						)}
						{!isJugandoTab && (
							<button
								type="button"
								onClick={handleRemove}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
							>
								Quitar
							</button>
						)}
						{otherUser && (
							<button
								type="button"
								onClick={handleRecommend}
								disabled={!canRecommend}
								className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600/90 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
							>
								{sendingRecommend ? "…" : "Recomendar"}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
