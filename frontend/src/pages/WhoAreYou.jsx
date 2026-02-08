import { useNavigate } from "react-router-dom";
import { useUser } from "../App";

export default function WhoAreYou() {
	const { users, setUser } = useUser();
	const navigate = useNavigate();

	const choose = (user) => {
		setUser(user);
		navigate("/perfil", { replace: true });
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950">
			<div className="text-center max-w-lg mx-auto">
				<h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2">
					Juegos App
				</h1>
				<p className="text-zinc-400 text-lg mb-10">
					Valora juegos, crea tu lista de pendientes y tu ranking.
				</p>
				<p className="text-zinc-300 text-xl font-medium mb-6">¿Quién eres?</p>
				<div className="flex flex-wrap justify-center gap-4">
					{users.map((u) => (
						<button
							key={u.id}
							type="button"
							onClick={() => choose(u)}
							className="px-10 py-4 rounded-2xl text-lg font-semibold bg-violet-600 text-white shadow-xl shadow-violet-600/25 hover:bg-violet-500 hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
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
