/**
 * Iconos minimalistas (Lucide) para la app.
 * Mismo trazo y tamaño por defecto para mantener coherencia visual.
 */
import {
	Home,
	Search,
	Star,
	Users,
	Plus,
	Gamepad2,
	Clock,
	Calendar,
	Trophy,
	CircleSlash,
	MessageCircle,
	Play,
	Target,
	Layers,
} from "lucide-react";

const iconClass = "flex-shrink-0";
const sizeNav = 20;
const sizeNavMobile = 22;
const sizeStats = 24;
const stroke = 1.8;

export function IconHome(props) {
	return <Home className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconSearch(props) {
	return <Search className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconStar(props) {
	return <Star className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconUsers(props) {
	return <Users className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconTrophy(props) {
	return <Trophy className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconPlus(props) {
	return <Plus className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconGamepad(props) {
	return <Gamepad2 className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconClock(props) {
	return <Clock className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconCalendar(props) {
	return <Calendar className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconCircleSlash(props) {
	return <CircleSlash className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}

/** Para la barra inferior móvil (un poco más grandes) */
export function IconHomeMobile(props) {
	return <Home className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconSearchMobile(props) {
	return <Search className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconStarMobile(props) {
	return <Star className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconUsersMobile(props) {
	return <Users className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconTrophyMobile(props) {
	return <Trophy className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconPlusMobile(props) {
	return <Plus className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}
export function IconChat(props) {
	return <MessageCircle className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconChatMobile(props) {
	return <MessageCircle className={iconClass} size={sizeNavMobile} strokeWidth={stroke} {...props} />;
}

/** Para tarjetas de estadísticas y tabs del Dashboard */
export function IconGamepadStats(props) {
	return <Gamepad2 className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconStarStats(props) {
	return <Star className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconClockStats(props) {
	return <Clock className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconCalendarStats(props) {
	return <Calendar className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconCircleSlashStats(props) {
	return <CircleSlash className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconPlayStats(props) {
	return <Play className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconChatStats(props) {
	return <MessageCircle className={iconClass} size={sizeStats} strokeWidth={stroke} {...props} />;
}
export function IconTarget(props) {
	return <Target className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
export function IconLayers(props) {
	return <Layers className={iconClass} size={sizeNav} strokeWidth={stroke} {...props} />;
}
