import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUser } from "../App";
import { apiBase } from "../api";
import { useToast } from "../components/ToastContext";
import { IconPlus } from "../components/Icons";

const PABLO_SLUG = "pablo";
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
	"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
	"Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const HOURS_START = 6;
const HOURS_END = 24;

function isSameDay(a, b) {
	if (!a || !b) return false;
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d) {
	return isSameDay(d, new Date());
}

function startOfDay(d) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

function getStartOfWeek(d) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	const day = x.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	x.setDate(x.getDate() + diff);
	return x;
}

function getMonthGrid(year, month) {
	const first = new Date(year, month, 1);
	const start = getStartOfWeek(first);
	const grid = [];
	let curr = new Date(start);
	for (let row = 0; row < 6; row++) {
		const week = [];
		for (let col = 0; col < 7; col++) {
			week.push(new Date(curr));
			curr.setDate(curr.getDate() + 1);
		}
		grid.push(week);
	}
	return grid;
}

function getHourSlots() {
	const slots = [];
	for (let h = HOURS_START; h < HOURS_END; h++) {
		slots.push({ hour: h, label: `${h.toString().padStart(2, "0")}:00` });
	}
	return slots;
}

function dateToKey(d) {
	return d.toISOString().slice(0, 10);
}

export default function Agenda() {
	const { currentUser } = useUser();
	const { addToast } = useToast();
	const slug = currentUser?.slug;
	const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
	const [viewMode, setViewMode] = useState("month");
	const [tasks, setTasks] = useState([]);
	const [tasksLoading, setTasksLoading] = useState(false);
	const [ambitos, setAmbitos] = useState([]);
	const [savingTask, setSavingTask] = useState(false);
	const [togglingId, setTogglingId] = useState(null);
	const [addModal, setAddModal] = useState({ open: false, date: null, timeSlot: null });
	const [modalTitle, setModalTitle] = useState("");
	const [modalAmbitoId, setModalAmbitoId] = useState("");

	const goPrev = () => {
		const d = new Date(currentDate);
		if (viewMode === "month") d.setMonth(d.getMonth() - 1);
		else if (viewMode === "week") d.setDate(d.getDate() - 7);
		else d.setDate(d.getDate() - 1);
		setCurrentDate(d);
	};

	const goNext = () => {
		const d = new Date(currentDate);
		if (viewMode === "month") d.setMonth(d.getMonth() + 1);
		else if (viewMode === "week") d.setDate(d.getDate() + 7);
		else d.setDate(d.getDate() + 1);
		setCurrentDate(d);
	};

	const goToday = () => setCurrentDate(startOfDay(new Date()));

	const headerTitle = useMemo(() => {
		if (viewMode === "month") {
			return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
		}
		if (viewMode === "week") {
			const start = getStartOfWeek(currentDate);
			const end = new Date(start);
			end.setDate(end.getDate() + 6);
			return `${start.getDate()} - ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
		}
		return `${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
	}, [currentDate, viewMode]);

	const weekStart = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
	const hourSlots = useMemo(() => getHourSlots(), []);

	const taskRange = useMemo(() => {
		if (viewMode === "day") {
			const k = dateToKey(currentDate);
			return { from: k, to: k };
		}
		if (viewMode === "week") {
			const start = getStartOfWeek(currentDate);
			const end = new Date(start);
			end.setDate(end.getDate() + 6);
			return { from: dateToKey(start), to: dateToKey(end) };
		}
		const y = currentDate.getFullYear();
		const m = currentDate.getMonth();
		return { from: `${y}-${String(m + 1).padStart(2, "0")}-01`, to: dateToKey(new Date(y, m + 1, 0)) };
	}, [currentDate, viewMode]);

	useEffect(() => {
		if (!slug) return;
		setTasksLoading(true);
		fetch(`${apiBase}/api/users/${slug}/agenda/tasks?from=${taskRange.from}&to=${taskRange.to}`)
			.then((r) => (r.ok ? r.json() : { tasks: [] }))
			.then((d) => setTasks(d.tasks || []))
			.catch(() => setTasks([]))
			.finally(() => setTasksLoading(false));
	}, [slug, taskRange.from, taskRange.to]);

	useEffect(() => {
		if (!slug) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/ambitos`)
			.then((r) => (r.ok ? r.json() : { ambitos: [] }))
			.then((d) => setAmbitos(d.ambitos || []))
			.catch(() => setAmbitos([]));
	}, [slug]);

	const tasksForDate = (d) => tasks.filter((t) => t.task_date === dateToKey(d));

	const refetchTasks = () => {
		if (!slug) return;
		fetch(`${apiBase}/api/users/${slug}/agenda/tasks?from=${taskRange.from}&to=${taskRange.to}`)
			.then((r) => (r.ok ? r.json() : { tasks: [] }))
			.then((d) => setTasks(d.tasks || []));
	};

	const handleToggleTask = (task) => {
		if (!slug || togglingId) return;
		setTogglingId(task.id);
		const completed = !task.completed_at;
		fetch(`${apiBase}/api/users/${slug}/agenda/tasks/${task.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ completed_at: completed }),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) setTasks((prev) => prev.map((t) => (t.id === task.id ? row : t)));
			})
			.finally(() => setTogglingId(null));
	};

	const openAddModal = (date, timeSlot = null) => {
		setAddModal({ open: true, date: date ? new Date(date) : new Date(currentDate), timeSlot });
		setModalTitle("");
		setModalAmbitoId("");
	};

	const closeAddModal = () => {
		setAddModal({ open: false, date: null, timeSlot: null });
		setModalTitle("");
		setModalAmbitoId("");
	};

	const handleAddTask = (e) => {
		e.preventDefault();
		const date = addModal.date || currentDate;
		if (!slug || !modalTitle.trim() || savingTask) return;
		setSavingTask(true);
		fetch(`${apiBase}/api/users/${slug}/agenda/tasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: modalTitle.trim(),
				task_date: dateToKey(date),
				time_slot: addModal.timeSlot || null,
				ambito_id: modalAmbitoId ? Number(modalAmbitoId) : null,
			}),
		})
			.then((r) => (r.ok ? r.json() : null))
			.then((row) => {
				if (row) {
					setTasks((prev) => [...prev, row]);
					closeAddModal();
					addToast({ title: "Misión añadida", description: row.title });
				} else addToast({ title: "Error", description: "No se pudo añadir" });
			})
			.catch(() => addToast({ title: "Error", description: "No se pudo añadir" }))
			.finally(() => setSavingTask(false));
	};

	const dayTasks = tasksForDate(currentDate);

	return (
		<div className="max-w-6xl mx-auto px-2 sm:px-4 pb-8">
			{/* Header estilo Google Calendar */}
			<div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={goPrev}
						className="p-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
						aria-label="Anterior"
					>
						<ChevronLeft size={24} strokeWidth={2} />
					</button>
					<button
						type="button"
						onClick={goNext}
						className="p-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
						aria-label="Siguiente"
					>
						<ChevronRight size={24} strokeWidth={2} />
					</button>
				</div>
				<button
					type="button"
					onClick={goToday}
					className="px-3 py-1.5 rounded-lg text-sm font-medium border border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
				>
					Hoy
				</button>
				<h2 className="text-lg sm:text-xl font-semibold text-white min-w-[180px] sm:min-w-[220px]">
					{headerTitle}
				</h2>
				<div className="flex rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900/80 p-0.5 ml-auto">
					{(["day", "week", "month"]).map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => setViewMode(mode)}
							className={`px-3 py-1.5 text-sm font-medium transition-colors ${
								viewMode === mode
									? "bg-violet-600 text-white"
									: "text-zinc-400 hover:text-white hover:bg-zinc-800"
							}`}
						>
							{mode === "day" ? "Día" : mode === "week" ? "Semana" : "Mes"}
						</button>
					))}
				</div>
			</div>

			{/* 1. Eventos del día (primero): lista de misiones del día seleccionado */}
			<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 mb-4">
				<h3 className="text-sm font-semibold text-zinc-300 mb-3">
					Eventos del día — {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]}
				</h3>
				{tasksLoading ? (
					<p className="text-zinc-500 text-sm">Cargando…</p>
				) : dayTasks.length === 0 ? (
					<p className="text-zinc-500 text-sm">Sin eventos. Haz clic en una hora (vista Día) o en un día (vista Mes) para añadir una tarea.</p>
				) : (
					<ul className="space-y-2">
						{dayTasks.map((t) => (
							<li key={t.id} className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => handleToggleTask(t)}
									disabled={togglingId === t.id}
									className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
										t.completed_at ? "bg-violet-600 border-violet-600 text-white" : "border-zinc-500 hover:border-violet-500"
									}`}
									aria-label={t.completed_at ? "Marcar sin completar" : "Completar"}
								>
									{t.completed_at && <span className="text-white text-sm leading-none">✓</span>}
								</button>
								{t.time_slot && <span className="text-zinc-500 text-xs w-10">{t.time_slot}</span>}
								<span className={`flex-1 text-sm ${t.completed_at ? "text-zinc-500 line-through" : "text-white"}`}>
									{t.title}
									{t.ambito_name && <span className="text-zinc-500 ml-1">({t.ambito_name})</span>}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* 2. Calendario: clic en hora (Día) o en día (Mes/Semana) para añadir tarea */}
			<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-lg">
				{viewMode === "month" && (
					<MonthView currentDate={currentDate} tasksForDate={tasksForDate} tasksLoading={tasksLoading} onDayClick={openAddModal} />
				)}
				{viewMode === "week" && (
					<WeekView currentDate={currentDate} weekStart={weekStart} hourSlots={hourSlots} tasksForDate={tasksForDate} onSlotClick={openAddModal} />
				)}
				{viewMode === "day" && (
					<DayView currentDate={currentDate} hourSlots={hourSlots} onSlotClick={(hour) => openAddModal(currentDate, `${String(hour).padStart(2, "0")}:00`)} />
				)}
			</div>

			{/* Modal: Añadir tarea (al clicar hora o día) */}
			{addModal.open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
					<div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
						<h2 id="add-task-title" className="text-lg font-semibold text-white mb-2">Añadir tarea</h2>
						<p className="text-zinc-400 text-sm mb-3">
							{addModal.date && (
								<>
									{addModal.date.getDate()} {MONTH_NAMES[addModal.date.getMonth()]}
									{addModal.timeSlot && ` · ${addModal.timeSlot}`}
								</>
							)}
						</p>
						<form onSubmit={handleAddTask} className="space-y-3">
							<input
								type="text"
								value={modalTitle}
								onChange={(e) => setModalTitle(e.target.value)}
								placeholder="Título (ej. Estudiar SGE, Correr 2 km)"
								className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm"
								required
								autoFocus
							/>
							<select
								value={modalAmbitoId}
								onChange={(e) => setModalAmbitoId(e.target.value)}
								className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
							>
								<option value="">Ámbito (opcional)</option>
								{ambitos.map((a) => (
									<option key={a.id} value={a.id}>{a.name}</option>
								))}
							</select>
							<div className="flex gap-2 pt-1">
								<button type="submit" disabled={savingTask || !modalTitle.trim()} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50">
									{savingTask ? "Guardando…" : "Añadir"}
								</button>
								<button type="button" onClick={closeAddModal} className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm">
									Cancelar
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

function MonthView({ currentDate, tasksForDate, tasksLoading, onDayClick }) {
	const grid = useMemo(
		() => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
		[currentDate.getFullYear(), currentDate.getMonth()]
	);
	const currentMonth = currentDate.getMonth();

	return (
		<div className="p-2 sm:p-3">
			<div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-lg overflow-hidden">
				{WEEKDAY_LABELS.map((label) => (
					<div
						key={label}
						className="py-2 text-center text-xs font-medium text-zinc-500 bg-zinc-900/80"
					>
						{label}
					</div>
				))}
				{grid.map((row, rowIdx) =>
					row.map((d) => {
						const isCurrentMonth = d.getMonth() === currentMonth;
						const today = isToday(d);
						const dayTasks = tasksForDate ? tasksForDate(d) : [];
						const done = dayTasks.filter((t) => t.completed_at).length;
						return (
							<button
								key={rowIdx + "-" + d.getTime()}
								type="button"
								onClick={() => onDayClick && onDayClick(d)}
								className={`min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 text-sm bg-zinc-900/80 text-left w-full cursor-pointer hover:bg-zinc-800/80 transition-colors ${
									!isCurrentMonth ? "text-zinc-600" : "text-zinc-200"
								} ${today ? "ring-1 ring-inset ring-violet-500 rounded bg-violet-950/20" : ""}`}
							>
								{today ? (
									<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white font-semibold">
										{d.getDate()}
									</span>
								) : (
									<span>{d.getDate()}</span>
								)}
								{!tasksLoading && dayTasks.length > 0 && (
									<div className="mt-1 space-y-0.5">
										{dayTasks.slice(0, 2).map((t) => (
											<div
												key={t.id}
												className={`text-xs truncate max-w-full ${t.completed_at ? "text-zinc-500 line-through" : "text-zinc-300"}`}
												title={t.title}
											>
												{t.title}
											</div>
										))}
										{dayTasks.length > 2 && <span className="text-zinc-500 text-xs">+{dayTasks.length - 2}</span>}
										{done > 0 && <span className="text-violet-400 text-xs">{done}/{dayTasks.length}</span>}
									</div>
								)}
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}

function WeekView({ currentDate, weekStart, hourSlots, tasksForDate }) {
	const days = useMemo(() => {
		const d = [];
		const start = new Date(weekStart);
		for (let i = 0; i < 7; i++) {
			d.push(new Date(start));
			start.setDate(start.getDate() + 1);
		}
		return d;
	}, [weekStart]);

	return (
		<div className="min-w-0">
			<div className="grid grid-cols-8 border-b border-zinc-800">
				<div className="w-12 sm:w-14 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/80" />
				{days.map((d) => (
					<div
						key={d.getTime()}
						className={`py-2 px-1 text-center text-xs sm:text-sm border-r border-zinc-800 last:border-r-0 ${
							isToday(d) ? "bg-violet-950/30 text-violet-200 font-semibold" : "text-zinc-400 bg-zinc-900/80"
						}`}
					>
						<div className="font-medium">{WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
						<div className={isToday(d) ? "text-white" : "text-zinc-300"}>{d.getDate()}</div>
					</div>
				))}
			</div>
			<div className="overflow-y-auto max-h-[60vh]">
				{hourSlots.map(({ hour, label }) => (
					<div key={hour} className="grid grid-cols-8 min-h-[48px] border-b border-zinc-800/80">
						<div className="w-12 sm:w-14 flex-shrink-0 py-1 pr-1 text-xs text-zinc-500 border-r border-zinc-800 bg-zinc-900/80 -mt-3">
							{label}
						</div>
						{[0, 1, 2, 3, 4, 5, 6].map((col) => (
							<div
								key={col}
								className="border-r border-zinc-800/50 last:border-r-0 bg-zinc-900/80 hover:bg-zinc-800/80 transition-colors min-w-0"
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

function DayView({ currentDate, hourSlots }) {
	return (
		<div className="flex overflow-x-auto">
			<div className="flex-shrink-0 w-12 sm:w-14 pt-10 pr-1 border-r border-zinc-800 bg-zinc-900/80" />
			<div className="flex-1 min-w-0 border-r border-zinc-800">
				<div className="py-2 px-2 text-center text-sm border-b border-zinc-800 bg-zinc-900/80">
					<span className={isToday(currentDate) ? "text-violet-300 font-semibold" : "text-zinc-400"}>
						{WEEKDAY_LABELS[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]} {currentDate.getDate()}
					</span>
				</div>
				<div className="overflow-y-auto max-h-[60vh]">
					{hourSlots.map(({ hour, label }) => (
						<div key={hour} className="min-h-[48px] flex border-b border-zinc-800/80">
							<div className="flex-shrink-0 w-12 sm:w-14 py-1 pr-1 text-xs text-zinc-500 -mt-3">
								{label}
							</div>
							<div className="flex-1 bg-zinc-900/80 hover:bg-zinc-800/80 transition-colors" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
