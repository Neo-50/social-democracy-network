window.notificationSocket = io('/notifications')

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/unread_notifications')
        .then(res => res.json())
        .then(data => {
            const container = document.querySelector('.notif-content');
            if (!container || !data.length) return;

            const placeholder = container.querySelector('.placeholder');
            if (placeholder) placeholder.remove();

            data.forEach(item => {
                container.appendChild(createNotificationElement(item));
                formatTimestamp(container);
            });
        });
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
});

window.initNotificationSocket = function () {
    if (!window.notificationSocket.connected) {
        console.log('notificationSocket connect');
        window.notificationSocket.connect();
    }
    // 3) join your user room on connect (and on hot reload reconnects)
    window.notificationSocket.off('connect'); // avoid duplicates across navigations
    window.notificationSocket.on('connect', () => {
        const userRoom = `user_${window.CURRENT_USER_ID}`;
        window.notificationSocket.emit('join_user', userRoom);
        console.log('🔔 joined', userRoom);
    });

    // 4) (re)bind the notification receiver you already have
    window.notificationSocket.off('notification');  // prevent double handlers
    window.notificationSocket.on('notification', data => {
        console.log('⚠️ Notification received:', data);
        showToast(`New message from ${data.from}`);

        const container = document.querySelector('.notif-content');
        if (!container) return;

        const placeholder = container.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        container.prepend(createNotificationElement(data));
        formatTimestamp(container);

        fetch('/api/unread_count')
            .then(res => res.json())
            .then(data => {
                if (data.count) showNotificationBadge(data.count);
            });
    });

    // Check for unread messages on page load
    fetch('/api/unread_count')
        .then(res => res.json())
        .then(data => {
            if (data.count) {
                showNotificationBadge(data.count);
            } else {
                hideNotificationBadge();
            }
        });
}
