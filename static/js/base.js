const messageSocket = io('/messages');
const chatSocket = io('/chat');

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
    
    document.addEventListener("click", function (e) {
        const drawer = document.getElementById("onlineDrawer");
        const toggleBtn = document.getElementById("onlineBtn");

        if (!drawer) return;

        const isClickInside = drawer.contains(e.target) || toggleBtn.contains(e.target);

        if (!isClickInside && drawer.style.display === "block") {
            drawer.style.display = "none";
        }
    });
});

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
                console.warn("⚠️ Could not find message to delete:", messageId);
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

