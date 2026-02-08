const RAWG_BASE = "https://api.rawg.io/api";

export async function searchGames(query, apiKey) {
	if (!apiKey) {
		return { results: [], error: "Búsqueda no disponible" };
	}
	const params = new URLSearchParams({
		key: apiKey,
		search: query,
		page_size: "20",
	});
	const url = `${RAWG_BASE}/games?${params}`;
	const res = await fetch(url);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data.detail || data.error || data.message || res.statusText;
		return { results: [], error: `RAWG ${res.status}: ${msg}` };
	}
	return {
		results: (data.results || []).map((g) => ({
			rawg_id: g.id,
			name: g.name,
			released: g.released || null,
			image_url: g.background_image || null,
			genres: (g.genres || []).map((x) => x.name),
			platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
			metacritic: g.metacritic ?? null,
			slug: g.slug || null,
		})),
	};
}

export async function getGameByRawgId(rawgId, apiKey) {
	if (!apiKey) return null;
	const params = new URLSearchParams({ key: apiKey });
	const res = await fetch(`${RAWG_BASE}/games/${rawgId}?${params}`);
	if (!res.ok) return null;
	const g = await res.json();
	return {
		rawg_id: g.id,
		name: g.name,
		released: g.released || null,
		image_url: g.background_image || null,
		genres: (g.genres || []).map((x) => x.name),
		platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
		metacritic: g.metacritic ?? null,
		slug: g.slug || null,
	};
}
