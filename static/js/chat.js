// chat.js

window.chatEditor = document.getElementById("chat-editor");
let isInitialLoad = true;

document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("send-button");
    const uploadButton = document.getElementById("upload-button");
    const fileInput = document.getElementById("file-input");
    const chatContainer = document.querySelector("#chat-container");
    if (!chatContainer) {
        console.error("❌ #chat-container not found in DOM");
        return;
    }
    
    if (!chatEditor) {
        console.error("❌ chatEditor not found in DOM");
        return;
    }

    if (typeof window.initChatSocket === "function") {
        window.initChatSocket();
    }

    let lastScrollTop = chatContainer.scrollTop;

    chatContainer.addEventListener("scroll", () => {
        const currentScrollTop = chatContainer.scrollTop;

        const isScrollingUp = currentScrollTop < lastScrollTop;

        if (isScrollingUp && currentScrollTop <= 5 && !isLoading) {
            console.log("⬆ Triggered load from top scroll.");
            loadMessages(earliestMessageId, true);
        }

        lastScrollTop = currentScrollTop;
    });

    loadMessages();

    if (!fileInput || !uploadButton) {
        console.error("Missing fileInput or uploadButton");
        return;
    }

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

    fetch("/chat/upload_chat_image", {
        method: "POST",
        body: formData,
    })
        .then(async res => {
            const data = await res.json();
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
            alert(err.message || "A network error occurred while uploading.");
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
                    "Content-Type": "application/json"
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
                } else {
                    console.error("Error sending message:", data.error);
                }
            });
        }
    });

    chatEditor.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // Prevent newline
            sendButton.click(); // Trigger the click event on send button
        }
    });
});

function renderUrlPreview(msgElement, data) {
    const preview = document.createElement("div");
    preview.className = "url-preview";

    if (data.embed_html) {
        preview.innerHTML = data.embed_html;
        msgElement.appendChild(preview);
        return;
    }

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

    msgElement.appendChild(preview);
}  

function deleteMessage(messageId) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    fetch(`/chat/delete_message/${messageId}`, {
        method: "DELETE",
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

window.appendMessage = function(user_id, username, displayName, text, messageId, avatar, bio, timestamp, prepend=false) {
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
        ` : `<div class="avatar-placeholder"></div>`;

    msg.innerHTML = `
        <div class="chat-header">
            ${avatarImg}
            <strong>${displayName || username}</strong>
        </div>
        <div class="message-body">${text}</div>
        <div class="chat-toolbar">
            <span class="timestamp" data-timestamp="${timestamp}Z"></span>
            <button class="reply-button">Reply</button>
            <button class="delete-btn">🗑️ Delete</button>
        </div>
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

    // Scroll to bottom only on initial load
    if (isInitialLoad) {
        scrollChatToBottom();
        isInitialLoad = false;
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
            // Clear and optionally collapse drawer
            replyInput.value = '';
            replyDrawer.style.display = 'none';

            // TODO: Send replyText to backend here
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

    msg.querySelector(".delete-btn").addEventListener("click", () => {
        deleteMessage(messageId);
    });

    formatTimestamp();
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return (msg);
}

let isLoading = false;
let earliestMessageId = null;
const renderedMessageIds = new Set();

function loadMessages(beforeId = null, prepend=false) {
    if (isLoading) return;
    isLoading = true;

    let url = "/chat/get_messages?limit=10";
    if (beforeId) {
        url += `&before_id=${beforeId}`;
    }
    if (prepend) {
        url += `&prepend=true`;
    }
    console.log("Fetching messages with beforeId =", beforeId);

    fetch(url)
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

                let topMessageId = null;
                let topOffset = 0;

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
                // Restore scroll position relative to the previously top message
                if (topMessageId && newMessages.length > 0) {
                    const newTopMessage = chatMessages.querySelector(`[data-message-id="${topMessageId}"]`);
                    if (newTopMessage) {
                        const newOffset = newTopMessage.getBoundingClientRect().top;
                        container.scrollTop += (newOffset - topOffset);
                    }
                }
            }

            console.log("IDs of received messages:", messages.map(m => m.id));
            console.log("New (unrendered) messages count:", newMessages.length);

            if (!beforeId && isAtBottom()) scrollChatToBottom();
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
    console.log("⏱️ Fallback scroll to bottom:", container.scrollTop); }, 1500);
}

function isAtBottom() {
    const container = document.getElementById("chat-container");
    return container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
}
