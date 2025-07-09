function showUserPopup(element) {
    const popup = document.getElementById('user-popup');

    // Set content
    document.getElementById('popup-avatar').src = element.dataset.avatar;
    document.getElementById('popup-username').textContent = element.dataset.username;
    document.getElementById('popup-display-name').textContent = element.dataset.display_name;
    document.getElementById('popup-bio').textContent = element.dataset.bio;

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