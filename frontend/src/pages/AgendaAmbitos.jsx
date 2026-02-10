import { useState, useEffect } from "react";
import { apiBase } from "../api";
import { useUser } from "../App";
import { IconPlus } from "../components/Icons";
import { useToast } from "../components/ToastContext";

const PABLO_SLUG = "pablo";
const DEFAULT_COLORS = ["#a855f7", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"];

export default function AgendaAmbitos() {
	const { currentUser } = useUser();
	const { addToast } = useToast();
	const slug = currentUser?.slug;
	const [ambitos, setAmbitos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState({ name: "", color: DEFAULT_COLORS[0] });
	const [saving, setSaving] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [editName, setEditName] = useState("");

	useEffect(() => {
		if (!slug || currentUser?.slug !== PABLO_SLUG) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/ambitos`)
			.then((r) => (r.ok ? r.json() : { ambitos: [] }))
			.then((d) => setAmbitos(Array.isArray(d.ambitos) ? d.ambitos : []))
			.catch(() => setAmbitos([]))
			.finally(() => setLoading(false));
	}, [slug, currentUser?.slug]);

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!slug || !form.name?.trim() || saving) return;
		setSaving(true);
		fetch(`${apiBase}/api/users/${slug}/agenda/ambitos`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: form.name.trim(), color: form.color || null }),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) {
					setAmbitos((prev) => [...prev, row]);
					setForm({ name: "", color: DEFAULT_COLORS[ambitos.length % DEFAULT_COLORS.length] });
					setShowForm(false);
					addToast({ title: "Ámbito creado", description: row.name });
				} else addToast({ title: "Error", description: "No se pudo crear" });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo crear" }))
			.finally(() => setSaving(false));
	};

	const handleUpdate = (id) => {
		if (!slug || !editName.trim()) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/ambitos/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: editName.trim() }),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) setAmbitos((prev) => prev.map((a) => (a.id === id ? row : a)));
				setEditingId(null);
			});
	};

	const handleDelete = (id) => {
		if (!slug || !confirm("¿Eliminar este ámbito? Las tareas y metas seguirán pero sin ámbito.")) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/ambitos/${id}`, { method: "DELETE" })
			.then((r) => {
				if (r.ok) setAmbitos((prev) => prev.filter((a) => a.id !== id));
			});
	};

	if (!currentUser || currentUser.slug !== PABLO_SLUG) return null;

	return (
		<div className="max-w-2xl mx-auto">
			<h1 className="text-xl font-bold text-white mb-4">Ámbitos</h1>
			<p className="text-zinc-500 text-sm mb-4">Organiza tus misiones y metas por área (salud, estudio, trabajo, etc.).</p>

			{!showForm ? (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium mb-4"
				>
					<IconPlus size={18} /> Nuevo ámbito
				</button>
			) : (
				<form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 mb-4 flex flex-wrap items-end gap-3">
					<input
						type="text"
						value={form.name}
						onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						placeholder="Nombre (ej. Salud, Estudio)"
						className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500"
						required
					/>
					<div className="flex items-center gap-2">
						<label className="text-zinc-400 text-sm">Color</label>
						<input
							type="color"
							value={form.color}
							onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
							className="w-9 h-9 rounded-lg border border-zinc-700 cursor-pointer"
						/>
					</div>
					<button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
						{saving ? "Guardando…" : "Crear"}
					</button>
					<button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm">
						Cancelar
					</button>
				</form>
			)}

			{loading ? (
				<p className="text-zinc-500 py-8">Cargando…</p>
			) : ambitos.length === 0 ? (
				<p className="text-zinc-500 py-8 rounded-xl bg-zinc-900/50 border border-zinc-800">No hay ámbitos. Crea uno para organizar tus misiones.</p>
			) : (
				<ul className="space-y-2">
					{ambitos.map((a) => (
						<li key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex items-center gap-3">
							<div
								className="w-4 h-4 rounded-full flex-shrink-0"
								style={{ backgroundColor: a.color || "#52525b" }}
								aria-hidden
							/>
							{editingId === a.id ? (
								<>
									<input
										type="text"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
										autoFocus
									/>
									<button type="button" onClick={() => handleUpdate(a.id)} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm">Guardar</button>
									<button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-sm">Cancelar</button>
								</>
							) : (
								<>
									<span className="flex-1 text-white font-medium">{a.name}</span>
									<button type="button" onClick={() => { setEditingId(a.id); setEditName(a.name); }} className="text-zinc-500 hover:text-zinc-300 text-sm">Editar</button>
									<button type="button" onClick={() => handleDelete(a.id)} className="text-zinc-500 hover:text-red-400 text-sm">Eliminar</button>
								</>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
