// chat.js

window.chatEditor = document.getElementById("chat-editor");
window.csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
let isLoading = false;
let earliestMessageId = null;
const renderedMessageIds = new Set();

document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("send-button");
    const uploadButton = document.getElementById("upload-button");
    const fileInput = document.getElementById("file-input");
    const chatContainer = document.querySelector("#chat-container");

    console.log('**Chat Loaded** sendButton: ', sendButton, '| uploadButton: ', uploadButton,
        ' | fileInput', fileInput, 'chatContainer: ', chatContainer, 'chatEditor: ', chatEditor);

    if (typeof window.initChatSocket === "function") {
        window.initChatSocket();
    }

    if (typeof window.initReactionSocket === "function") {
        window.initReactionSocket("chat");
    }

    emojiChatDrawerListeners();

    chatContainer.addEventListener("scroll", () => {
        const currentScrollTop = chatContainer.scrollTop;

        if (currentScrollTop <= 500 && !isLoading) {
            // console.log("⬆️ Triggered load from top scroll.");
            loadMessages(earliestMessageId, true);
            renderAllReactions();
        }
    });

    // file upload
    uploadButton.addEventListener("click", () => {
        fileInput.click();
    });
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Only image files are allowed.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        formData.append("csrf_token", window.csrfToken);

        fetch("/chat/upload_chat_image", {
            method: "POST",
            headers: { 'X-CSRFToken': window.csrfToken },
            body: formData,
        })

            .then(async res => {
                let data;
                try {
                    data = await res.json();
                } catch {
                    const text = await res.text();
                    throw new Error(text || "Upload failed.");
                }

                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Upload failed.");
                }

                return data;
            })

            .then(data => {
                const img = document.createElement("img");
                img.src = data.url;
                img.alt = file.name;
                img.style.maxWidth = "450px";
                img.style.maxHeight = "450px";
                img.style.height = "auto";
                img.style.width = "auto";
                img.style.borderRadius = "24px";
                insertNodeAtCursor(chatEditor, img);
            })
            .catch(err => {
                console.error("Upload error:", err);
                showToast(err.message || "A network error occurred while uploading.");
            });
    });

    // Button to scroll to the bottom of the feed
    const scrollBtn = document.getElementById('scroll-to-bottom-btn');
    const container = document.querySelector('.chat-container');

    // Show button only if not in the most recent 20%
    container.addEventListener('scroll', () => {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const showBtn = distanceFromBottom > container.scrollHeight * 0.2;

        scrollBtn.style.display = showBtn ? 'block' : 'none';
    });

    // Click button to scroll using your existing function
    scrollBtn.addEventListener('click', scrollChatToBottom);

    // send message
    sendButton.addEventListener("click", () => {
        const message = chatEditor.innerHTML.trim();
        if (message !== "") {
            fetch("/chat/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": window.csrfToken
                },
                body: JSON.stringify({
                    content: message,
                    message_type: "text"
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        chatEditor.innerHTML = "";
                        scrollChatToBottom();
                    } else {
                        console.error("Error sending message:", data.error);
                    }
                });
        }
    });

    chatEditor.addEventListener('paste', async (e) => {
        const cd = e.clipboardData || window.clipboardData;
		if (!cd) return;
        // If an image file is on the clipboard, upload it directly
        for (const it of cd.items || []) {
            if (it.type && it.type.startsWith('image/')) {
                e.preventDefault(); // stop base64 <img> from being inserted
                const file = it.getAsFile();
                if (!file) return;

                const fd = new FormData();
                fd.append('file', file, file.name || 'pasted-image.png');

                try {
                    const res = await fetch('/chat/upload_chat_image', {
                        method: 'POST',
                        headers: { 'X-CSRFToken': window.csrfToken },
                        body: fd,
                        credentials: 'same-origin',
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success || !data.url) {
                        throw new Error(data.error || `HTTP ${res.status}`);
                    }
                    const img = document.createElement('img');
                    img.src = data.url;
                    img.className = 'uploaded-image';
                    insertNodeAtCursor(chatEditor, img);
                } catch (err) {
                    console.error('Paste upload failed:', err);
                    showToast(`Failed to upload pasted image: ${String(err.message || err)}`);
                }
                return; // handled the image paste
            }
        }

        // No image file on clipboard: let normal paste happen,
        // then convert any data-URI images the browser inserted.
        setTimeout(() => maybeHandleBase64Images(chatEditor), 0);
    });

    chatEditor.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // Prevent newline
            sendButton.click(); // Trigger the click event on send button
        }
    });
});

function maybeHandleBase64Images(editor) {
  // only run handler if there’s at least one non-emoji data URI
  const imgs = editor.querySelectorAll('img:not(.emoji-reaction):not(.unicode-reaction)');
  if ([...imgs].some(img => (img.src || '').startsWith('data:image/'))) {
    console.log('handleBase64Images triggered');
    return handleBase64Images(editor);
  }
  return Promise.resolve();
}

// --- embed scroll helper (define once) ---
if (!window.notifyEmbedRendered) {
  window.notifyEmbedRendered = (() => {
    let scheduled = false;
    return function notifyEmbedRendered() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (typeof window.scrollWhenStable === 'function') {
          // quick settle to catch late iframe size changes
          scrollWhenStable({ maxMs: 1200, settleMs: 200, checkMs: 80, force: true });
        } else if (typeof window.scrollChatToBottom === 'function') {
          // fall back to your existing scroll helper
          scrollChatToBottom();
          setTimeout(scrollChatToBottom, 300);
        }
      });
    };
  })();
}


function scrollWhenStable(maxMs = 6000, settleMs = 400, checkMs = 100) {
    const el = document.querySelector('.chat-container');
    if (!el) return;

    let last = -1, stableFor = 0;
    const i = setInterval(() => {
    const h = el.scrollHeight;
    stableFor = (h === last) ? stableFor + checkMs : 0;
    last = h;

    if (stableFor >= settleMs) { clearInterval(i); scrollChatToBottom(true); }
    }, checkMs);

    setTimeout(() => { clearInterval(i); scrollChatToBottom(true); }, maxMs);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadMessages();
    renderAllReactions();
    scrollWhenStable();
});

function renderAllReactions() {
    console.log('Pull data and render reactions');
    for (const [key, reactions] of Object.entries(window.reactionMap)) {
        const target_id = key.split(':')[1]; // Extract numeric ID from "news:{id}"
        const reactionsContainer = document.querySelector(`.chat-message[data-message-id="${target_id}"] .reactions-container`);
        console.log('***reactionsContainer***', reactionsContainer);
        if (!reactionsContainer) continue;
        reactions.forEach(({ emoji, user_ids, target_id }) => {
            console.log('Chat DOMContentLoaded: ', 'emoji: ', emoji, '| target_type: ', 
                "chat", ' | user_ids: ', user_ids, ' | target_id: ', target_id);
            window.renderReaction({
                target: reactionsContainer,
                emoji,
                target_id,
                target_type: "chat",
                user_ids,
                mode: 'load'
            });
        });
    }
}

function deleteMessage(messageId) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    fetch(`/chat/delete_message/${messageId}`, {
        method: "DELETE",
        headers: {
            "X-CSRFToken": window.csrfToken,
        },
    })
        .then(res => {
            if (res.ok) {
                const msgEl = document.querySelector(`.chat-message[data-message-id="${messageId}"]`);
                if (msgEl) msgEl.remove();
            } else {
                alert("Failed to delete message");
            }
        })
        .catch(err => {
            console.error("Delete failed:", err);
            alert("Error occurred while deleting message");
        });
}

window.appendMessage = function (user_id, username, displayName, text, messageId, avatar, bio, timestamp, prepend = false) {
    console.log("appendMessage called:", { user_id, username, displayName, text });
    const chatMessages = document.getElementById("chat-messages");
    const msg = document.createElement("div");
    msg.className = "chat-message";
    msg.dataset.messageId = messageId

    const avatarImg = avatar ? `
        <button class="avatar-wrapper"
            data-id="${user_id}"
            data-username="${username}"
            data-display_name="${displayName}"
            data-bio="${bio || 'No bio available'}"
            data-avatar="/media/avatars/${avatar}"
            onclick="showUserPopup(this)">
            <img src="/media/avatars/${avatar}" class="avatar" alt="avatar"
                style="width:50px; height:50px; border-radius:50%;">
        </button>
        ` : `<button class="avatar-wrapper"
            data-id="${user_id}"
            data-username="${username}"
            data-display_name="${displayName || ''}"
            data-bio="${bio || 'No bio available'}"
            data-avatar="/media/avatars/default_avatar.png"
            onclick="showUserPopup(this)">
            <img src="/media/avatars/default_avatar.png" class="avatar" alt="avatar" style="width:50px; height:50px; border-radius:50%;">
            </button>
            `

    const showDelete = Number(currentUser.id) === Number(user_id) || currentUser.is_admin === 'true';
    console.log("showDelete =", showDelete, "user_id =", user_id, "currentUser.id =", currentUser.id, "is_admin =", currentUser.is_admin);

    msg.innerHTML = `
        <div class="chat-header">
            ${avatarImg}
            <strong>${displayName || username}</strong>
            <span class="timestamp" data-timestamp="${timestamp}Z"></span>
        </div>
        <div class="chat-toolbar">
            <!-- Unicode reactions button -->
            <button type="button" class="unicode-emoji-button" data-emoji-type="unicode"">
                <img class=" icon" src="media/icons/emoji.png" alt="emoji.png">
            </button>
            <div class="unicode-wrapper-reaction">
                <emoji-picker></emoji-picker>
            </div>
            <!-- Custom reactions button -->
            <button type="button" class="custom-emoji-button" data-emoji-type="custom">🐱</button>
            <div class="custom-wrapper-reaction">
                <!-- JS will inject emoji drawer below -->
            </div>
            <button class="reply-button">Reply</button> 
            ${showDelete ? `<button class="delete-btn">🗑️ Delete</button>` : ''}
        </div>
        <div class="message-body">${text}</div>
        <div class="reply-drawer" style="display: none;">
            <input class="reply-input" type="text" placeholder="Type a reply..." />
            <button class="reply-submit">Send</button>
            <button class="reply-cancel">Cancel</button>
        </div>
    `;
    if (prepend) {
        console.log("Appending with prepend =", prepend);
        console.log("Current message ID:", messageId);
        chatMessages.insertBefore(msg, chatMessages.firstChild);
    } else {
        chatMessages.appendChild(msg);
        scrollChatToBottom();
    }

    console.log("🧱 Prepending?", prepend, "| chatMessages.childElementCount =", chatMessages.childElementCount);
    console.log("🔼 First child ID before insert:", chatMessages.firstChild?.dataset?.messageId);

    const replyBtn = msg.querySelector('.reply-button');
    const replyDrawer = msg.querySelector('.reply-drawer');

    replyBtn.addEventListener('click', () => {
        replyDrawer.style.display = replyDrawer.style.display === 'block' ? 'none' : 'block';
    });

    const replyInput = msg.querySelector('.reply-input');
    const replySubmit = msg.querySelector('.reply-submit');

    replySubmit.addEventListener('click', () => {
        const replyText = replyInput.value.trim();
        if (replyText) {
            console.log(`Reply to message ID ${messageId}:`, replyText);
            replyInput.value = '';
            replyDrawer.style.display = 'none';
        }
    });

    formatTimestamp();

    const urls = extractUrls(text).filter(url => {
        const isMedia = url.includes("/media/");
        const isImage = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(url);
        return !isMedia && !isImage; // YouTube links will pass through
    });

    urls.forEach(url => {
        fetch(`/api/url-preview?url=${encodeURIComponent(url)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    renderUrlPreview(msg, data);
                }
            })
            .catch(err => console.error("URL preview error:", err));
    });
    console.log("Setting text:", text);
    console.log("Target element:", msg.querySelector(".message-body"));

    msg.querySelector(".message-body").innerHTML = text;

    const deleteBtn = msg.querySelector(".delete-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
            deleteMessage(messageId);
        });
    }

    let reactionContainer = msg.querySelector('.url-preview');
    if (!reactionContainer) {
        preview = document.createElement('div');
        preview.className = 'reactions-container';
        replyDrawer.before(preview);
    }

    formatTimestamp();
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return (msg);
}

function extractTweetId(src) {
	const s = String(src || '');
	return (s.match(/(?:^|\/)(?:status|statuses)\/(\d+)(?:[/?#]|$)/)?.[1]
		|| s.match(/\/i\/status\/(\d+)(?:[/?#]|$)/)?.[1]
		|| null);
}

function ensureBlueskyRuntime() {
    if (window.bluesky?.scan) return Promise.resolve();
    return new Promise(res => {
        const s = document.createElement('script');
        s.src = 'https://embed.bsky.app/static/embed.js';
        s.async = true;
        s.onload = res;
        document.head.appendChild(s);
    });
}

function renderUrlPreview(msgElement, data) {
    const preview = document.createElement("div");
    preview.className = "url-preview";
    const messageBody = msgElement.querySelector('.message-body');

	let container = msgElement.querySelector('.url-previews');
	if (!container) {
		container = document.createElement('div');
		container.className = 'url-previews';
		messageBody.after(container);
	}

    console.log ('renderUrlPreview data.type: ', data.type);

    switch (data.type) {
        case 'youtube': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            wrap.dataset.url = data.url;
            wrap.innerHTML = data.embed_html || '';
            container.appendChild(wrap);
            return;
        }

        case 'x': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            wrap.dataset.url = data.url;			// use data.url (no undefined 'url')
            container.appendChild(wrap);

            const tweetId = data.tweet_id || extractTweetId(data.url) || extractTweetId(data.embed_html);

            window.whenTwitterReady().then(twt => {
                if (twt?.widgets?.createTweet && tweetId) {
                    twt.widgets.createTweet(tweetId, wrap, { theme: 'dark', dnt: true })
                        .catch(() => {						// only fallback on failure
                            wrap.innerHTML = data.embed_html || '';
                            twt.widgets.load?.(wrap);
                        });
                    return;									// <-- important: don’t run the fallback below
                }
                // Fallback path when we don’t have an id or the API is missing
                wrap.innerHTML = data.embed_html || '';
                twt?.widgets?.load?.(wrap);
            });

            setTimeout(() => {
                if (!wrap.querySelector('iframe')) {
                    wrap.innerHTML = `<a href="${data.url}" target="_blank" rel="noopener">View on X</a>`;
                }
            }, 1500);
            
            return;
        }
        
        case 'bluesky': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            container.appendChild(wrap);

            // 1) Put the oEmbed blockquote in the DOM (do NOT remove/replace it)
            wrap.innerHTML = data.embed_html || `<a href="${data.url}" target="_blank" rel="noopener">View on Bluesky</a>`;

            // 2) Ask Bluesky to scan just this node; it will create the iframe for you
            ensureBlueskyRuntime().then(() => {
                window.bluesky?.scan?.(wrap);
                window.notifyEmbedRendered?.();
            });

            return;
        }

        case 'card': {
            let formattedDate = "";
            if (data.published) {
                const date = new Date(data.published);
                if (!isNaN(date)) {
                    // Example: "July 9, 2025"
                    formattedDate = date.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }
            preview.innerHTML = `
                <div class="preview-container">
                    <div class="preview-container-inner">
                        <a href="${data.url}" target="_blank" class="preview-link">
                            <div class="preview-title">${data.title || data.url}</div>
                            ${data.image_url ? `<img src="${data.image_url}" class="preview-image">` : ""}
                        </a>
                        ${data.description ? `<div><span class="article-info description"></span> ${data.description}</div>` : ""}
                        ${data.source ? `<div><span class="article-info source"></span> ${data.source}</div>` : ""}
                        ${formattedDate ? `<div><span class="article-info published"></span> ${formattedDate}</div>` : ""}
                        ${data.authors ? `<div><span class="article-info authors"></span> ${data.authors}</div>` : ""}
                        ${data.category ? `<div><span class="article-info category"></span> ${data.category}</div>` : ""}
                    </div>
                </div>
            `;
            messageBody.after(preview);
        }
    }
}

    // if (data.embed_html) {
    //     preview.innerHTML = data.embed_html;
    //     messageBody.after(preview);
    //     return;
    // }

function loadMessages(beforeId = null, prepend = false) {
    if (isLoading) return;
    isLoading = true;

    let topMessageId = null;
    let topOffset = 0;

    let url = "/chat/get_messages?limit=10";
    if (beforeId) {
        url += `&before_id=${beforeId}`;
    }
    if (prepend) {
        url += `&prepend=true`;
    }
    // console.log("Fetching messages with beforeId =", beforeId);

    return fetch(url)
        .then(res => res.json())
        .then(messages => {
            const newMessages = [];

            // Set earliestMessageId only when prepending
            if (prepend && messages.length > 0) {
                const minId = Math.min(...messages.map(m => m.id));
                if (earliestMessageId === null || minId < earliestMessageId) {
                    console.log("🕒 Updating earliestMessageId to", minId);
                    earliestMessageId = minId;
                }
            }

            if (prepend) {
                const chatMessages = document.getElementById("chat-messages");
                const firstRealMessage = chatMessages.querySelector(".chat-message");

                if (firstRealMessage) {
                    topMessageId = firstRealMessage.dataset.id;
                    topOffset = firstRealMessage.getBoundingClientRect().top;
                }

                messages.sort((a, b) => a.id - b.id); // oldest to newest
                console.log("✅ fetch result (full array):", messages);

                for (let i = 0; i < messages.length; i++) {
                    const msg = messages[i];
                    console.log("Checking msg.id:", msg.id, "Already rendered?", renderedMessageIds.has(msg.id));
                    if (renderedMessageIds.has(msg.id)) continue;

                    console.log("Adding new msg to renderedMessageIds:", msg.id);
                    renderedMessageIds.add(msg.id);
                    newMessages.push(msg);

                    const msgEl = window.appendMessage(
                        msg.user_id,
                        msg.username,
                        msg.display_name,
                        msg.content,
                        msg.id,
                        msg.avatar,
                        msg.bio,
                        msg.timestamp,
                        true
                    );
                    console.log("Generated msgEl:", msgEl);

                    if (prepend) {
                        chatMessages.insertBefore(msgEl, firstRealMessage);
                    } else {
                        chatMessages.appendChild(msgEl);
                    }
                }
            }
            if (!prepend) {
                const container = document.getElementById("chat-container");
                const chatMessages = document.getElementById("chat-messages");
                firstRealMessage = chatMessages.querySelector(".chat-message");

                for (let i = 0; i < messages.length; i++) {
                    const msg = messages[i];
                    console.log("Checking msg.id:", msg.id, "Already rendered?", renderedMessageIds.has(msg.id));
                    if (renderedMessageIds.has(msg.id)) continue;

                    console.log("Adding new msg to renderedMessageIds:", msg.id);
                    renderedMessageIds.add(msg.id);
                    newMessages.push(msg);

                    const msgEl = window.appendMessage(
                        msg.user_id,
                        msg.username,
                        msg.display_name,
                        msg.content,
                        msg.id,
                        msg.avatar,
                        msg.bio,
                        msg.timestamp,
                        false  // ⬅️ not prepending
                    );
                    console.log("Generated msgEl:", msgEl);

                    chatMessages.appendChild(msgEl);
                }
                if (firstRealMessage) {
                    topMessageId = firstRealMessage.dataset.id;
                    topOffset = firstRealMessage.getBoundingClientRect().top;
                }
                // Restore scroll position relative to the previously top message
                if (topMessageId && newMessages.length > 0) {
                    const newTopMessage = chatMessages.querySelector(`[data-message-id="${topMessageId}"]`);
                    if (newTopMessage) {
                        const newOffset = newTopMessage.getBoundingClientRect().top;
                        container.scrollTop += (newOffset - topOffset);
                    }
                }
            }

            // console.log("IDs of received messages:", messages.map(m => m.id));
            // console.log("New (unrendered) messages count:", newMessages.length);

            // if (!beforeId && isAtBottom()) scrollChatToBottom();
        })
        .finally(() => {
            isLoading = false;
        });
}

function extractUrls(text) {
    if (typeof text !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    return [...text.matchAll(urlRegex)].map(m => m[0]);
}

function scrollChatToBottom() {
    const container = document.querySelector('.chat-container');
    if (!container) return;

    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        console.log("⬇️ Scrolled to bottom:", container.scrollTop);
    });

    // Double fallback in case layout isn't stable yet
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        console.log("⏱️ Fallback scroll to bottom:", container.scrollTop);
    }, 3000);
}

function isAtBottom() {
    const container = document.getElementById("chat-container");
    return container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
}