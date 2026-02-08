import { useState, useEffect } from "react";
import { useUser } from "../App";
import { apiBase } from "../api";

const PERIODS = [
	{ key: "month", label: "Mensual" },
	{ key: "year", label: "Anual" },
	{ key: "all", label: "Histórico" },
];

function periodDescription(period, since) {
	if (period === "month") {
		const d = since ? new Date(since) : new Date();
		return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
	}
	if (period === "year") {
		const d = since ? new Date(since) : new Date();
		return d.getFullYear().toString();
	}
	return "Todos los tiempos";
}

export default function Amigos() {
	const { refreshJugadosTrigger } = useUser();
	const [period, setPeriod] = useState("all");
	const [data, setData] = useState(null);

	useEffect(() => {
		fetch(`${apiBase}/api/ranking/competencia?period=${period}`)
			.then((r) => r.json())
			.then(setData)
			.catch(() => setData(null));
	}, [period, refreshJugadosTrigger]);

	if (!data) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	const { ranking, period: p } = data;
	const title = periodDescription(p, data.since);
	const maxCount = Math.max(...ranking.map((r) => r.count), 1);

	return (
		<>
			<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
				+ Friki
			</h1>
			<p className="text-zinc-400 mb-6">
				¿Quién ha jugado más? Solo cuentan los juegos jugados (no pendientes ni esperados). Elige el periodo.
			</p>
			<div className="flex flex-wrap gap-2 mb-8">
				{PERIODS.map(({ key, label }) => (
					<button
						key={key}
						type="button"
						onClick={() => setPeriod(key)}
						className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
							period === key
								? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
								: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
						}`}
					>
						{label}
					</button>
				))}
			</div>
			<p className="text-zinc-500 text-sm capitalize mb-6">
				{title}
			</p>
			<div className="space-y-4 max-w-md">
				{ranking.map((r, i) => {
					const position = i + 1;
					const isFirst = position === 1;
					const isSecond = position === 2;
					const isThird = position === 3;
					const barWidth = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
					return (
						<div
							key={r.user.id}
							className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
								isFirst
									? "bg-amber-500/10 border-amber-500/30"
									: isSecond
										? "bg-zinc-400/10 border-zinc-400/30"
										: isThird
											? "bg-amber-700/10 border-amber-700/30"
											: "bg-zinc-900/80 border-zinc-800"
							}`}
						>
							<span
								className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
									isFirst
										? "bg-amber-500/80 text-black"
										: isSecond
											? "bg-zinc-400/80 text-black"
											: isThird
												? "bg-amber-700/80 text-white"
												: "bg-zinc-700 text-zinc-300"
								}`}
							>
								{position}º
							</span>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between gap-2 mb-1">
									<span className="font-semibold text-white truncate">
										{r.user.name}
									</span>
									<span className="text-zinc-400 font-medium flex-shrink-0">
										{r.count} {r.count === 1 ? "juego jugado" : "juegos jugados"}
									</span>
								</div>
								<div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
									<div
										className={`h-full rounded-full transition-all duration-500 ${
											isFirst
												? "bg-amber-500"
												: isSecond
													? "bg-zinc-400"
													: isThird
														? "bg-amber-700"
														: "bg-violet-600"
										}`}
										style={{ width: `${barWidth}%` }}
									/>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
