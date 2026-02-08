import webPush from "web-push";

let vapidKeys = null;

function getVapidKeys() {
	if (vapidKeys) return vapidKeys;
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return null;
	vapidKeys = { publicKey, privateKey };
	webPush.setVapidDetails("mailto:app@juegos.local", publicKey, privateKey);
	return vapidKeys;
}

export function isPushConfigured() {
	return !!getVapidKeys();
}

export async function sendPushToUser(db, userId, payload) {
	const sub = db.prepare(
		"SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?"
	).get(userId);
	if (!sub) return;
	const keys = getVapidKeys();
	if (!keys) return;
	try {
		await webPush.sendNotification(
			{
				endpoint: sub.endpoint,
				keys: { p256dh: sub.p256dh, auth: sub.auth },
			},
			JSON.stringify(payload),
			{ TTL: 86400 }
		);
	} catch (err) {
		if (err.statusCode === 410 || err.statusCode === 404) {
			db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(userId);
		}
	}
}
