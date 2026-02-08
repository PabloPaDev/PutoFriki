import { useState, useCallback, createContext, useContext } from "react";
import { Trophy, List, CircleSlash, Calendar, Archive, Tag, User, Ghost, Swords, Target, Building2, Leaf, Map, Lock } from "lucide-react";

const ToastContext = createContext(null);

const ACHIEVEMENT_ICONS = {
	trophy: Trophy,
	list: List,
	"circle-slash": CircleSlash,
	calendar: Calendar,
	archive: Archive,
	tag: Tag,
	user: User,
	ghost: Ghost,
	sword: Swords,
	target: Target,
	building2: Building2,
	leaf: Leaf,
	map: Map,
	lock: Lock,
};

export function useToast() {
	const ctx = useContext(ToastContext);
	return ctx ?? { addToast: () => {} };
}

export function ToastProvider({ children }) {
	const [toasts, setToasts] = useState([]);

	const addToast = useCallback(({ title, description, icon }) => {
		const id = Math.random().toString(36).slice(2);
		setToasts((prev) => [...prev, { id, title, description, icon }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 5000);
	}, []);

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			<ToastContainer toasts={toasts} />
		</ToastContext.Provider>
	);
}

function ToastContainer({ toasts }) {
	if (toasts.length === 0) return null;
	return (
		<div
			className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
			aria-live="polite"
		>
			{toasts.map((t) => (
				<ToastItem key={t.id} title={t.title} description={t.description} icon={t.icon} />
			))}
		</div>
	);
}

function formatDescription(description) {
	if (!description || typeof description !== "string") return { first: "", rest: "" };
	const idx = description.indexOf(". ");
	if (idx < 0) return { first: description.trim(), rest: "" };
	return {
		first: description.slice(0, idx + 1).trim(),
		rest: description.slice(idx + 2).trim(),
	};
}

function ToastItem({ title, description, icon }) {
	const IconComponent = ACHIEVEMENT_ICONS[icon] || Trophy;
	const { first, rest } = formatDescription(description);
	return (
		<div className="pointer-events-auto rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-lg p-3 flex gap-3 text-left">
			<div className="flex-shrink-0 w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
				<IconComponent size={18} strokeWidth={1.8} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-zinc-200 text-sm">{title}</p>
				{first && <p className="text-zinc-300 font-medium text-xs mt-0.5">{first}</p>}
				{rest && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-2">{rest}</p>}
			</div>
		</div>
	);
}
