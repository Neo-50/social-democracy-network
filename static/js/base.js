window.messageSocket = io('/messages');
chatSocket = io('/chat');

messageSocket.on('notification', data => {
	console.log('🔔 Notification received:', data);
	showToast(`New message from ${data.from}`);

	// Insert notification preview
	const container = document.querySelector('.notif-content');
	if (!container) return;

	// Remove placeholder if present
	const placeholder = container.querySelector('.placeholder');
	if (placeholder) {
		placeholder.remove();
	}

	container.prepend(createNotificationElement(data));
	formatTimestamp(container);

	// Update count
	fetch('/api/unread_count')
		.then(res => res.json())
		.then(data => {
		if (data.count) {
			showNotificationBadge(data.count);
		}
		});
});


document.addEventListener('DOMContentLoaded', () => {
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
    
    const btn = document.getElementById("onlineBtn");
    if (!btn) {
        console.warn("onlineBtn not found in DOM");
        return;
    }

    btn.addEventListener("click", async () => {
        console.log("onlineBtn clicked");
        const drawer = document.getElementById("onlineDrawer");
        const onlineList = document.getElementById("onlineUserList");
        const offlineList = document.getElementById("offlineUserList");

        const isHidden = window.getComputedStyle(drawer).display === "none";

        if (isHidden) {
            drawer.style.display = "block";
            
            const res = await fetch("/active-users", { credentials: "include" });
            const data = await res.json();
            
            document.getElementById("onlineSection").style.display = data.online.length ? "block" : "none";
            document.getElementById("offlineSection").style.display = data.offline.length ? "block" : "none";
            
            onlineList.innerHTML = "";
            offlineList.innerHTML = "";

            data.online.forEach(user => {
                const li = document.createElement("li");
                const link = document.createElement("a");

                link.textContent = `🟢 ${user.display_name}`;
                link.href = "#";
                link.className = "user-popup-link";
                link.dataset.id = user.id;
                link.dataset.username = user.username;
                link.dataset.display_name = user.display_name;
                link.dataset.bio = user.bio || "No bio available";
                link.dataset.avatar = user.avatar_url;
                link.onclick = function () {
                    showUserPopup(this);
                };

                li.appendChild(link);
                onlineList.appendChild(li);
            });

            data.offline.forEach(user => {
                const li = document.createElement("li");
                const link = document.createElement("a");

                link.textContent = `⚫ ${user.display_name}`;
                link.href = "#";
                link.className = "user-popup-link";
                link.dataset.id = user.id;
                link.dataset.username = user.username;
                link.dataset.display_name = user.display_name;
                link.dataset.bio = user.bio || "No bio available";
                link.dataset.avatar = user.avatar_url;
                link.onclick = function () {
                    showUserPopup(this);
                };

                li.appendChild(link);
                offlineList.appendChild(li);
            });
            
        } else {
            drawer.style.display = "none";
        }
    });

	document.querySelector('.clear-notifs').addEventListener('click', async () => {
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
    
    document.addEventListener("click", function (e) {
        const drawer = document.getElementById("onlineDrawer");
        const toggleBtn = document.getElementById("onlineBtn");

        if (!drawer) return;

        const isClickInside = drawer.contains(e.target) || toggleBtn.contains(e.target);

        if (!isClickInside && drawer.style.display === "block") {
            drawer.style.display = "none";
        }
    });

	// Notification drawer
	const bellIcon = document.getElementById("notification-icon");
    const drawer = document.getElementById("notifDrawer");

    if (!bellIcon || !drawer) {
		console.log('Not found: ', bellIcon, drawer);
		return;
	}else {
		console.log('Found ', bellIcon, drawer)
	};
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

function createNotificationElement({ from, timestamp, message }) {
	const div = document.createElement('div');
	div.classList.add('notif-item');
	div.innerHTML = `
	<strong>${from}</strong> 
	<div class="notif-message-content">${message}</div>
	<span class="timestamp" data-timestamp="${timestamp}" style="opacity: 0.5; float: right;"></span>
	`;
	return div;
}

window.initMessageThreadSocket = function () {
    console.log("📡 initMessageThreadSocket called");

    if (!window.CURRENT_USER_ID || !window.RECIPIENT_ID) {
        console.warn("❌ Missing IDs:", window.CURRENT_USER_ID, window.RECIPIENT_ID);
        return;
    }

    window.ROOM_ID = `thread_${Math.min(window.CURRENT_USER_ID, window.RECIPIENT_ID)}_${Math.max(window.CURRENT_USER_ID, window.RECIPIENT_ID)}`;

    messageSocket.off('new_message');

    messageSocket.on('connect', () => {
        console.log("🟢 Socket connected");

        messageSocket.on('delete_message', (data) => {
            const messageId = data.message_id;
            const messageWrapper = document.querySelector(`.message-wrapper[data-id='${messageId}']`);
            if (messageWrapper) {
                messageWrapper.remove();
                console.log("❌ Message deleted via socket:", messageId);
            } else {
                console.log("ℹ️ Message already deleted on this client:", messageId);
            }
        });

        messageSocket.on('new_message', (msg) => {
            console.log("📨 New socket message:", msg);
            renderNewMessage(msg);
        });

        messageSocket.emit('join', window.ROOM_ID);
            console.log("📥 Joined room:", window.ROOM_ID);
    });
};


window.initChatSocket = function () {
    chatSocket.emit('join', 'chat_global');
            console.log("🟢 Joined chatroom");

    chatSocket.off('new_message');

    chatSocket.on('new_message', msg => {
        console.log("📥 [chat] New message received:", msg);
        appendMessage(
            msg.user_id,
            msg.username,
            msg.display_name,
            msg.content,
            msg.id,
            msg.avatar,
            msg.bio,
            msg.timestamp,
            false // Append to bottom
        );
    }); 
    chatSocket.on('delete_message', data => {
        const { message_id } = data;
        const msgEl = document.querySelector(`.chat-message[data-message-id="${message_id}"]`);
        if (msgEl) {
            msgEl.remove();
            console.log(`[chat] Message ${message_id} deleted via socket`);
        }
    });
};

setTimeout(() => {
        document.querySelectorAll('.flash-message').forEach(el => el.remove());
}, 4000);

function updateDate() {
    const currentDate = new Date();
    const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    };
    const formattedDate = currentDate.toLocaleString('en-US', options);
    document.getElementById('date').textContent = formattedDate;
}
updateDate();

function toggleMobileMenu() {
    const nav = document.getElementById('mobile-nav');
    if (nav) {
        nav.classList.toggle('show');
        } else {
            console.log('❌ mobile-nav not found');
    }
}

function toggleDirectory() {
    const nav = document.getElementById('mobile-directory');
    if (nav) {
        nav.classList.toggle('show');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function showNotificationBadge(count = 1) {
    const badge = document.getElementById("notif-badge");
    badge.innerText = count;
    badge.style.display = "inline-block";
}

function hideNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.style.display = 'none';
    }
}

