window.messageSocket = io('/messages');
window.chatSocket = io('/chat');
window.reactionSocket = io("/reactions");
window.commentSocket = io('/news_comments', {
  autoConnect: false,
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.initNotificationSocket === "function") {
        window.initNotificationSocket();
    }

    if (typeof fetchUnreadNotifications === "function") {
        fetchUnreadNotifications();
    }

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

    function bindHandlers() {
        messageSocket.off('delete_message');
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
        
        messageSocket.off('new_message');
        messageSocket.on('new_message', (msg) => {
            console.log("📨 New socket message:", msg);
            renderNewMessage(msg);
        });
    };
    
    function joinRoom() {
        messageSocket.emit('join', String(window.ROOM_ID));
        console.log("📥 Joined room:", String(window.ROOM_ID));
    }

    bindHandlers();

    messageSocket.off('connect');
	messageSocket.on('connect', () => {
		console.log("🟢 messageSocket connected");
		bindHandlers();
		joinRoom();
	});

    messageSocket.off('disconnect');
	messageSocket.on('disconnect', (r) => console.log('⛔ /messages disconnected:', r));
	messageSocket.off('connect_error');
	messageSocket.on('connect_error', (err) => console.log('⚠️ connect_error (/messages):', err.message));

	// if we're already connected (common on SPA/nav), do the work now
	if (messageSocket.connected) {
        console.log("🟢 messageSocket connected, joining room");
		joinRoom();
	} else {
		messageSocket.connect();
		console.log('📡 messageSocket connecting…');
	}
};

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
        console.log('reactionSocket reaction_update')
        const { emoji, emote_title, target_type, action, user_id, user_ids, target_id, article_id } = data;
        console.log('reactionSocket data received: ', data)
        let target;
        if (target_type === "news") {
            let selector;
            selector = (target_id != null)
                ? `.comment-container[data-comment-id="${target_id}"]`
                : `.news-article[data-article-id="${article_id}"]`;
            root = document.querySelector(selector);
            target = root.querySelector(".reactions-container");
        }
        if (target_type === "chat") {
            target = document.querySelector(`.chat-message[data-message-id="${target_id}"]`);
        }
        console.log('***reaction_update received***: ', 'emoji: ', emoji, ' | target_type: ', target_type, 
            ' | target: ', target, ' | action: ', action, ' | user_id: ', user_id, ' | user_ids: ', user_ids, ' | target_id', target_id, 
            ' | article_id: ', article_id);
        if (!target) return;

        const payload = {
            emoji,
            emote_title,
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

function handleReactionUpdate({ emoji, emote_title, target_type, action, user_id, user_ids, target, target_id = null, article_id = null}) {
    
    console.log('***handleReactionUpdate*** data: ', '| emoji: ', emoji, 'emote_title: ', emote_title, '| target_type: ', target_type, 
        'action: ', action, '| user_id: ', user_id, 'user_ids | ', user_ids, '| target: ', target,  
        '| target_id: ', target_id,  ' | article_id: ', article_id);

    const reactionSpan = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);

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
            console.log('Update existing reaction: ', reactionSpan, user_ids);
            const countEl = reactionSpan.querySelector(".reaction-count");
            if (countEl) countEl.textContent = user_ids.length;
            reactionSpan.dataset.user_ids = JSON.stringify(user_ids);
            updateReactionTooltip(reactionSpan, user_ids, emote_title);
        } else {
            // Create new reaction
            console.log('renderReaction called from handleReactionUpdate')
            window.renderReaction({
                target,
                emoji,
                emote_title,
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

function isCustomEmoji(val) {
    return typeof val === "string" && /\.(png|webp|gif|jpe?g|svg)$/i.test(val);
}

window.updateReactionTooltip = function (span, user_ids, emote_title = '') {
    const emoji = String(span.dataset.emoji);

    console.log('window.emojiMapReady: ', window.emojiMapReady);
    console.log('updateReactionTooltip [emojiMap] ready?:',
        window.emojiMap && Object.keys(window.emojiMap).length,
        'len=', window.emojiMap ? Object.keys(window.emojiMap).length : 0
    );

    if (!emote_title) {
        emote_title = window.emojiMap[emoji] || '';
    }
    if (!emote_title && isCustomEmoji(emoji)) {
        emote_title = emoji.replace(/\.[^.]+$/, "");
    }

    console.log('updateReactionTooltip: span: ', span,
        ' | user_ids: ', user_ids, ' | emote_title: ', emote_title, ' | emoji: ', emoji);
    const names = user_ids.map(id => {
        const u = window.userMap[id] || {};
        return u.display_name || u.username || `User ${id}`;
    });
    span.title = `${emote_title} reacted by: ${names.join(", ")}`;
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

