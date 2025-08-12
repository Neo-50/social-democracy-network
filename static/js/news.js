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

    // EMOJI DRAWERS
    document.addEventListener("click", e => {
        const emojiButton = e.target.closest(".emoji-button");
        if (!emojiButton) return; // No emoji button clicked
        const toolbar = emojiButton.closest(".comment-toolbar");
        const box = emojiButton.closest(".comment-box");
        console.log('click toolbar: ', toolbar, 'box: ', box);
        const type = emojiButton.dataset.emojiType;
        console.log('Type of button', type)
        
        if (type === 'custom') {
            customEmojiDrawer(emojiButton);
        }
        if (toolbar && type === 'unicode') {
            console.log('***unicodeReactionDrawer***')
            unicodeReactionDrawer(toolbar);
        }
        if (box && type === 'unicode') {
            unicodeEmojiDrawer(box);
        }
    });

    // FILE UPLOAD
    document.querySelectorAll(".reply-drawer, .new-comment, .post-comment-container",).forEach(wireUpload);

    // COMMENT SYNC ON SUBMIT (AJAX + sockets, no reload)
    document.querySelectorAll('form[action^="/comment/"]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editor = form.querySelector('.comment-editor');
            const hiddenInput = form.querySelector('input[name="comment-content"]');
            const submitBtn = form.querySelector('[type="submit"]');

            if (!editor || !hiddenInput) {
                console.warn('Editor or hidden input not found', { editor, hiddenInput });
                return;
            }
            await maybeHandleBase64Images(editor);

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

            editor.innerHTML = '';
            form.querySelector('[name="parent_id"]')?.setAttribute('value', '');
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

    // Intercept only delete forms to prevent page navigation
    document.addEventListener('submit', async (e) => {
        console.log('Submit form')
        const form = e.target;
        if (!form.matches('.delete-form')) return;
        console.log('Delete form')
        e.preventDefault();

        try {
            const res = await fetch(form.action, {
            method: 'POST',
            headers: { 'X-CSRFToken': window.csrfToken || '' },
            body: new FormData(form)
            });
            const data = await res.json();
            if (!data.ok) return;

            // optional optimistic remove (socket will also remove it)
            // form.closest('.comment-container')?.remove();

        } catch (err) {
            console.error('Delete failed:', err);
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
        console.log('🟢 /news_comments connected');
    });
    commentSocket.on('disconnect', (reason) => {
        console.log('🔴 /news_comments disconnected:', reason);
    });

    // bind the event handlers only after we’re actually connected
    onceConnected(commentSocket, () => {
        console.log('✅ binding comment handlers');

        commentSocket.on('new_comment', (data) => {
            console.log('[WS] new_comment:', data);
            renderNewsComment(data);
        });

        commentSocket.on('delete_comment', ({ comment_id }) => {
            document.querySelector(
                `.comment-container[data-comment-id="${comment_id}"]`
            )?.remove();
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

function renderNewsComment(data) {
    const article = document.querySelector(`.news-article[id="${data.article_id}"]`)
                || document.querySelector(`.news-article[data-article-id="${data.article_id}"]`);
    if (!article) return;

    const thread = article.querySelector('.comments-thread');
    if (!thread) return;

    const INDENT = 60;
    let depth = 0;
    if (data.parent_id) {
        const parent = thread.querySelector(`.comment-container[data-comment-id="${data.parent_id}"]`);
        if (parent) depth = (parseInt(parent.style.marginLeft || '0', 10) || 0) / INDENT + 1;
    }

    const avatarSrc =
        data.avatar_url ||
        (data.avatar_filename ? `/media/avatars/${data.avatar_filename}` : '/media/avatars/default_avatar.png');

    const ts = data.created_at || new Date().toISOString();
    const inner = (data.content_html || '').trim();
    const contentHTML = inner.startsWith('<') ? inner : `<p>${inner}</p>`;

    const curId   = Number(window.CURRENT_USER_ID ?? NaN);
    const isAdmin = !!window.IS_ADMIN;
    const author  = Number(data.user_id);

    // reply allowed if logged in and depth limit not exceeded
    const canReply  = Number.isFinite(curId) && depth < 5;

    // delete allowed if author or admin
    const canDelete = Number.isFinite(curId) && (curId === author || isAdmin);

    const node = document.createElement('div');
    node.className = 'comment-container';
    node.dataset.commentId = String(data.comment_id);
    node.style.marginLeft = `${depth * INDENT}px`;

    node.innerHTML = `
        <div class="comment-header">
        <button class="avatar-wrapper"
                data-id="${data.user_id || ''}"
                data-username="${escapeHtml(data.username || '')}"
                data-display_name="${escapeHtml(data.display_name || '')}">
            <img class="avatar-inline" src="${avatarSrc}" alt="User Avatar">
        </button>
        <span class="username">
            <strong>${escapeHtml(data.display_name || data.username || 'Anonymous')}</strong>
            <span class="timestamp" data-timestamp="${ts}"></span>
        </span>
        </div>

        <div class="comment-content" data-comment-id="${String(data.comment_id)}">
            ${contentHTML}
        </div>

        <div class="comment-toolbar" data-comment-id="${String(data.comment_id)}">
            <!-- Unicode reactions button -->
            <button type="button" class="emoji-button" id="unicode-emoji-button" data-emoji-type="unicode"">
                <img class=" icon" src="media/icons/emoji.png" alt="emoji.png">
            </button>

            <!-- Custom reactions button -->
            <button type="button" class="emoji-button" id="custom-emoji-button" data-emoji-type="custom">🐱</button>
            <div class="custom-wrapper" id="custom-emoji-wrapper" style="display: none;">
                <!-- JS will inject emoji drawer below -->
            </div>
            ${canReply ? `<button class="newsfeed-button reply-toggle">Reply</button>` : ''}
            ${canDelete ? `
            <form method="POST" action="/delete_comment/${data.comment_id}" class="delete-form">
            <input type="hidden" name="csrf_token" value="${window.csrfToken || ''}">
            <button type="submit" class="delete-button" onclick="return confirm('Delete this comment?')">Delete</button>
            </form>` : ''}
        </div>
    `;
    attachReplyToggle(node, data.article_id, data.comment_id);

    // insert: append for top-level; for replies, insert after parent's subtree
    if (!data.parent_id) {
        thread.appendChild(node);
    } else {
        const parent = thread.querySelector(`.comment-container[data-comment-id="${data.parent_id}"]`);
        if (!parent) thread.appendChild(node);
        else {
        const parentDepthPx = parseInt(parent.style.marginLeft || '0', 10) || 0;
        let after = parent, cur = parent.nextElementSibling;
        while (cur && cur.classList?.contains('comment-container') &&
                (parseInt(cur.style.marginLeft || '0', 10) || 0) > parentDepthPx) {
            after = cur; cur = cur.nextElementSibling;
        }
        after.after(node);
        }
    }

    if (typeof formatTimestamp === 'function') formatTimestamp(node);
    // Re-init any per-node behaviors for the new toolbar/avatar:
    if (typeof initEmojiToolbar === 'function') initEmojiToolbar(node);
    if (typeof wireAvatarPopups === 'function') wireAvatarPopups(node);
    }

    function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function attachReplyToggle(node, articleId, commentId) {
  const btn = node.querySelector('.reply-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    let drawer = node.querySelector('.reply-drawer');
    if (!drawer) {
      drawer = buildReplyDrawer(commentId, articleId);   // input UI only
      node.appendChild(drawer);
    }
    drawer.style.display = drawer.style.display === 'block' ? 'none' : 'block';
  });
}


function buildReplyDrawer(parentId, articleId) {
  const el = document.createElement('div');
  el.className = 'reply-drawer';
  el.style.display = 'none';
  el.innerHTML = `
    <form class="reply-form" data-article-id="${articleId}">
        <input type="hidden" name="csrf_token" value="${window.csrfToken || ''}">
        <input type="hidden" name="parent_id" value="${parentId}">
        <div class="comment-box">
            <div class="comment-editor" contenteditable="true" placeholder="Write a reply…"></div>
            <input type="hidden" name="comment-content" class="hidden-content">
      
            <button type="button" class="emoji-button" id="unicode-emoji-button" data-emoji-type="unicode">
                <img class="icon" src="/media/icons/emoji.png" alt="emoji">
            </button>
            <div class="emoji-wrapper" id="unicode-wrapper-input" style="display: none;">
                <emoji-picker></emoji-picker>
            </div>
            <button type="button" class="emoji-button" id="custom-emoji-button" data-emoji-type="custom">🐱</button>
                <div class="custom-wrapper" id="custom-emoji-wrapper" style="display:none;"></div>
            </button>
            <button type="button" class="upload-button">📎 </button>
            <input type="file" class="file-input" style="display: none;" />
            <div class="submit-cancel">
                <button type="submit" class="newsfeed-button">Submit</button>
                <button type="button" class="newsfeed-button cancel-reply">Cancel</button>
            </div>
        </div>
    </form>`;
    wireUpload(el); 
    wireReplyForm(el);
    if (typeof initEmojiToolbar === 'function') initEmojiToolbar(el);
    return el;
}

function wireReplyForm(scope) {
  const form   = scope.querySelector('.reply-form');
  const editor = form.querySelector('.comment-editor');
  const hidden = form.querySelector('input[name="comment-content"]');
  const cancel = form.querySelector('.cancel-reply');

  cancel.addEventListener('click', () => { editor.innerHTML = ''; scope.style.display = 'none'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // only run image uploads if there are non-emoji data URIs
    await maybeHandleBase64Images(editor);

    hidden.value = editor.innerHTML;
    const fd = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn?.setAttribute('disabled', 'disabled');

    try {
      const articleId = form.dataset.articleId;
      const res = await fetch(`/comment/${articleId}`, {
        method: 'POST',
        headers: { 'X-CSRFToken': window.csrfToken || '' },
        body: fd
      });
      const data = await res.json();
      if (!data.ok) return;

      // optional optimistic render:
      // renderNewsComment({ ...data, parent_id: Number(fd.get('parent_id')) });

      editor.innerHTML = '';
      scope.style.display = 'none';
    } finally {
      submitBtn?.removeAttribute('disabled');
    }
  });
}

function wireUpload(scope) {
    if (!scope || scope.dataset.uploadWired) return; // guard against double wiring
    const editor       = scope.querySelector(".comment-editor");
    const fileInput    = scope.querySelector(".file-input");
    const uploadButton = scope.querySelector(".upload-button");
    if (!(editor && fileInput && uploadButton)) return;

    scope.dataset.uploadWired = "1";

    uploadButton.addEventListener("click", (e) => {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file || !file.type.startsWith("image/")) return;

        const formData = new FormData();
        formData.append("file", file);

    try {
        const res  = await fetch("/news/upload_news_image", {
            method: "POST",
            headers: window.csrfToken ? { "X-CSRFToken": window.csrfToken } : undefined,
            body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

        const img = document.createElement("img");
        img.src = data.url;
        img.alt = file.name;
        img.className = "uploaded-image";
        insertNodeAtCursor(editor, img);

        fileInput.value = "";
    } catch (err) {
      console.error("Upload failed:", err);
      showToast(err.message || "Upload error");
    }
  });
}

function maybeHandleBase64Images(editor) {
  // only run handler if there’s at least one non-emoji data URI
  const imgs = editor.querySelectorAll('img:not(.inline-emoji)');
  if ([...imgs].some(img => (img.src || '').startsWith('data:image/'))) {
    console.log('handleBase64Images triggered');
    return handleBase64Images(editor);
  }
  return Promise.resolve();
}

function unicodeEmojiDrawer(box) {
    console.log('unicodeEmojiDrawer: box: ', box)
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
    console.log('unicodeReactionDrawer picker: ', picker);
    let wrapper = document.querySelector("#unicode-wrapper-reaction");
    console.log('unicodeReactionDrawer wrapper: ', wrapper);
    picker.dataset.commentId = toolbar.closest(".comment-container").dataset.commentId;


    if (!toolbar.contains(wrapper)) {
        toolbar.appendChild(wrapper);
    }

    // Set current target for emoji insert
    activeCommentContent = toolbar.parentElement.querySelector(".comment-content");

    wrapper.classList.toggle("visible");

    if (!picker.dataset.bound) {
        picker.addEventListener("emoji-click", (e) => {
            const commentId = picker.closest('.comment-container')?.dataset.commentId;

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
    console.log('reply-toggle triggered')
    button.addEventListener('click', () => {
        const wrapper = button.closest('.comment-container');
        const drawer = wrapper.querySelector('.reply-drawer');
        console.log('reply-toggle | ', 'wrapper ', wrapper, '| drawer ', drawer)
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

    // Create a text node for the emoji
    const node = document.createTextNode(text);
    editable.appendChild(node);

    // Move caret after the inserted text
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false); // false = move to end

    const sel = window.getSelection();
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
