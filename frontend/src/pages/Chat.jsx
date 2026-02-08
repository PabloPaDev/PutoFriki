import { useState, useEffect, useRef } from "react";
import { useUser } from "../App";
import { apiBase, wsBase } from "../api";

export default function Chat({ embedded = false }) {
	const { currentUser, users } = useUser();
	const otherUser = users.find((u) => u.slug !== currentUser?.slug) ?? null;
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(true);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [showRecommend, setShowRecommend] = useState(false);
	const [searchQ, setSearchQ] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [searching, setSearching] = useState(false);
	const listRef = useRef(null);
	const wsRef = useRef(null);

	useEffect(() => {
		if (!currentUser?.slug || !otherUser?.slug) return;
		setLoading(true);
		fetch(`${apiBase}/api/users/${currentUser.slug}/conversation?with=${otherUser.slug}`)
			.then((r) => (r.ok ? r.json() : { messages: [], other: null }))
			.then((data) => {
				setMessages(data.messages || []);
			})
			.catch(() => setMessages([]))
			.finally(() => setLoading(false));
	}, [currentUser?.slug, otherUser?.slug]);

	useEffect(() => {
		if (!currentUser?.slug || !wsBase) return;
		const base = wsBase || (typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : "");
		const url = `${base}${base.endsWith("/ws") ? "" : "/ws"}`;
		const ws = new WebSocket(url);
		wsRef.current = ws;
		ws.onopen = () => {
			ws.send(JSON.stringify({ type: "auth", slug: currentUser.slug }));
		};
		ws.onmessage = (ev) => {
			try {
				const data = JSON.parse(ev.data);
				if (data.type === "message") {
					setMessages((prev) => {
						const fromMe = data.from?.slug === currentUser?.slug;
						if (fromMe) {
							const withoutOptimistic = prev.filter((m) => !m._optimistic);
							const match = prev.find((m) => m._optimistic && m.body === data.body);
							if (match) return [...withoutOptimistic, data];
						}
						return [...prev, data];
					});
				}
			} catch (_) {}
		};
		return () => {
			ws.close();
			wsRef.current = null;
		};
	}, [currentUser?.slug]);

	useEffect(() => {
		listRef.current?.scrollTo(0, listRef.current.scrollHeight);
	}, [messages]);

	const addOptimisticMessage = (body, game = null) => {
		const opt = {
			id: `opt-${Date.now()}`,
			body,
			from: currentUser,
			created_at: new Date().toISOString(),
			game: game ?? undefined,
			_optimistic: true,
		};
		setMessages((prev) => [...prev, opt]);
	};

	const sendMessage = (body) => {
		if (!currentUser?.slug || !otherUser?.slug || !body?.trim()) return;
		const trimmed = body.trim();
		addOptimisticMessage(trimmed);
		setInput("");
		setSending(true);
		fetch(`${apiBase}/api/users/${currentUser.slug}/messages`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ to_slug: otherUser.slug, body: trimmed }),
		})
			.catch(() => {
				setMessages((prev) => prev.filter((m) => !m._optimistic || m.body !== trimmed));
			})
			.finally(() => setSending(false));
	};

	const sendMessageWithGame = (body, rawgId, game = null) => {
		if (!currentUser?.slug || !otherUser?.slug || !body?.trim()) return;
		const trimmed = body.trim();
		addOptimisticMessage(trimmed, game ?? undefined);
		setInput("");
		setSending(true);
		fetch(`${apiBase}/api/users/${currentUser.slug}/messages`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ to_slug: otherUser.slug, body: trimmed, rawg_id: rawgId ?? undefined }),
		})
			.catch(() => {
				setMessages((prev) => prev.filter((m) => !m._optimistic || m.body !== trimmed));
			})
			.finally(() => setSending(false));
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		sendMessage(input);
	};

	// Búsqueda al escribir (debounced) cuando el panel de recomendar está abierto
	useEffect(() => {
		if (!showRecommend) return;
		const q = searchQ.trim();
		if (q.length < 2) {
			setSearchResults([]);
			return;
		}
		const t = setTimeout(() => {
			setSearching(true);
			fetch(`${apiBase}/api/games/search?q=${encodeURIComponent(q)}`)
				.then((r) => r.json())
				.then((d) => setSearchResults(d.results || []))
				.catch(() => setSearchResults([]))
				.finally(() => setSearching(false));
		}, 320);
		return () => clearTimeout(t);
	}, [searchQ, showRecommend]);

	const recommendGame = (game) => {
		const body = `Te recomiendo: ${game.name}`;
		const gameForOpt = game.image_url
			? { name: game.name, image_url: game.image_url, released: game.released }
			: { name: game.name, image_url: null, released: null };
		sendMessageWithGame(body, game.rawg_id ?? game.id, gameForOpt);
		setShowRecommend(false);
		setSearchQ("");
		setSearchResults([]);
	};

	if (!otherUser) {
		return (
			<div className="py-12 text-center text-zinc-400">
				No hay otro usuario para chatear.
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-zinc-400">Cargando conversación…</p>
			</div>
		);
	}

	const containerClass = embedded
		? "flex flex-col flex-1 min-h-0 rounded-none border-0 bg-transparent"
		: "flex flex-col h-[calc(100vh-8rem)] max-h-[700px] rounded-2xl border border-zinc-800 bg-zinc-900/80";

	return (
		<div className={containerClass}>
			<div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
				<div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-semibold">
					{otherUser.name?.charAt(0) ?? "?"}
				</div>
				<div>
					<h1 className="text-lg font-semibold text-white">{otherUser.name}</h1>
					<p className="text-zinc-500 text-sm">Recomienda juegos y habla en tiempo real</p>
				</div>
			</div>

			<div
				ref={listRef}
				className="flex-1 overflow-y-auto p-4 space-y-3"
			>
				{messages.length === 0 && (
					<p className="text-zinc-500 text-center py-8 text-sm">
						Sin mensajes aún. Escribe algo o recomienda un juego.
					</p>
				)}
				{messages.map((m) => {
					const isMe = m.from?.slug === currentUser?.slug;
					return (
						<div
							key={m.id ?? m.created_at + (m.body || "").slice(0, 20)}
							className={`flex ${isMe ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 ${
									isMe
										? "bg-orange-600 text-white rounded-br-md"
										: "bg-zinc-800 text-zinc-100 rounded-bl-md"
								}`}
							>
								{m.game && (
									<div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-black/20 -mx-0.5">
										{m.game.image_url && (
											<img
												src={m.game.image_url}
												alt=""
												className="w-8 h-10 flex-shrink-0 object-cover rounded"
											/>
										)}
										<span className="text-xs font-medium truncate flex-1 min-w-0">{m.game.name}</span>
									</div>
								)}
								<p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
								<p className={`text-xs mt-1 ${isMe ? "text-orange-200" : "text-zinc-500"}`}>
									{m.from?.name} · {m.created_at ? new Date(m.created_at).toLocaleString("es") : ""}
								</p>
							</div>
						</div>
					);
				})}
			</div>

			{showRecommend && (
				<div className="border-t border-zinc-800 p-3 bg-zinc-900/95">
					<div className="flex items-center gap-2 mb-2">
						<input
							type="text"
							value={searchQ}
							onChange={(e) => setSearchQ(e.target.value)}
							placeholder="Escribe para buscar un juego..."
							autoFocus
							className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
						/>
						<button
							type="button"
							onClick={() => {
								setShowRecommend(false);
								setSearchQ("");
								setSearchResults([]);
							}}
							className="flex-shrink-0 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
							aria-label="Cerrar"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					{searchQ.trim().length >= 2 && (
						<div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-800 overflow-hidden">
							{searching ? (
								<p className="py-4 text-center text-zinc-500 text-sm">Buscando…</p>
							) : searchResults.length === 0 ? (
								<p className="py-4 text-center text-zinc-500 text-sm">Sin resultados. Prueba otro nombre.</p>
							) : (
								searchResults.slice(0, 10).map((g) => (
									<button
										key={g.rawg_id ?? g.id}
										type="button"
										onClick={() => recommendGame(g)}
										className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/80 hover:bg-orange-600/20 hover:border-orange-500/30 border border-transparent text-left text-sm text-white transition-colors"
									>
										{g.image_url ? (
											<img src={g.image_url} alt="" className="w-11 h-14 flex-shrink-0 object-cover rounded-md" />
										) : (
											<div className="w-11 h-14 flex-shrink-0 rounded-md bg-zinc-700" />
										)}
										<span className="truncate font-medium">{g.name}</span>
									</button>
								))
							)}
						</div>
					)}
				</div>
			)}

			<form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-zinc-800">
				<button
					type="button"
					onClick={() => setShowRecommend((v) => !v)}
					className="flex-shrink-0 p-2 rounded-xl bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
					title="Recomendar juego"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
					</svg>
				</button>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Escribe un mensaje..."
					className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
				/>
				<button
					type="submit"
					disabled={sending || !input.trim()}
					className="px-4 py-2.5 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50"
				>
					Enviar
				</button>
			</form>
		</div>
	);
}
