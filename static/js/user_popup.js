function showUserPopup(element) {
    const popup = document.getElementById('user-popup');

    // Set content
    document.getElementById('popup-avatar').src = element.dataset.avatar;
    document.getElementById('popup-username').textContent = element.dataset.username;
    document.getElementById('popup-display-name').textContent = element.dataset.display_name;
    document.getElementById('popup-bio').textContent = element.dataset.bio;
    document.getElementById("popup-send-message").dataset.recipientId = element.dataset.id;

    popup.style.position = 'absolute';
    popup.style.display = 'block';

    // Force a paint so offsetWidth/Height are valid
    void popup.offsetWidth;

    // Center on screen
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;
    const centerX = (window.innerWidth - popupWidth) / 2;
    const centerY = window.scrollY + (window.innerHeight - popupHeight) / 4;

    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;

    // Only initialize draggable once
    if (!popup.dataset.draggable) {
        makeDraggable(popup);
        popup.dataset.draggable = 'true';
    }
}

function hideUserPopup() {
    document.getElementById('user-popup').style.display = 'none';
}

function makeDraggable(popup) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    popup.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        // Get visual position
        const rect = popup.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - (rect.top + window.scrollY);
        isDragging = true;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        popup.style.left = `${e.clientX - offsetX}px`;
        popup.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

const popupInput = document.getElementById("popup-send-message")

if (popupInput) {
  	popupInput.addEventListener("keypress", function (e) {
    	if (e.key === "Enter") {
			e.preventDefault();

			const input = e.target;
			const content = input.value.trim();
			const recipientId = input.dataset.recipientId;

			console.log("📤 Sending message to", recipientId, "with content:", content);

			if (!content || !recipientId) {
				console.warn("⛔ Missing data", { recipientId, content });
				return;
			}

			fetch("/api/send_message", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `recipient_id=${recipientId}&content=${encodeURIComponent(content)}`
			})
			.then(res => res.json())
			.then(data => {
			if (data.success) {
				input.value = ""; // Clear input
				showToast('Message sent!')
			} else {
				console.error("Failed to send:", data.error);
			}
    		});
		}
	});
}
