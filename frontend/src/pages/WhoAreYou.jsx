import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../App";
import { apiBase } from "../api";

const PENDING_FIRST_LOGIN_KEY = "juegos_app_pending_first_login";

export default function WhoAreYou() {
	const { users, setUser } = useUser();
	const navigate = useNavigate();
	const [registrationClosed, setRegistrationClosed] = useState(false);
	const [accessLoading, setAccessLoading] = useState(true);

	useEffect(() => {
		fetch(`${apiBase}/api/access`)
			.then((r) => (r.ok ? r.json() : { registrationClosed: false }))
			.then((data) => setRegistrationClosed(data.registrationClosed === true))
			.catch(() => setRegistrationClosed(false))
			.finally(() => setAccessLoading(false));
	}, []);

	const choose = (user) => {
		if (!confirm(`¿Seguro que eres ${user.name}?\n\nEsta elección no se podrá cambiar.`)) return;
		setUser(user);
		sessionStorage.setItem(PENDING_FIRST_LOGIN_KEY, user.slug);
		navigate("/perfil", { replace: true });
	};

	if (accessLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-black">
				<p className="text-zinc-400">Cargando…</p>
			</div>
		);
	}

	if (registrationClosed) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-black">
				<div className="text-center max-w-lg mx-auto">
					<button
						type="button"
						disabled
						className="px-6 py-4 rounded-2xl text-lg font-semibold bg-zinc-800 text-zinc-300 cursor-not-allowed border border-zinc-700"
					>
						¿Qué mierda haces aquí? Ya te mandaremos invitación.
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-950/50 to-black">
			<div className="text-center max-w-lg mx-auto">
				<h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2">
					P*** Friki
				</h1>
				<p className="text-zinc-400 text-lg mb-10">
					Valora juegos, crea tu lista de pendientes y tu ranking.
				</p>
				<p className="text-zinc-300 text-xl font-medium mb-2">¿Quién eres?</p>
				<p className="text-zinc-500 text-sm mb-6">Elige una vez; no podrás cambiarlo después.</p>
				<div className="flex flex-wrap justify-center gap-4">
					{users.map((u) => (
						<button
							key={u.id}
							type="button"
							onClick={() => choose(u)}
							className="px-10 py-4 rounded-2xl text-lg font-semibold bg-orange-600 text-white shadow-xl shadow-orange-600/25 hover:bg-orange-500 hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
						>
							{u.name}
						</button>
					))}
				</div>
				{!users.length && (
					<p className="text-zinc-500 mt-6">Cargando usuarios…</p>
				)}
			</div>
		</div>
	);
}
