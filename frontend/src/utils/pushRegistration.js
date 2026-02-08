/**
 * Registra el Service Worker y suscribe al usuario a notificaciones push.
 * Se llama cuando hay usuario logueado. Requiere VAPID en backend.
 */
export async function registerPushIfPossible(apiBase, userSlug) {
	if (!userSlug || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
	try {
		const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
		await reg.update();
		const configRes = await fetch(`${apiBase}/api/push-config`);
		const config = await configRes.json().catch(() => ({}));
		if (!config?.enabled || !config?.publicKey) return;
		const permission = await Notification.requestPermission();
		if (permission !== "granted") return;
		let sub = await reg.pushManager.getSubscription();
		if (!sub) {
			sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(config.publicKey),
			});
		}
		if (sub) {
			await fetch(`${apiBase}/api/users/${userSlug}/push-subscription`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(sub.toJSON()),
			});
		}
	} catch (_) {
		// Push no disponible o rechazado
	}
}

function urlBase64ToUint8Array(base64String) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = window.atob(base64);
	const output = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
	return output;
}
