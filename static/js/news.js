let activeCommentBox = null;
let activeCommentContent = null;
window.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

document.addEventListener('DOMContentLoaded', () => {
    
    if (typeof window.initReactionSocket === "function") {
        window.initReactionSocket();
    }
    if (typeof window.initCommentSocket === "function") {
        window.initCommentSocket();
    }

    // UNICODE EMOJI DRAWER
    document.addEventListener("click", e => {
        const emojiButton = e.target.closest(".emoji-button");
        if (!emojiButton) return; // No emoji button clicked
        const toolbar = emojiButton.closest(".comment-toolbar");
        const box = emojiButton.closest(".comment-box");

        if (toolbar) {
            unicodeReactionDrawer(toolbar);
        }
        if (box) {
            unicodeEmojiDrawer(box);
        }
    });

    // CUSTOM EMOJI DRAWER
    document.addEventListener("click", e => {
        const customButton = e.target.closest(".emoji-button[data-emoji-type='custom']");
        if (customButton) {
            customEmojiDrawer(customButton);
        }
    });

    // FILE UPLOAD
    document.querySelectorAll("form").forEach(form => {
        const editor = form.querySelector(".comment-editor");
        const fileInput = form.querySelector(".file-input");
        const uploadButton = form.querySelector(".upload-button");

        if (!editor || !fileInput || !uploadButton) {
            return;
        }

        uploadButton.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (!file || !file.type.startsWith("image/")) return;

            const formData = new FormData();
            formData.append("file", file);

            fetch("/news/upload_news_image", {
                method: "POST",
                body: formData,
            })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok || !data.success) {
                        throw new Error(data.error || "Upload failed");
                    }
                    return data;
                })
                .then(data => {
                    const img = document.createElement("img");
                    img.src = data.url;
                    img.alt = file.name;
                    img.className = "uploaded-image";

                    insertNodeAtCursor(editor, img);
                })
                .catch(err => {
                    console.error("Upload failed:", err);
                    showToast(err.message || "Upload error");
                });
            fileInput.value = "";
        });
    });

    // COMMENT SYNC ON SUBMIT (AJAX + sockets, no reload)
    document.querySelectorAll('form[action^="/comment/"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const editor = form.querySelector('.comment-editor');
            const hiddenInput = form.querySelector('input[name="comment-content"]');
            const submitBtn = form.querySelector('[type="submit"]');

            try {
                if (editor) {
                    // 1) Convert any base64 imgs to uploads (your existing helper)
                    await handleBase64Images(editor);
                }

                if (!editor || !hiddenInput) {
                    console.warn('Editor or hidden input not found', { editor, hiddenInput });
                    return;
                }

                // 2) Move sanitized HTML into hidden input for server
                hiddenInput.value = editor.innerHTML;

                // 3) POST via fetch (AJAX)
                submitBtn?.setAttribute('disabled', 'disabled');
                const fd = new FormData(form);
                const res = await fetch(form.action, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': window.csrfToken }, // you already have this set
                    body: fd,
                });

                // Expect JSON {"ok": true, "comment_id": ...} from route
                const data = await res.json();
                if (!res.ok || !data.ok) {
                    console.error('Comment failed', data);
                    return;
                }

                // 4) Do NOT insert HTML here; let the socket echo handle it
                // (server emits "new_comment" include_self=True)
                editor.innerHTML = '';           // clear composer
                form.querySelector('[name="parent_id"]')?.setAttribute('value', ''); // optional: reset reply
            } catch (err) {
                console.error('Comment submit error:', err);
            } finally {
                submitBtn?.removeAttribute('disabled');
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

    document.querySelectorAll(".comment-content img").forEach(img => {
        if (img.src.includes("/media/news/") && !img.className) {
            img.classList.add("uploaded-image");
        }
    });
});

window.initCommentSocket = function () {
    // always clear old handlers first
    commentSocket.off('connect');
    commentSocket.off('disconnect');
    commentSocket.off('new_comment');
    commentSocket.off('delete_comment');

    // log connect/disconnect
    commentSocket.on('connect', () => {
        console.log('🟢 /news_comments connected', commentSocket.id);
    });
    commentSocket.on('disconnect', (reason) => {
        console.log('🔴 /news_comments disconnected:', reason);
    });

    // bind the event handlers only after we’re actually connected
    onceConnected(commentSocket, () => {
        console.log('✅ binding comment handlers');

        commentSocket.on('new_comment', (data) => {
            console.log('[WS] new_comment:', data);

            const article = document.querySelector(`[data-article-id="${data.article_id}"]`);
            if (!article) return;

            const container = data.parent_id
            ? article.querySelector(`[data-comment-id="${data.parent_id}"] .replies`)
            : article.querySelector('.comments-list');
            if (!container) return;

            const tmp = document.createElement('div');
            tmp.innerHTML = (data.html || data.content_html || '').trim();
            const node = tmp.firstElementChild;
            if (node) container.appendChild(node);
        });

        commentSocket.on('delete_comment', ({ comment_id }) => {
            document.querySelector(`[data-comment-id="${comment_id}"]`)?.remove();
        });
    });

  // NOW connect (after handlers are ready)
  if (!commentSocket.connected) commentSocket.connect();
};

// helper: run fn when socket is connected
function onceConnected(socket, fn) {
    if (socket.connected) {
        fn();
    } else {
        socket.once('connect', fn);
    }
}


function unicodeEmojiDrawer(box) {
    const pickerWrapper = box.querySelector(".emoji-wrapper");
    const picker = pickerWrapper.querySelector("emoji-picker");

    pickerWrapper.style.display =
        pickerWrapper.style.display === "none" || !pickerWrapper.style.display
            ? "block"
            : "none";

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
    return;
}

function unicodeReactionDrawer(toolbar) {
    const picker = document.querySelector("#unicode-emoji-picker");
    let wrapper = document.querySelector("#unicode-wrapper-reaction");
    picker.dataset.commentId = toolbar.closest(".comments-thread").dataset.commentId;

    if (!toolbar.contains(wrapper)) {
        toolbar.appendChild(wrapper);
    }

    // Set current target for emoji insert
    activeCommentContent = toolbar.parentElement.querySelector(".comment-content");

    wrapper.classList.toggle("visible");

    if (!picker.dataset.bound) {
        picker.addEventListener("emoji-click", (e) => {
            const commentId = picker.dataset.commentId;
            if (activeCommentContent) {
                const emoji = e.detail.unicode;

                console.log("unicodeReactionDrawer: ", 'user_ids | ', [window.CURRENT_USER_ID], 'emoji | ', emoji, "user_id | ", window.CURRENT_USER_ID);

                window.renderReaction({
                    target: activeCommentContent,
                    emoji: emoji,
                    target_id: commentId,
                    targetType: window.NEWS_ROOM_ID,
                    user_id: window.CURRENT_USER_ID,
                    user_ids: [window.CURRENT_USER_ID],
                    mode: "insert",
                    emit: true
                });

                console.log("Reaction inserted:", emoji);
            }
        });
        picker.dataset.bound = "true";
    }
}

document.querySelectorAll('.reply-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const wrapper = button.closest('.comment-container');
        const drawer = wrapper.querySelector('.reply-drawer');
        if (drawer) {
            drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
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

function insertNodeAtCursor(editable, node) {
    if (!editable || typeof editable.focus !== "function") {
        console.error("insertNodeAtCursor: invalid editable target", editable);
        return;
    }

    editable.focus();

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
        // Put it at the end as a fallback
        editable.appendChild(node);
        return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    // Place caret after the inserted node
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}
