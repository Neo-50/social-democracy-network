window.messageSocket = io('/messages');
window.chatSocket = io('/chat');
window.reactionSocket = io("/reactions");
window.commentSocket = io('/news_comments', {
  autoConnect: false,
});

document.addEventListener('DOMContentLoaded', () => {
    // Online users drawer
    const btn = document.getElementById("onlineBtn");
    if (!btn) {
        console.warn("onlineBtn not found in DOM");
        return;
    }

    document.addEventListener("click", function (e) {
        const drawer = document.getElementById("onlineDrawer");
        const toggleBtn = document.getElementById("onlineBtn");

        if (!drawer) return;

        const isClickInside = drawer.contains(e.target) || toggleBtn.contains(e.target);

        if (!isClickInside && drawer.style.display === "block") {
            drawer.style.display = "none";
        }
    });

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
    
    setTimeout(() => {
        document.querySelectorAll('.flash-message').forEach(el => el.remove());
    }, 4000);
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
                console.log("ℹ️ Message already deleted on this client:", messageId);
            }
        });

        messageSocket.on('new_message', (msg) => {
            console.log("📨 New socket message:", msg);
            renderNewMessage(msg);
        });

        messageSocket.emit('join', String(window.ROOM_ID));
        console.log("📥 Joined room:", String(window.ROOM_ID));
    });
};

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

window.initReactionSocket = function (target_type) {
    console.log("🔄 initReactionSocket called");
    reactionSocket.off('connect');

    if (reactionSocket.connected) {
        console.log("🟢 Reaction socket already connected");
        window.reactionSocket.emit("join", target_type);
    } else {
        reactionSocket.on("connect", () => {
            console.log("🟢 Reaction socket connected");
            window.reactionSocket.emit("join", target_type);
        });
    }
    reactionSocket.off("reaction_update");
    reactionSocket.on("reaction_update", (data) => {
        const { emoji, target_type, action, user_id, user_ids, target_id, article_id   } = data;
        let target;
        if (target_type === "news") {
            let selector;
            selector = (target_id != null)
                ? `.comment-container[data-target-id="${target_id}"]`
                : `.news-article[data-article-id="${article_id}"]`;
            root = document.querySelector(selector);
            target = root.querySelector(".reactions-container");
        }
        if (target_type === "chat") {
            target = document.querySelector(`.chat-message[data-message-id="${target_id}"]`);
        }
        console.log('reaction_update received: ', emoji, target_type, target, action, user_id, user_ids, target_id, article_id);
        if (!target) return;

        const payload = {
            emoji,
            target_type,
            action,
            user_id,
            user_ids,
            target,
            ...(target_id != null ? { target_id } : { article_id })
        };

        handleReactionUpdate(payload);
    });
}

function handleReactionUpdate({ emoji, target_type, action, user_id, user_ids, target, target_id = null, article_id = null}) {
    
    console.log('handleReactionUpdate data: ', '| emoji: ', emoji, '| target_type: ', target_type, 
        'action: ', action, '| user_id: ', user_id, 'user_ids | ', user_ids, '| target: ', target,  
        '| target_id: ', target_id,  'article_id: ', article_id);
    
    const selector =
        `.emoji-reaction[data-emoji="${emoji}"]` +
        (target_id != null ? `[data-target-id="${target_id}"]`
            : `[data-article_id="${article_id}"]`);
    
    const reactionSpan = target.querySelector(selector);

    if (!reactionSpan) {
        if (action === "add") {
            // not present yet — create it
            createNewReaction({ target, emoji, target_type, user_id, user_ids, target_id, article_id});
        } else {
            // remove or unknown — nothing to do
            console.warn("Reaction span not found:", { selector, target });
        }
        return;
    }

    if (action === "add") {
        console.log("handleReactionUpdate add branch");
        if (reactionSpan) {
            // Update existing reaction count
            const countEl = reactionSpan.querySelector(".reaction-count");
            if (countEl) countEl.textContent = user_ids.length;
            reactionSpan.dataset.user_ids = JSON.stringify(user_ids);
            updateReactionTooltip(reactionSpan, user_ids);
        } else {
            // Create new reaction
            console.log('renderReaction called from handleReactionUpdate')
            window.renderReaction({
                target,
                emoji,
                target_type,
                user_id,
                user_ids,
                target_id,
                article_id,
                mode: "insert"
            });
        }
    }
    else if (action === "remove") {
        if (!reactionSpan) return;

        if (!user_ids || user_ids.length === 0) {
            // Remove entire reaction if no users left
            reactionSpan.remove();
        } else {
            // Update count if users remain
            const countEl = reactionSpan.querySelector(".reaction-count");
            if (countEl) countEl.textContent = user_ids.length;
            reactionSpan.dataset.user_ids = JSON.stringify(user_ids);
            updateReactionTooltip(reactionSpan, user_ids);
        }
    }
};

window.updateReactionTooltip = function (span, user_ids) {
    console.log('updateReactionTooltip: span: ', span, ' | user_ids: ', user_ids)
    const usernames = user_ids.map(id => window.userMap[id] || `User ${id}`);
    span.title = `Reacted by: ${usernames.join(", ")}`;
}

window.initChatSocket = function () {
    console.log("💬 initChatSocket called");

    chatSocket.off('new_message');
    chatSocket.off('delete_message');

    const joinRoom = () => {
        chatSocket.emit('join', 'chat_global');
        console.log("🟢 Joined chatroom");
    };

    if (chatSocket.connected) {
        console.log("🟢 Chat socket already connected");
        joinRoom();
    } else {
        chatSocket.on('connect', () => {
            console.log("🟢 Chat socket just connected");
            joinRoom();
        });
    }

    chatSocket.on('new_message', msg => {
        console.log("📩 [chat] New message received:", msg);
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

