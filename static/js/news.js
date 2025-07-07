let activeCommentBox = null;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById("file-input");
    const uploadButton = document.getElementById("upload-button");

    // UNICODE EMOJI DRAWER
    document.addEventListener("click", e => {
        const emojiButton = e.target.closest(".emoji-button[data-emoji-type='unicode']");
        if (!emojiButton) return;

        toggleEmojiPicker({ target: emojiButton });
        });

    // CUSTOM EMOJI DRAWER
    document.addEventListener("click", e => {
        const customButton = e.target.closest(".emoji-button[data-emoji-type='custom']");
        if (customButton) {
            toggleCustomEmojiDrawer(customButton);
        }
    });
  
    // FILE UPLOAD
    uploadButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (file) {
            console.log("Selected file:", file.name);
            // you would upload this file to the server or Matrix API here
        }
    });
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            const editor = form.querySelector('.comment-editor');
            const hidden = form.querySelector('.hidden-content');
            if (editor && hidden) {
                hidden.value = editor.innerHTML;
            }
        });
    });

    document.addEventListener("click", (e) => {
        const isCustomButton = e.target.closest(".emoji-button[data-emoji-type='custom']");
        const isInCustomDrawer = e.target.closest(".custom-wrapper");

        if (!isCustomButton && !isInCustomDrawer && activeCommentBox) {
            // clicked outside, close drawer
            const wrapper = activeCommentBox.querySelector(".custom-wrapper");
            if (wrapper) wrapper.style.display = "none";
            activeCommentBox = null;
        }
    });
  
    document.addEventListener("click", (e) => {
        const isEmojiButton = e.target.closest(".emoji-button[data-emoji-type='unicode']");
        const isInUnicodeDrawer = e.target.closest(".emoji-wrapper");

        if (!isEmojiButton && !isInUnicodeDrawer) {
            document.querySelectorAll(".emoji-wrapper").forEach(wrapper => {
                wrapper.style.display = "none";
            });
        }
    });
});

function toggleUnicodeEmojiDrawer(commentBox) {
    const wrapper = commentBox.querySelector(".emoji-wrapper");
    if (!wrapper) return;

    wrapper.style.display = wrapper.style.display === "none" ? "block" : "none";
}

function toggleCustomEmojiDrawer(button) {
    console.log('Toggling custom emoji drawer')
    const commentBox = button.closest(".comment-box");
    const wrapper = commentBox.querySelector(".custom-wrapper");

    if (wrapper.style.display === "flex") {
        wrapper.style.display = "none";
        const drawer = wrapper.querySelector(".custom-emoji-drawer");
        if (drawer) drawer.remove();
        activeCommentBox = null;
        console.log('Emoji drawer has been closed!');
        return;
    }

    // open it
    wrapper.style.display = "flex";

    let drawer = wrapper.querySelector(".custom-emoji-drawer");
    if (!drawer) {
        initializeEmojiDrawer(commentBox, wrapper);
    }
    activeCommentBox = commentBox;
}

document.addEventListener('DOMContentLoaded', function () {
    const timestampElements = document.querySelectorAll('.comment-timestamp');
    timestampElements.forEach(el => {
        const utcIso = el.dataset.timestamp;
        if (!utcIso) return;

        const date = new Date(utcIso);
        const options = {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric',
            hour12: true,
        };
        const localTime = new Intl.DateTimeFormat(undefined, options).format(date);
        el.textContent = localTime;
        console.log("Timestamp:", utcIso, "→", date.toString());
    });
});

document.querySelectorAll('.reply-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const wrapper = button.closest('.comment-container');
        const drawer = wrapper.querySelector('.reply-drawer');
        if (drawer) {
            drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
            const pickerWrapper = drawer.querySelector('.emoji-wrapper');
            if (pickerWrapper) {
                initializeEmojiDrawer(pickerWrapper);
            }
        }
    });
});

document.querySelectorAll('.cancel-reply').forEach(button => {
    button.addEventListener('click', (e) => {
        const drawer = e.target.closest('.reply-drawer');
        if (drawer) {
                drawer.style.display = 'none';
        }
    });
});

function toggleEmojiPicker(event) {
    const button = event.target;
    const box = button.closest(".comment-box");
    const pickerWrapper = box.querySelector(".emoji-wrapper");
    const picker = pickerWrapper.querySelector("emoji-picker");

    pickerWrapper.style.display = pickerWrapper.style.display === "none" || !pickerWrapper.style.display ? "block" : "none";

    if (!picker.dataset.bound) {
        picker.addEventListener("emoji-click", (e) => {
            const editor = box.querySelector(".comment-editor");
            const hidden = box.querySelector(".hidden-content");
            editor.focus();
            document.execCommand('insertText', false, e.detail.unicode);
            if (hidden) hidden.value = editor.innerHTML;
        });
    picker.dataset.bound = "true";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".youtube-placeholder").forEach(placeholder => {
        placeholder.innerHTML = placeholder.dataset.src;
    });
});


function showUserPopup(element) {
    const popup = document.getElementById('user-popup');

    // Set content
    document.getElementById('popup-avatar').src = element.dataset.avatar;
    document.getElementById('popup-username').textContent = element.dataset.username;
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

function copyLink(articleId) {
    const id = parseInt(articleId);
    const url = new URL(window.location.href);
    url.searchParams.set("article", id);

    navigator.clipboard.writeText(url.toString())
        .then(() => {
            showToast("🔗 Link copied!");
        })
        .catch(() => {
            showToast("❌ Failed to copy link.");
        });
}

