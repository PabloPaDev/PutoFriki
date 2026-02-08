/**
 * Biblioteca de logros (~70). Tono irónico, humillante, "capullo".
 * Cada uno: id, title, description, category, difficulty, rarity, icon, check(db, userId).
 */

/**
 * Extrae nombres de género desde el campo genres de la BD.
 * Acepta: JSON string (array de strings "Action" o de objetos { id, name }),
 * o array ya parseado. RAWG devuelve { id, name }; nosotros guardamos array de nombres.
 */
function genreName(genresJson) {
	let arr = genresJson;
	if (typeof arr === "string") try { arr = JSON.parse(arr || "[]"); } catch { arr = []; }
	if (!Array.isArray(arr)) return [];
	return arr.map((g) => (g && typeof g === "object" && g.name ? g.name : String(g))).filter(Boolean);
}

function countPlayedByGenre(db, userId, genreLower) {
	const rows = db.prepare(
		`SELECT g.genres FROM user_played up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`
	).all(userId);
	let count = 0;
	for (const row of rows) {
		const names = genreName(row.genres);
		if (names.some((n) => n.toLowerCase().includes(genreLower))) count++;
	}
	return count;
}

function countPending(db, userId) {
	return db.prepare("SELECT COUNT(*) as c FROM user_pending WHERE user_id = ?").get(userId)?.c ?? 0;
}
function countCompleted(db, userId) {
	return db.prepare("SELECT COUNT(*) as c FROM user_played WHERE user_id = ? AND completed = 1").get(userId)?.c ?? 0;
}
function countAbandoned(db, userId) {
	return db.prepare("SELECT COUNT(*) as c FROM user_played WHERE user_id = ? AND completed = 0").get(userId)?.c ?? 0;
}
function countPlayed(db, userId) {
	return db.prepare("SELECT COUNT(*) as c FROM user_played WHERE user_id = ?").get(userId)?.c ?? 0;
}
function completedThisMonth(db, userId) {
	const start = new Date();
	start.setDate(1);
	start.setUTCHours(0, 0, 0, 0);
	const since = start.toISOString().slice(0, 19);
	return db.prepare("SELECT COUNT(*) as c FROM user_played WHERE user_id = ? AND completed = 1 AND played_at >= ?").get(userId, since)?.c ?? 0;
}
function completedThisYear(db, userId) {
	const start = new Date();
	start.setMonth(0, 1);
	start.setUTCHours(0, 0, 0, 0);
	const since = start.toISOString().slice(0, 19);
	return db.prepare("SELECT COUNT(*) as c FROM user_played WHERE user_id = ? AND completed = 1 AND played_at >= ?").get(userId, since)?.c ?? 0;
}

const ACHIEVEMENTS = [
	// --- ENTRADA / GENERAL (quien_eres se desbloquea por first-login)
	{
		id: "quien_eres",
		title: "¿Quién eres?",
		description: "Entraste y elegiste tu identidad. No hay vuelta atrás.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "user",
		check() { return false; },
	},
	// --- GENERAL / CANTIDAD (lifetime, monthly, yearly)
	{
		id: "uno_completado",
		title: "Uno",
		description: "Completaste un juego. Uno. En toda tu vida.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 1; },
	},
	{
		id: "cinco_completados",
		title: "Cinco",
		description: "Cinco juegos terminados. Casi te da para una frase en el currículum.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 5; },
	},
	{
		id: "diez_completados",
		title: "Diez",
		description: "Diez completados. Ni tú te lo crees.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 10; },
	},
	{
		id: "veinticinco_completados",
		title: "Veinticinco",
		description: "Veinticinco juegos. Y sigues sin tener vida social.",
		category: "general",
		difficulty: "hard",
		rarity: "rare",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 25; },
	},
	{
		id: "cincuenta_completados",
		title: "Cincuenta",
		description: "Cincuenta. La mitad de tu tiempo en la Tierra ha sido esto.",
		category: "general",
		difficulty: "insane",
		rarity: "rare",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 50; },
	},
	{
		id: "lista_infinita",
		title: "Lista infinita",
		description: "Diez juegos pendientes. Los jugarás. Seguro. Mentira.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "list",
		check(db, userId) { return countPending(db, userId) >= 10; },
	},
	{
		id: "coleccionista",
		title: "Coleccionista",
		description: "Veinte en la lista. Algún día. O nunca.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "archive",
		check(db, userId) { return countPending(db, userId) >= 20; },
	},
	{
		id: "mes_tres",
		title: "Mes productivo",
		description: "Tres juegos este mes. La barra estaba por el suelo.",
		category: "mensual",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "calendar",
		check(db, userId) { return completedThisMonth(db, userId) >= 3; },
	},
	{
		id: "año_diez",
		title: "Año glorioso",
		description: "Diez en un año. Casi como una persona funcional. Casi.",
		category: "anual",
		difficulty: "hard",
		rarity: "rare",
		icon: "calendar",
		check(db, userId) { return completedThisYear(db, userId) >= 10; },
	},
	{
		id: "monogenero",
		title: "Monogénero",
		description: "Cinco o más del mismo género. Qué variedad.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "tag",
		check(db, userId) {
			const rows = db.prepare(`SELECT g.genres FROM user_played up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`).all(userId);
			const countByGenre = {};
			for (const row of rows) {
				for (const name of genreName(row.genres))
					countByGenre[name] = (countByGenre[name] || 0) + 1;
			}
			return Object.values(countByGenre).some((c) => c >= 5);
		},
	},
	{
		id: "tres_pendientes",
		title: "Tres en la lista",
		description: "Tres pendientes. Ya es un compromiso que no cumplirás.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "list",
		check(db, userId) { return countPending(db, userId) >= 3; },
	},
	{
		id: "primera_abandonado",
		title: "El primero que abandonas",
		description: "Abandonaste uno. Habrá muchos más.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 1; },
	},
	{
		id: "mes_uno",
		title: "Uno este mes",
		description: "Completaste uno este mes. Algo es algo. O no.",
		category: "mensual",
		difficulty: "easy",
		rarity: "common",
		icon: "calendar",
		check(db, userId) { return completedThisMonth(db, userId) >= 1; },
	},
	{
		id: "año_uno",
		title: "Uno este año",
		description: "Uno en todo el año. Productividad nivel dios.",
		category: "anual",
		difficulty: "easy",
		rarity: "common",
		icon: "calendar",
		check(db, userId) { return completedThisYear(db, userId) >= 1; },
	},
	{
		id: "veinte_completados",
		title: "Veinte",
		description: "Veinte juegos. Tu mayor logro en la vida.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 20; },
	},
	{
		id: "treinta_pendientes",
		title: "Treinta pendientes",
		description: "Treinta. No es una lista. Es una condena.",
		category: "general",
		difficulty: "hard",
		rarity: "rare",
		icon: "archive",
		check(db, userId) { return countPending(db, userId) >= 30; },
	},
	// --- ABANDONMENT
	{
		id: "ni_uno_terminado",
		title: "Ni uno",
		description: "Cinco jugados y ninguno terminado. Coherencia.",
		category: "abandonment",
		difficulty: "easy",
		rarity: "uncommon",
		icon: "circle-slash",
		check(db, userId) {
			return countPlayed(db, userId) >= 5 && countCompleted(db, userId) === 0;
		},
	},
	{
		id: "dejaste_cinco",
		title: "Dejaste cinco atrás",
		description: "Cinco abandonados. Tu biblioteca te juzga.",
		category: "abandonment",
		difficulty: "easy",
		rarity: "common",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 5; },
	},
	{
		id: "dejaste_diez",
		title: "Dejaste diez atrás",
		description: "Diez. Ya ni te acuerdas de sus nombres.",
		category: "abandonment",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 10; },
	},
	{
		id: "dejaste_veinticinco",
		title: "Veinticinco abandonos",
		description: "Veinticinco juegos a la basura. Eres un desastre.",
		category: "abandonment",
		difficulty: "hard",
		rarity: "rare",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 25; },
	},
	{
		id: "mas_abandonos_que_completados",
		title: "Más abandonos que logros",
		description: "Has dejado más juegos a medias de los que has terminado. Diagnóstico claro.",
		category: "abandonment",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "circle-slash",
		check(db, userId) {
			const a = countAbandoned(db, userId);
			const c = countCompleted(db, userId);
			return a > c && c > 0;
		},
	},
	{
		id: "abandono_precoz",
		title: "Abandono precoz",
		description: "Abandonaste uno. El primero de una larga lista de decepciones.",
		category: "abandonment",
		difficulty: "easy",
		rarity: "common",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 1; },
	},
	{
		id: "quince_abandonados",
		title: "Quince abandonados",
		description: "Quince. No terminas ni los juegos. Imagina los proyectos de vida.",
		category: "abandonment",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 15; },
	},
	// --- TERROR
	{
		id: "terror_uno",
		title: "Un susto",
		description: "Jugaste un juego de terror. O lo dejaste a los cinco minutos.",
		category: "terror",
		difficulty: "easy",
		rarity: "common",
		icon: "ghost",
		check(db, userId) { return countPlayedByGenre(db, userId, "horror") >= 1; },
	},
	{
		id: "terror_cinco",
		title: "Cinco terrores",
		description: "Cinco de terror. O eres valiente o tienes un problema.",
		category: "terror",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "ghost",
		check(db, userId) { return countPlayedByGenre(db, userId, "horror") >= 5; },
	},
	{
		id: "terror_diez",
		title: "Diez terrores",
		description: "Diez. El miedo ya es tu estado natural.",
		category: "terror",
		difficulty: "hard",
		rarity: "rare",
		icon: "ghost",
		check(db, userId) { return countPlayedByGenre(db, userId, "horror") >= 10; },
	},
	// --- SOULSLIKE (genre puede ser "Soulslike" o "Action RPG" en RAWG)
	{
		id: "souls_uno",
		title: "Un souls",
		description: "Un soulslike. Moriste. Mucho.",
		category: "soulslike",
		difficulty: "easy",
		rarity: "common",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "souls") >= 1; },
	},
	{
		id: "souls_cinco",
		title: "Cinco souls",
		description: "Cinco. El masoquismo como estilo de vida.",
		category: "soulslike",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "souls") >= 5; },
	},
	{
		id: "souls_diez",
		title: "Diez souls",
		description: "Diez. Ya no sientes dolor. O solo juegas a lo mismo.",
		category: "soulslike",
		difficulty: "hard",
		rarity: "rare",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "souls") >= 10; },
	},
	// --- RPG
	{
		id: "rpg_uno",
		title: "Un RPG",
		description: "Un RPG. Cien horas de tu vida. O dos y lo abandonaste.",
		category: "rpg",
		difficulty: "easy",
		rarity: "common",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "rpg") >= 1; },
	},
	{
		id: "rpg_cinco",
		title: "Cinco RPGs",
		description: "Cinco. Las matemáticas de daño te emocionan.",
		category: "rpg",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "rpg") >= 5; },
	},
	{
		id: "rpg_diez",
		title: "Diez RPGs",
		description: "Diez. Tu vida social es un número de estadística.",
		category: "rpg",
		difficulty: "hard",
		rarity: "rare",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "rpg") >= 10; },
	},
	// --- HACK AND SLASH (Action en RAWG suele incluir hack & slash)
	{
		id: "hack_uno",
		title: "Un hack and slash",
		description: "Uno. Botón ataque. Repetir hasta el final.",
		category: "hack_and_slash",
		difficulty: "easy",
		rarity: "common",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "action") >= 1; },
	},
	{
		id: "hack_cinco",
		title: "Cinco de acción",
		description: "Cinco. Tu reflejo es solo para esquivar en pantalla.",
		category: "hack_and_slash",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "action") >= 5; },
	},
	{
		id: "hack_diez",
		title: "Diez de acción",
		description: "Diez. Crees que tienes reflejos. No.",
		category: "hack_and_slash",
		difficulty: "hard",
		rarity: "rare",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "action") >= 10; },
	},
	// --- SHOOTERS
	{
		id: "shooter_uno",
		title: "Un shooter",
		description: "Un shooter. Apuntar y disparar. Tu máximo talento.",
		category: "shooters",
		difficulty: "easy",
		rarity: "common",
		icon: "target",
		check(db, userId) { return countPlayedByGenre(db, userId, "shooter") >= 1; },
	},
	{
		id: "shooter_cinco",
		title: "Cinco shooters",
		description: "Cinco. El headshot es tu única meta en la vida.",
		category: "shooters",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "target",
		check(db, userId) { return countPlayedByGenre(db, userId, "shooter") >= 5; },
	},
	{
		id: "shooter_diez",
		title: "Diez shooters",
		description: "Diez. Si fuera la vida real ya estarías en la cárcel.",
		category: "shooters",
		difficulty: "hard",
		rarity: "rare",
		icon: "target",
		check(db, userId) { return countPlayedByGenre(db, userId, "shooter") >= 10; },
	},
	// --- STRATEGY / MANAGEMENT
	{
		id: "strategy_uno",
		title: "Una estrategia",
		description: "Uno de estrategia. Planificar es lo único que haces bien.",
		category: "strategy",
		difficulty: "easy",
		rarity: "common",
		icon: "building2",
		check(db, userId) { return countPlayedByGenre(db, userId, "strateg") >= 1; },
	},
	{
		id: "strategy_cinco",
		title: "Cinco de estrategia",
		description: "Cinco. El mundo real te da miedo. Los mapas no.",
		category: "strategy",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "building2",
		check(db, userId) { return countPlayedByGenre(db, userId, "strateg") >= 5; },
	},
	{
		id: "strategy_diez",
		title: "Diez de estrategia",
		description: "Diez. Napoleón sin ejército.",
		category: "strategy",
		difficulty: "hard",
		rarity: "rare",
		icon: "building2",
		check(db, userId) { return countPlayedByGenre(db, userId, "strateg") >= 10; },
	},
	// --- INDIES
	{
		id: "indie_uno",
		title: "Un indie",
		description: "Un indie. Te crees alternativo.",
		category: "indies",
		difficulty: "easy",
		rarity: "common",
		icon: "leaf",
		check(db, userId) { return countPlayedByGenre(db, userId, "indie") >= 1; },
	},
	{
		id: "indie_cinco",
		title: "Cinco indies",
		description: "Disculpa eres Alex el capo",
		category: "indies",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "leaf",
		check(db, userId) { return countPlayedByGenre(db, userId, "indie") >= 5; },
	},
	{
		id: "indie_diez",
		title: "Diez indies",
		description: "Diez. Tu personalidad es 'me gustan los indies'.",
		category: "indies",
		difficulty: "hard",
		rarity: "rare",
		icon: "leaf",
		check(db, userId) { return countPlayedByGenre(db, userId, "indie") >= 10; },
	},
	// --- METROIDVANIA
	{
		id: "metroid_uno",
		title: "Un metroidvania",
		description: "Uno. Perdido por el mapa como en sus mentiras.",
		category: "metroidvania",
		difficulty: "easy",
		rarity: "common",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "metroidvania") >= 1; },
	},
	{
		id: "metroid_cinco",
		title: "Cinco metroidvanias",
		description: "Principio de Autismo",
		category: "metroidvania",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "metroidvania") >= 5; },
	},
	{
		id: "metroid_diez",
		title: "Diez metroidvanias",
		description: "Diez. Ya no te pierdes. Solo en la realidad.",
		category: "metroidvania",
		difficulty: "hard",
		rarity: "rare",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "metroidvania") >= 10; },
	},
	// --- HIDDEN (condiciones no obvias o irónicas)
	{
		id: "solo_entraste",
		title: "Solo entraste",
		description: "Solo tienes el logro de entrar. El resto te supera.",
		category: "hidden",
		difficulty: "easy",
		rarity: "common",
		icon: "lock",
		check(db, userId) {
			const r = db.prepare("SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ?").get(userId);
			return (r?.c ?? 0) === 1;
		},
	},
	{
		id: "nada_desbloqueado",
		title: "Cero",
		description: "No has desbloqueado nada. Ni siquiera te has molestado.",
		category: "hidden",
		difficulty: "insane",
		rarity: "rare",
		icon: "lock",
		check() { return false; },
	},
	{
		id: "todo_pendiente",
		title: "Solo pendientes",
		description: "Tienes pendientes pero no has completado ninguno. La procrastinación hecha usuario.",
		category: "hidden",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "lock",
		check(db, userId) {
			return countPending(db, userId) >= 5 && countCompleted(db, userId) === 0;
		},
	},
	{
		id: "adicto_mensual",
		title: "Adicto mensual",
		description: "Cinco o más completados este mes. ¿Saliste de casa?",
		category: "hidden",
		difficulty: "hard",
		rarity: "rare",
		icon: "lock",
		check(db, userId) { return completedThisMonth(db, userId) >= 5; },
	},
	{
		id: "leyenda",
		title: "Leyenda",
		description: "Cien juegos completados. Nadie preguntará cómo. Nadie querrá saberlo.",
		category: "hidden",
		difficulty: "insane",
		rarity: "rare",
		icon: "lock",
		check(db, userId) { return countCompleted(db, userId) >= 100; },
	},
	{
		id: "sin_vida",
		title: "Sin vida",
		description: "Tantos juegos que ya no recuerdas cuál era la vida real.",
		category: "hidden",
		difficulty: "insane",
		rarity: "rare",
		icon: "lock",
		check(db, userId) { return countPlayed(db, userId) >= 75; },
	},
	{
		id: "adventure_uno",
		title: "Una aventura",
		description: "Un juego de aventuras. La tuya es no salir de casa.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "adventure") >= 1; },
	},
	{
		id: "adventure_cinco",
		title: "Cinco aventuras",
		description: "Cinco. Las únicas aventuras que vivirás.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "adventure") >= 5; },
	},
	{
		id: "cinco_pendientes",
		title: "Cinco en la lista",
		description: "Cinco pendientes. Promesas que no cumplirás.",
		category: "general",
		difficulty: "easy",
		rarity: "common",
		icon: "list",
		check(db, userId) { return countPending(db, userId) >= 5; },
	},
	{
		id: "quince_completados",
		title: "Quince",
		description: "Quince juegos. Tu récord personal. Patético.",
		category: "general",
		difficulty: "medium",
		rarity: "uncommon",
		icon: "trophy",
		check(db, userId) { return countCompleted(db, userId) >= 15; },
	},
	{
		id: "mes_cinco",
		title: "Cinco este mes",
		description: "Cinco en un mes. ¿Tienes algo más que hacer?",
		category: "mensual",
		difficulty: "hard",
		rarity: "rare",
		icon: "calendar",
		check(db, userId) { return completedThisMonth(db, userId) >= 5; },
	},
	{
		id: "año_veinte",
		title: "Veinte en un año",
		description: "Veinte en un año. La productividad de un parásito.",
		category: "anual",
		difficulty: "insane",
		rarity: "rare",
		icon: "calendar",
		check(db, userId) { return completedThisYear(db, userId) >= 20; },
	},
	{
		id: "terror_quince",
		title: "Quince terrores",
		description: "Quince de terror. El miedo es tu zona de confort.",
		category: "terror",
		difficulty: "insane",
		rarity: "rare",
		icon: "ghost",
		check(db, userId) { return countPlayedByGenre(db, userId, "horror") >= 15; },
	},
	{
		id: "rpg_quince",
		title: "Quince RPGs",
		description: "Quince. Los números te definen. Literalmente.",
		category: "rpg",
		difficulty: "insane",
		rarity: "rare",
		icon: "sword",
		check(db, userId) { return countPlayedByGenre(db, userId, "rpg") >= 15; },
	},
	{
		id: "indie_quince",
		title: "Quince indies",
		description: "Quince. Tu identidad es 'jugador de indies'.",
		category: "indies",
		difficulty: "insane",
		rarity: "rare",
		icon: "leaf",
		check(db, userId) { return countPlayedByGenre(db, userId, "indie") >= 15; },
	},
	{
		id: "shooter_quince",
		title: "Quince shooters",
		description: "Quince. El único headshot que importa es el tuyo en la realidad.",
		category: "shooters",
		difficulty: "insane",
		rarity: "rare",
		icon: "target",
		check(db, userId) { return countPlayedByGenre(db, userId, "shooter") >= 15; },
	},
	{
		id: "strategy_quince",
		title: "Quince de estrategia",
		description: "Quince. Estratega en pantalla. Inútil en la vida.",
		category: "strategy",
		difficulty: "insane",
		rarity: "rare",
		icon: "building2",
		check(db, userId) { return countPlayedByGenre(db, userId, "strateg") >= 15; },
	},
	{
		id: "cuarenta_abandonados",
		title: "Cuarenta abandonados",
		description: "Cuarenta. Eres un cementerio de juegos a medias.",
		category: "abandonment",
		difficulty: "insane",
		rarity: "rare",
		icon: "circle-slash",
		check(db, userId) { return countAbandoned(db, userId) >= 40; },
	},
	{
		id: "ochenta_completados",
		title: "Ochenta",
		description: "Ochenta juegos. Tu obituario dirá 'jugó mucho'.",
		category: "hidden",
		difficulty: "insane",
		rarity: "rare",
		icon: "lock",
		check(db, userId) { return countCompleted(db, userId) >= 80; },
	},
	{
		id: "todo_generos",
		title: "Un poco de todo",
		description: "Jugaste al menos un juego de cinco géneros distintos. Qué explorador.",
		category: "hidden",
		difficulty: "hard",
		rarity: "uncommon",
		icon: "lock",
		check(db, userId) {
			const rows = db.prepare(`SELECT g.genres FROM user_played up JOIN games g ON g.id = up.game_id WHERE up.user_id = ?`).all(userId);
			const genres = new Set();
			for (const row of rows) {
				for (const name of genreName(row.genres)) genres.add(name);
			}
			return genres.size >= 5;
		},
	},
	{
		id: "metroid_quince",
		title: "Quince metroidvanias",
		description: "Quince. El mapa es tu única guía. En la vida no tienes ninguna.",
		category: "metroidvania",
		difficulty: "insane",
		rarity: "rare",
		icon: "map",
		check(db, userId) { return countPlayedByGenre(db, userId, "metroidvania") >= 15; },
	},
	// 70: muy oculta — solo al completar las otras 69
	{
		id: "autismo_nivel_serio",
		title: "Autismo nivel serio",
		description: "De haberlas completado todas. Todas.",
		category: "hidden",
		difficulty: "insane",
		rarity: "rare",
		icon: "lock",
		check(db, userId) {
			const r = db.prepare(
				"SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ? AND achievement_id != ?"
			).get(userId, "autismo_nivel_serio");
			return (r?.c ?? 0) >= 69;
		},
	},
];

/**
 * Comprueba y desbloquea logros. Devuelve los recién desbloqueados.
 */
export function checkAchievements(db, userId) {
	const now = new Date().toISOString();
	const newlyUnlocked = [];

	for (const a of ACHIEVEMENTS) {
		const already = db.prepare(
			"SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?"
		).get(userId, a.id);
		if (already) continue;
		if (!a.check(db, userId)) continue;

		db.prepare(
			"INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)"
		).run(userId, a.id, now);

		newlyUnlocked.push({
			id: a.id,
			title: a.title,
			description: a.description,
			category: a.category,
			difficulty: a.difficulty,
			rarity: a.rarity,
			icon: a.icon,
			unlocked_at: now,
		});
	}

	return newlyUnlocked;
}

/**
 * Si el usuario ya no cumple la condición de una insignia desbloqueada, se revoca.
 * No se revoca nunca "quien_eres". Se llama tras borrar un juego de jugados o pendientes.
 * Devuelve los ids de insignias revocadas.
 */
export function revokeAchievementsIfNeeded(db, userId) {
	const rows = db.prepare(
		"SELECT achievement_id FROM user_achievements WHERE user_id = ?"
	).all(userId);
	const revoked = [];
	for (const row of rows) {
		if (row.achievement_id === "quien_eres") continue;
		const def = ACHIEVEMENTS.find((a) => a.id === row.achievement_id);
		if (!def || !def.check) continue;
		const stillValid = def.check(db, userId);
		if (!stillValid) {
			db.prepare(
				"DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?"
			).run(userId, row.achievement_id);
			revoked.push(row.achievement_id);
		}
	}
	return revoked;
}

/**
 * Desbloqueo manual (p. ej. quien_eres en first-login).
 */
export function unlockAchievement(db, userId, achievementId) {
	const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
	if (!def) return null;
	const already = db.prepare(
		"SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?"
	).get(userId, achievementId);
	if (already) return null;
	const now = new Date().toISOString();
	db.prepare(
		"INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)"
	).run(userId, achievementId, now);
	return {
		id: def.id,
		title: def.title,
		description: def.description,
		category: def.category,
		difficulty: def.difficulty,
		rarity: def.rarity,
		icon: def.icon,
		unlocked_at: now,
	};
}

/**
 * Progreso numérico para mostrar debajo de la insignia (solo bloqueadas).
 * Devuelve { current, target } o null si no aplica.
 */
export function getAchievementProgress(db, userId, achievementId) {
	const c = () => countCompleted(db, userId);
	const p = () => countPending(db, userId);
	const a = () => countAbandoned(db, userId);
	const pl = () => countPlayed(db, userId);
	const m = () => completedThisMonth(db, userId);
	const y = () => completedThisYear(db, userId);
	const g = (name) => countPlayedByGenre(db, userId, name);

	const progressMap = {
		uno_completado: () => ({ current: c(), target: 1 }),
		cinco_completados: () => ({ current: c(), target: 5 }),
		diez_completados: () => ({ current: c(), target: 10 }),
		veinticinco_completados: () => ({ current: c(), target: 25 }),
		cincuenta_completados: () => ({ current: c(), target: 50 }),
		veinte_completados: () => ({ current: c(), target: 20 }),
		quince_completados: () => ({ current: c(), target: 15 }),
		ochenta_completados: () => ({ current: c(), target: 80 }),
		leyenda: () => ({ current: c(), target: 100 }),
		lista_infinita: () => ({ current: p(), target: 10 }),
		coleccionista: () => ({ current: p(), target: 20 }),
		treinta_pendientes: () => ({ current: p(), target: 30 }),
		tres_pendientes: () => ({ current: p(), target: 3 }),
		cinco_pendientes: () => ({ current: p(), target: 5 }),
		mes_tres: () => ({ current: m(), target: 3 }),
		mes_uno: () => ({ current: m(), target: 1 }),
		mes_cinco: () => ({ current: m(), target: 5 }),
		adicto_mensual: () => ({ current: m(), target: 5 }),
		año_diez: () => ({ current: y(), target: 10 }),
		año_uno: () => ({ current: y(), target: 1 }),
		año_veinte: () => ({ current: y(), target: 20 }),
		dejaste_cinco: () => ({ current: a(), target: 5 }),
		dejaste_diez: () => ({ current: a(), target: 10 }),
		dejaste_veinticinco: () => ({ current: a(), target: 25 }),
		quince_abandonados: () => ({ current: a(), target: 15 }),
		cuarenta_abandonados: () => ({ current: a(), target: 40 }),
		abandono_precoz: () => ({ current: a(), target: 1 }),
		primera_abandonado: () => ({ current: a(), target: 1 }),
		terror_uno: () => ({ current: g("horror"), target: 1 }),
		terror_cinco: () => ({ current: g("horror"), target: 5 }),
		terror_diez: () => ({ current: g("horror"), target: 10 }),
		terror_quince: () => ({ current: g("horror"), target: 15 }),
		souls_uno: () => ({ current: g("souls"), target: 1 }),
		souls_cinco: () => ({ current: g("souls"), target: 5 }),
		souls_diez: () => ({ current: g("souls"), target: 10 }),
		rpg_uno: () => ({ current: g("rpg"), target: 1 }),
		rpg_cinco: () => ({ current: g("rpg"), target: 5 }),
		rpg_diez: () => ({ current: g("rpg"), target: 10 }),
		rpg_quince: () => ({ current: g("rpg"), target: 15 }),
		hack_uno: () => ({ current: g("action"), target: 1 }),
		hack_cinco: () => ({ current: g("action"), target: 5 }),
		hack_diez: () => ({ current: g("action"), target: 10 }),
		shooter_uno: () => ({ current: g("shooter"), target: 1 }),
		shooter_cinco: () => ({ current: g("shooter"), target: 5 }),
		shooter_diez: () => ({ current: g("shooter"), target: 10 }),
		shooter_quince: () => ({ current: g("shooter"), target: 15 }),
		strategy_uno: () => ({ current: g("strateg"), target: 1 }),
		strategy_cinco: () => ({ current: g("strateg"), target: 5 }),
		strategy_diez: () => ({ current: g("strateg"), target: 10 }),
		strategy_quince: () => ({ current: g("strateg"), target: 15 }),
		indie_uno: () => ({ current: g("indie"), target: 1 }),
		indie_cinco: () => ({ current: g("indie"), target: 5 }),
		indie_diez: () => ({ current: g("indie"), target: 10 }),
		indie_quince: () => ({ current: g("indie"), target: 15 }),
		metroid_uno: () => ({ current: g("metroidvania"), target: 1 }),
		metroid_cinco: () => ({ current: g("metroidvania"), target: 5 }),
		metroid_diez: () => ({ current: g("metroidvania"), target: 10 }),
		metroid_quince: () => ({ current: g("metroidvania"), target: 15 }),
		adventure_uno: () => ({ current: g("adventure"), target: 1 }),
		adventure_cinco: () => ({ current: g("adventure"), target: 5 }),
		sin_vida: () => ({ current: pl(), target: 75 }),
	};
	const fn = progressMap[achievementId];
	if (!fn) return null;
	const prog = fn();
	return prog && typeof prog.current === "number" && typeof prog.target === "number" ? prog : null;
}

export { ACHIEVEMENTS };
