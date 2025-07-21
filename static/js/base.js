const socket = io();  // Global socket instance

document.getElementById("notification-icon").addEventListener("click", async () => {
        document.getElementById("notif-badge").style.display = "none";
            await fetch("/api/mark_notifications_read", { method: "POST" });
            // loadNotifications(); // or toggle the panel if already loaded
})


window.initMessageThreadSocket = function() {
    console.log("📞 initMessageThreadSocket called");

    if (!window.CURRENT_USER_ID || !window.RECIPIENT_ID) {
        console.warn("❌ Missing IDs:", window.CURRENT_USER_ID, window.RECIPIENT_ID);
        return;
    }
 
    window.ROOM_ID = `thread_${Math.min(window.CURRENT_USER_ID, window.RECIPIENT_ID)}_${Math.max(window.CURRENT_USER_ID, window.RECIPIENT_ID)}`;
    
    
    socket.off('new_message'); // Prevent duplicate listeners

    socket.on('connect', () => {
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
        socket.on('new_message', (msg) => {
            console.log("📩 New socket message:", msg);
            renderNewMessage?.(msg);
            showNotificationBadge?.();
        });  

        socket.emit('join', window.ROOM_ID);
        console.log("📎 Joined room:", window.ROOM_ID); 
	});
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
