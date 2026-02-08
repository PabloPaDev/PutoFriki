import { Component } from "react";

export default class ErrorBoundary extends Component {
	state = { error: null };

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		console.error("ErrorBoundary:", error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
					<div className="max-w-lg w-full rounded-2xl bg-zinc-800 border border-zinc-700 p-6 text-left">
						<h1 className="text-xl font-bold text-red-400 mb-2">Algo ha fallado</h1>
						<p className="text-zinc-300 text-sm font-mono mb-4 break-all">
							{this.state.error?.message ?? String(this.state.error)}
						</p>
						<button
							type="button"
							onClick={() => this.setState({ error: null })}
							className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500"
						>
							Reintentar
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
