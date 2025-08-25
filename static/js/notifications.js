window.notificationSocket = io('/notifications');

function fetchUnreadNotifications () {
    fetch('/api/unread_notifications')
        .then(res => res.json())
        .then(data => {
            const container = document.querySelector('.notif-content');
            if (!container || !data.length) return;

            const placeholder = container.querySelector('.placeholder');
            if (placeholder) placeholder.remove();

            data.forEach(item => {
                container.appendChild(createNotificationElement(item));
            });
            formatTimestamp(container);
            showNotificationBadge?.(data.length);
        });
    
    notificationListeners();
}

function createNotificationElement({ from, timestamp, message }) {
    console.log('createNotificationElement', from, timestamp, message);
	const div = document.createElement('div');
	div.classList.add('notif-item');
	div.innerHTML = `
	<strong>${from}</strong> 
	<div class="notif-message-content">${message}</div>
	<span class="timestamp" data-timestamp="${timestamp}"></span>
	`;
	return div;
}

function notificationListeners () {
    if (!window.CURRENT_USER_ID) return;
    document.querySelector('.clear-notifs').addEventListener('click', async (e) => {
        e.preventDefault();
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const res = await fetch('/clear-notifs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
        });

        if (res.ok) {
            // Clear the visual badge and drawer content
            hideNotificationBadge();
            document.querySelector('.notif-content').innerHTML = '<p class="placeholder">No new notifications</p>';
        }
    });

    // Notification drawer
    const bellIcon = document.getElementById("notification-icon");
    const drawer = document.getElementById("notifDrawer");

    bellIcon.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent global click handler from immediately hiding it
        drawer.classList.toggle("show");
    });

    // Hide drawer when clicking outside of it
    document.addEventListener("click", (e) => {
        const isClickInside = drawer.contains(e.target) || bellIcon.contains(e.target);
        if (!isClickInside) {
            drawer.classList.remove("show");
        }
    });
}

window.initNotificationSocket = function () {
	console.log('initNotificationSocket');
	if (!window.CURRENT_USER_ID) return;

	const userRoom = `user_${window.CURRENT_USER_ID}`;

	// bind (or re-bind) all handlers
	function bindHandlers() {
		notificationSocket.off('new_notification');
		notificationSocket.on('new_notification', (data) => {
			console.log('⚠️ Notification received:', data);
			showToast(`New message from ${data.from}`);

			const container = document.querySelector('.notif-content');
			if (!container) return;

			const placeholder = container.querySelector('.placeholder');
			if (placeholder) placeholder.remove();

			container.prepend(createNotificationElement(data));
			formatTimestamp(container);

			fetch('/api/unread_count')
				.then((res) => res.json())
				.then((data) => {
					if (data.count) showNotificationBadge(data.count);
				});
		});
	}

	// (re)join room; safe to call multiple times
	function joinRoom() {
		notificationSocket.emit('join', userRoom);
		console.log('🔔 joined notifications room', userRoom);
	}

	// always (re)bind handlers first
	bindHandlers();

	// ensure we handle connect/reconnects
	notificationSocket.off('connect');
	notificationSocket.on('connect', () => {
		console.log('🔌 /notifications connected');
		bindHandlers(); // in case the lib dropped listeners on reconnect
		joinRoom();
	});

	// helpful diagnostics
	notificationSocket.off('disconnect');
	notificationSocket.on('disconnect', (r) => console.log('⛔ /notifications disconnected:', r));
	notificationSocket.off('connect_error');
	notificationSocket.on('connect_error', (err) => console.log('⚠️ connect_error (/notifications):', err.message));

	// if we're already connected (common on SPA/nav), do the work now
	if (notificationSocket.connected) {
        console.log("🟢 notificationSocket connected, joining room");
		joinRoom();
	} else {
		notificationSocket.connect();
		console.log('📡 notificationSocket connecting…');
	}
};
