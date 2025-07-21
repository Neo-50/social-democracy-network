const socket = io();  // Global socket instance
window.ROOM_ID = `thread_${Math.min(CURRENT_USER_ID, RECIPIENT_ID)}_${Math.max(CURRENT_USER_ID, RECIPIENT_ID)}`;
window.RECIPIENT_ID = parseInt(recipientId);

document.getElementById("notification-icon").addEventListener("click", async () => {
        document.getElementById("notif-badge").style.display = "none";
            await fetch("/api/mark_notifications_read", { method: "POST" });
            // loadNotifications(); // or toggle the panel if already loaded
})

// Always listen for new messages to trigger notification UI
socket.on('new_message', (msg) => {
	console.log('📩 New socket message:', msg);
	renderNewMessage?.(msg);  // Optional chaining in case function doesn't exist
	showNotificationBadge?.(); // Optional chaining again
});

window.initMessageThreadSocket = function(recipientId) {
	if (!window.recipientId || !window.CURRENT_USER_ID) return;	

	socket.emit('join', ROOM_ID);
	console.log('🔌 Joined room:', ROOM_ID);

	socket.on('delete_message', (data) => {
	  const messageId = data.message_id;
	  const messageWrapper = document
		.querySelector(`.message-wrapper[data-id="${messageId}"]`)
		?.closest('.message-wrapper');

	  if (messageWrapper) {
		  messageWrapper.remove();
		  console.log('❌ Message deleted via socket:', messageId);
		}
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
