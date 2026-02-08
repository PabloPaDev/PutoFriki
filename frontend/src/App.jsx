import { useState, useEffect, createContext, useContext } from "react";
import { apiBase } from "./api";
import { Routes, Route, Navigate } from "react-router-dom";
import WhoAreYou from "./pages/WhoAreYou";
import Layout from "./Layout";
import Buscar from "./pages/Buscar";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Ranking from "./pages/Ranking";
import Amigos from "./pages/Amigos";
import RedirectPerfilToHome from "./components/RedirectPerfilToHome";

const defaultUserContext = {
	currentUser: null,
	users: [],
	setUser: () => {},
	refreshJugadosTrigger: 0,
	setRefreshJugadosTrigger: () => {},
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

export default function App() {
	const [currentUser, setCurrentUser] = useState(null);
	const [users, setUsers] = useState([]);
	const [refreshJugadosTrigger, setRefreshJugadosTrigger] = useState(0);

	useEffect(() => {
		const slug = localStorage.getItem("juegos_app_user");
		if (slug) {
			fetch(`${apiBase}/api/users/${slug}`)
				.then((r) => (r.ok ? r.json() : null))
				.then((u) => u && setCurrentUser(u))
				.catch(() => setCurrentUser(null));
		}
	}, []);

	useEffect(() => {
		fetch(`${apiBase}/api/users`)
			.then((r) => r.json())
			.then(setUsers)
			.catch(() => setUsers([]));
	}, []);

	const setUser = (user) => {
		if (user) {
			localStorage.setItem("juegos_app_user", user.slug);
			setCurrentUser(user);
		} else {
			localStorage.removeItem("juegos_app_user");
			setCurrentUser(null);
		}
	};

	if (currentUser === undefined && users.length) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-zinc-950">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	if (!currentUser) {
		return (
			<UserContext.Provider value={{ currentUser: null, users, setUser }}>
				<Routes>
					<Route path="/" element={<WhoAreYou />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</UserContext.Provider>
		);
	}

	return (
		<UserContext.Provider value={{ currentUser, users, setUser, refreshJugadosTrigger, setRefreshJugadosTrigger }}>
			<Routes>
				<Route path="/" element={<Layout />}>
					<Route index element={<Dashboard />} />
					<Route path="perfil" element={<RedirectPerfilToHome />} />
					<Route path="perfil/:slug" element={<Perfil />} />
					<Route path="buscar" element={<Buscar />} />
					<Route path="ranking" element={<Ranking />} />
					<Route path="amigos" element={<Amigos />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</UserContext.Provider>
	);
}
