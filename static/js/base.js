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
});

const messageSocket = io('/messages'); // Global socket instance
const chatSocket = io('/chat');

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

        socket.on('delete_message', (data) => {
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

    chatSocket.emit('join', 'chat_global');
    console.log("🟢 Joined chatroom");
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

setTimeout(() => {
    document.querySelectorAll('.flash-message').forEach(el => el.remove());
}, 4000);

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
