import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { apiBase } from "./api";
import { registerPushIfPossible } from "./utils/pushRegistration";
import { Routes, Route, Navigate } from "react-router-dom";
import WhoAreYou from "./pages/WhoAreYou";
import Layout from "./Layout";
import Buscar from "./pages/Buscar";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Ranking from "./pages/Ranking";
import Amigos from "./pages/Amigos";
import Chat from "./pages/Chat";
import Agenda from "./pages/Agenda";
import AgendaMetas from "./pages/AgendaMetas";
import AgendaAmbitos from "./pages/AgendaAmbitos";
import AgendaLayout from "./components/AgendaLayout";
import RedirectPerfilToHome from "./components/RedirectPerfilToHome";
import Cerebro from "./pages/Cerebro";
import { ToastProvider } from "./components/ToastContext";

const defaultUserContext = {
	currentUser: null,
	users: [],
	setUser: () => {},
	refreshJugadosTrigger: 0,
	setRefreshJugadosTrigger: () => {},
	optimisticAdds: { jugando: [], pendientes: [] },
	addOptimisticAdd: () => {},
	clearOptimisticAdds: () => {},
	removeOptimisticAdd: () => {},
};

const UserContext = createContext(null);

export function useUser() {
	const ctx = useContext(UserContext);
	return ctx ?? defaultUserContext;
}

export function useCurrentUserSlug() {
	const { currentUser } = useUser();
	return currentUser?.slug ?? null;
}

const USER_CHECK_TIMEOUT_MS = 12000;

export default function App() {
	const [currentUser, setCurrentUser] = useState(null);
	const [users, setUsers] = useState([]);
	const [refreshJugadosTrigger, setRefreshJugadosTrigger] = useState(0);
	const [initialUserCheckDone, setInitialUserCheckDone] = useState(false);
	const [optimisticAdds, setOptimisticAdds] = useState({ jugando: [], pendientes: [] });

	const addOptimisticAdd = useCallback((list, game) => {
		const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
		const entry = { ...game, game_id: optId, _optId: optId };
		setOptimisticAdds((prev) => ({ ...prev, [list]: [...prev[list], entry] }));
		return optId;
	}, []);
	const removeOptimisticAdd = useCallback((list, optId) => {
		setOptimisticAdds((prev) => ({ ...prev, [list]: prev[list].filter((g) => g._optId !== optId) }));
	}, []);
	const clearOptimisticAdds = useCallback(() => setOptimisticAdds({ jugando: [], pendientes: [] }), []);

	useEffect(() => {
		const slug = localStorage.getItem("juegos_app_user");
		if (!slug) {
			setInitialUserCheckDone(true);
			return;
		}
		let cancelled = false;
		const timeoutId = setTimeout(() => {
			if (!cancelled) {
				setCurrentUser(null);
				setInitialUserCheckDone(true);
			}
		}, USER_CHECK_TIMEOUT_MS);
		fetch(`${apiBase}/api/users/${slug}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((u) => {
				if (!cancelled) {
					if (u) setCurrentUser(u);
					else setCurrentUser(null);
					setInitialUserCheckDone(true);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setCurrentUser(null);
					setInitialUserCheckDone(true);
				}
			})
			.finally(() => clearTimeout(timeoutId));
		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
		};
	}, []);

	useEffect(() => {
		fetch(`${apiBase}/api/users`)
			.then((r) => r.json())
			.then(setUsers)
			.catch(() => setUsers([]));
	}, []);

	useEffect(() => {
		if (currentUser?.slug) registerPushIfPossible(apiBase, currentUser.slug);
	}, [currentUser?.slug]);

	const setUser = (user) => {
		if (user) {
			localStorage.setItem("juegos_app_user", user.slug);
			setCurrentUser(user);
		} else {
			localStorage.removeItem("juegos_app_user");
			setCurrentUser(null);
		}
	};

	// Pantalla de carga inicial: comprobando si hay usuario guardado
	if (!initialUserCheckDone) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-black">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	if (!currentUser) {
		return (
			<UserContext.Provider value={{ currentUser: null, users, setUser }}>
				<ToastProvider>
					<Routes>
						<Route path="/" element={<WhoAreYou />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</ToastProvider>
			</UserContext.Provider>
		);
	}

	return (
		<UserContext.Provider value={{ currentUser, users, setUser, refreshJugadosTrigger, setRefreshJugadosTrigger, optimisticAdds, addOptimisticAdd, clearOptimisticAdds, removeOptimisticAdd }}>
			<ToastProvider>
				<Routes>
					<Route path="/" element={<Layout />}>
						<Route index element={<Dashboard />} />
						<Route path="perfil" element={<RedirectPerfilToHome />} />
						<Route path="perfil/:slug" element={<Perfil />} />
						<Route path="buscar" element={<Buscar />} />
						<Route path="cerebro" element={<Cerebro />} />
						<Route path="ranking" element={<Ranking />} />
						<Route path="amigos" element={<Amigos />} />
						<Route path="chat" element={<Chat />} />
					</Route>
					<Route path="/agenda" element={<AgendaLayout />}>
						<Route index element={<Agenda />} />
						<Route path="metas" element={<AgendaMetas />} />
						<Route path="ambitos" element={<AgendaAmbitos />} />
					</Route>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</ToastProvider>
		</UserContext.Provider>
	);
}
