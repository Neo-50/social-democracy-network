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
            insertAtCursor(editor, e.detail.unicode);
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

function insertAtCursor(editable, text) {
    editable.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    // move cursor after the inserted text
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

