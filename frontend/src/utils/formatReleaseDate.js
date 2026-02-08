/**
 * Devuelve la fecha de lanzamiento formateada en español o "Por confirmar" si no hay fecha.
 */
export function formatReleaseDate(released) {
	if (!released) return "Por confirmar";
	const d = new Date(released);
	if (Number.isNaN(d.getTime())) return "Por confirmar";
	return d.toLocaleDateString("es-ES", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}
