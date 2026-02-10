import { useState, useEffect } from "react";
import { apiBase } from "../api";
import { useUser } from "../App";
import { IconPlus } from "../components/Icons";
import { useToast } from "../components/ToastContext";

const PABLO_SLUG = "pablo";
const GOAL_TYPES = [
	{ key: "weekly", label: "Semanal" },
	{ key: "monthly", label: "Mensual" },
	{ key: "annual", label: "Anual" },
];

function getPeriodKey(type) {
	const d = new Date();
	const y = d.getFullYear();
	if (type === "annual") return String(y);
	if (type === "monthly") return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	const start = new Date(d);
	start.setDate(1);
	const day = start.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	start.setDate(start.getDate() + diff);
	const weekNum = Math.ceil((d - start) / (7 * 24 * 60 * 60 * 1000));
	return `${y}-W${String(weekNum).padStart(2, "0")}`;
}

export default function AgendaMetas() {
	const { currentUser } = useUser();
	const { addToast } = useToast();
	const slug = currentUser?.slug;
	const [goals, setGoals] = useState([]);
	const [ambitos, setAmbitos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterType, setFilterType] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState({ title: "", goal_type: "weekly", ambito_id: "", target_value: "", target_unit: "" });
	const [saving, setSaving] = useState(false);
	const [updatingId, setUpdatingId] = useState(null);

	useEffect(() => {
		if (!slug || currentUser?.slug !== PABLO_SLUG) return;
		Promise.all([
			fetch(`${apiBase}/api/users/${slug}/agenda/goals`).then((r) => (r.ok ? r.json() : { goals: [] })),
			fetch(`${apiBase}/api/users/${slug}/agenda/ambitos`).then((r) => (r.ok ? r.json() : { ambitos: [] })),
		])
			.then(([g, a]) => {
				setGoals(Array.isArray(g.goals) ? g.goals : g.goals || []);
				setAmbitos(Array.isArray(a.ambitos) ? a.ambitos : a.ambitos || []);
			})
			.catch(() => setGoals([]))
			.finally(() => setLoading(false));
	}, [slug, currentUser?.slug]);

	const refetch = () => {
		if (!slug) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/goals`)
			.then((r) => (r.ok ? r.json() : { goals: [] }))
			.then((d) => setGoals(Array.isArray(d.goals) ? d.goals : []));
	};

	const filtered = filterType ? goals.filter((g) => g.goal_type === filterType) : goals;

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!slug || !form.title?.trim() || saving) return;
		setSaving(true);
		const period_key = getPeriodKey(form.goal_type);
		fetch(`${apiBase}/api/users/${slug}/agenda/goals`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: form.title.trim(),
				goal_type: form.goal_type,
				period_key,
				ambito_id: form.ambito_id ? Number(form.ambito_id) : null,
				target_value: form.target_value ? Number(form.target_value) : null,
				target_unit: form.target_unit?.trim() || null,
			}),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) {
					setGoals((prev) => [...prev, row]);
					setForm({ title: "", goal_type: "weekly", ambito_id: "", target_value: "", target_unit: "" });
					setShowForm(false);
					addToast({ title: "Meta creada", description: row.title });
				} else addToast({ title: "Error", description: "No se pudo crear la meta" });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo crear la meta" }))
			.finally(() => setSaving(false));
	};

	const handleUpdateProgress = (goal, delta) => {
		if (!slug || updatingId) return;
		const newVal = (goal.current_value || 0) + delta;
		setUpdatingId(goal.id);
		fetch(`${apiBase}/api/users/${slug}/agenda/goals/${goal.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ current_value: Math.max(0, newVal) }),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) setGoals((prev) => prev.map((g) => (g.id === goal.id ? row : g)));
			})
			.finally(() => setUpdatingId(null));
	};

	const handleDelete = (id) => {
		if (!slug || !confirm("¿Eliminar esta meta?")) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/goals/${id}`, { method: "DELETE" })
			.then((r) => {
				if (r.ok) setGoals((prev) => prev.filter((g) => g.id !== id));
			});
	};

	if (!currentUser || currentUser.slug !== PABLO_SLUG) return null;

	return (
		<div className="max-w-2xl mx-auto">
			<h1 className="text-xl font-bold text-white mb-4">Metas</h1>
			<div className="flex flex-wrap gap-2 mb-4">
				<button
					type="button"
					onClick={() => setFilterType("")}
					className={`px-3 py-1.5 rounded-lg text-sm ${!filterType ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
				>
					Todas
				</button>
				{GOAL_TYPES.map(({ key, label }) => (
					<button
						key={key}
						type="button"
						onClick={() => setFilterType(key)}
						className={`px-3 py-1.5 rounded-lg text-sm ${filterType === key ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
					>
						{label}
					</button>
				))}
			</div>

			{!showForm ? (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium mb-4"
				>
					<IconPlus size={18} /> Nueva meta
				</button>
			) : (
				<form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 mb-4">
					<input
						type="text"
						value={form.title}
						onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
						placeholder="Título de la meta"
						className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 mb-3"
						required
					/>
					<select
						value={form.goal_type}
						onChange={(e) => setForm((f) => ({ ...f, goal_type: e.target.value }))}
						className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white mb-3"
					>
						{GOAL_TYPES.map(({ key, label }) => (
							<option key={key} value={key}>{label}</option>
						))}
					</select>
					<select
						value={form.ambito_id}
						onChange={(e) => setForm((f) => ({ ...f, ambito_id: e.target.value }))}
						className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white mb-3"
					>
						<option value="">Sin ámbito</option>
						{ambitos.map((a) => (
							<option key={a.id} value={a.id}>{a.name}</option>
						))}
					</select>
					<div className="flex gap-2 mb-3">
						<input
							type="number"
							step="any"
							value={form.target_value}
							onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
							placeholder="Objetivo (ej. 20)"
							className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500"
						/>
						<input
							type="text"
							value={form.target_unit}
							onChange={(e) => setForm((f) => ({ ...f, target_unit: e.target.value }))}
							placeholder="Unidad (km, h...)"
							className="w-24 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500"
						/>
					</div>
					<div className="flex gap-2">
						<button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
							{saving ? "Guardando…" : "Crear"}
						</button>
						<button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm">
							Cancelar
						</button>
					</div>
				</form>
			)}

			{loading ? (
				<p className="text-zinc-500 py-8">Cargando metas…</p>
			) : filtered.length === 0 ? (
				<p className="text-zinc-500 py-8 rounded-xl bg-zinc-900/50 border border-zinc-800">No hay metas. Añade metas semanales, mensuales o anuales por ámbito.</p>
			) : (
				<ul className="space-y-3">
					{filtered.map((g) => (
						<li key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-wrap items-center gap-2">
							<div className="flex-1 min-w-0">
								<p className="text-white font-medium">{g.title}</p>
								<p className="text-zinc-500 text-sm">
									{g.ambito_name && <span className="text-zinc-400">{g.ambito_name}</span>}
									{g.ambito_name && " · "}
									{g.goal_type === "weekly" ? "Semanal" : g.goal_type === "monthly" ? "Mensual" : "Anual"} {g.period_key}
									{g.target_value != null && ` · ${g.current_value ?? 0} / ${g.target_value} ${g.target_unit || ""}`}
								</p>
							</div>
							{g.target_value != null && (
								<div className="flex items-center gap-1">
									<button type="button" onClick={() => handleUpdateProgress(g, -1)} disabled={updatingId === g.id} className="w-8 h-8 rounded-lg bg-zinc-700 text-white text-sm font-bold">−</button>
									<span className="text-zinc-300 text-sm w-8 text-center">{g.current_value ?? 0}</span>
									<button type="button" onClick={() => handleUpdateProgress(g, 1)} disabled={updatingId === g.id} className="w-8 h-8 rounded-lg bg-zinc-700 text-white text-sm font-bold">+</button>
								</div>
							)}
							<button type="button" onClick={() => handleDelete(g.id)} className="text-zinc-500 hover:text-red-400 text-sm">Eliminar</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
