self.addEventListener("push", (event) => {
	let data = { title: "P*** Friki", body: "", url: "/" };
	try {
		if (event.data) data = { ...data, ...event.data.json() };
	} catch (_) {}
	const options = {
		body: data.body || "Nueva notificación",
		icon: "/icons/icon-192.png",
		badge: "/icons/icon-192.png",
		data: { url: data.url || "/" },
		tag: data.type === "message" ? "chat" : "game",
		renotify: true,
	};
	event.waitUntil(self.registration.showNotification(data.title || "P*** Friki", options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || "/";
	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
			if (list.length) {
				const w = list.find((c) => c.url.includes(self.registration.scope));
				if (w) {
					w.navigate(url);
					return w.focus();
				}
			}
			if (clients.openWindow) return clients.openWindow(url);
		})
	);
});
