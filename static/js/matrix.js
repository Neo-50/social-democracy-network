// matrix.js

const customEmojis = ['gir-cool.webp', 'gir-hyper.webp', 'gir-stare.webp', 'gir-flat.webp', 'gir-suit.png', 'gir-happy.png', 'zimthonk.png',
    'pepe-yes.png', 'pepe-no.png', 'hmm.png', 'peepo-ban.png', 'peepo-cute.png', 'peepo-happy.png', 'peepo-heart.png',
    'pepe-clown.png', 'pepe-copium.png', 'pepe-cringe.png', 'pepe-cry.png', 'pepe-dumb.png', 'pepe-evil.png', 'pepe-ez.png',
    'pepe-fu.png', 'pepe-giggle.png', 'pepe-gun.png', 'pepe-happy.png', 'pepe-holy.png', 'pepe-megacringe.png', 'pepe-nervous.png',
    'pepe-noted.png', 'pepe-nuke.png', 'pepe-ok-boomer.png', 'pepe-omg.png', 'pepe-poggers.png', 'pepe-popcorn.png',
    'pepe-pray.png', 'pepe-rage.png', 'pepe-sadclown.png', 'pepe-sadge.png', 'pepe-sad-hands.png', 'pepe-salute.png', 'pepe-shades.png',
    'pepe-sip.png', 'pepe-sword.png', 'pepe-teddy-cry.png', 'pepe-think.png', 'pepe-wait.png', 'peepo-rifle.png', 'pepe-angery.png',
    'peepo-blush.png', 'peepo-sip.png', 'peepo-sit.png', 'peepo-think.png', 'pepe-angry-police.png', 'pepe-angry-scimter.png',
    'pepe-bigsmile.png', 'pepe-blankie.png', 'pepe-blubbers.png', 'pepe-chat-dead.png', 'pepe-cheer.gif', 'pepe-chef.png', 'pepe-depressed.png',
    'pepe-fightme.png', 'pepe-flower.png', 'pepe-heart02.png', 'pepe-hug.png', 'pepe-nerd.gif', 'pepe-pirate.png', 'pepe-pitchfork.png',
    'pepe-police.png', 'pepe-sleep.png', 'pepe-ukraine.png', 'pepe-wizard.png', 'pepe-yep.png', 'pepe-yikes.png',
    'catblip.webp', 'catblush.webp', 'catclap.webp', 'catcool.webp', 'catcry.webp', 'catcry2.webp', 'catcry3.webp', 'catcry4.webp', 'catcry5.webp',
    'catdance.webp', 'catjam.webp', 'catjam2.webp', 'catno.webp', 'catpolice.webp', 'catrave.webp', 'catsadge.png', 'catshake.webp',
    'catstare.webp', 'catthumbsup.webp', 'cattocry.webp', 'cat_cry.webp', 'close.webp', 'clowncat.webp', 'meowyey.webp', 'nekocatsip.webp',
    'polite.webp', 'politecri.png', 'red_angry.png', 'sadcat.png', 'sadcat.webp', 'smudge.png', 'typingcat.webp', 'yellcat.webp'];

document.addEventListener("DOMContentLoaded", () => {
    const chatEditor = document.getElementById("chat-editor");
    const sendButton = document.getElementById("send-button");
    const uploadButton = document.getElementById("upload-button");
    const fileInput = document.getElementById("file-input");
    const unicodeEmojiButton = document.getElementById("unicode-emoji-button");
    const unicodeEmojiWrapper = document.getElementById("unicode-emoji-wrapper");
    const customEmojiButton = document.getElementById("custom-emoji-button");

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

    fetch("/matrix/upload_chat_image", {
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
    
    function extractUrls(text) {
        return [...text.matchAll(/https?:\/\/[^\s<>"']+/g)].map(m => m[0]);
    }

    window.addEventListener("DOMContentLoaded", () => {
        fetch("/matrix/get_messages")
            .then(res => res.json())
            .then(messages => {
            messages.forEach(msg => {
                appendMessage(
                msg.username,
                msg.display_name,
                msg.content,
                msg.id,
                msg.avatar,
                msg.bio,
                msg.timestamp
                );
            });

            scrollToBottomAfterMessagesLoad();

        })
        .catch(err => {
        console.error("Failed to load messages:", err);
        });
    });


    function appendMessage(username, displayName, text, messageId = null, avatar, bio, timestamp) {
        const chatMessages = document.getElementById("chat-messages");
        const msg = document.createElement("div");
        msg.className = "chat-message";

        if (messageId) {
            msg.dataset.messageId = messageId;
        }

        const avatarImg = avatar ? `
            <button class="avatar-wrapper"
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
            <div class="message-body"></div>
            <div class="chat-toolbar">
                <span class="comment-timestamp" data-timestamp="${timestamp}Z"></span>
                <button class="reply-button">Reply</button>
                <button class="delete-btn">🗑️ Delete</button>
            </div>
            <div class="reply-drawer" style="display: none;">
                <input class="reply-input" type="text" placeholder="Type a reply..." />
                <button class="reply-submit">Send</button>
                <button class="reply-cancel">Cancel</button>
            </div>
        `;

        scrollToBottomAfterMessagesLoad();

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

        msg.querySelector(".message-body").innerHTML = text;

        msg.querySelector(".delete-btn").addEventListener("click", () => {
            deleteMessage(messageId);
        });

        chatMessages.appendChild(msg);
        formatTimestamp();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // toggle unicode emoji drawer
    unicodeEmojiButton.addEventListener("click", () => {
        unicodeEmojiWrapper.style.display =
            unicodeEmojiWrapper.style.display === "none" ? "block" : "none";
    });

    // handle unicode emoji selection
    document.addEventListener("emoji-click", (e) => {
        const emoji = e.detail.unicode;
        insertAtCursor(chatEditor, emoji);
    });

    // toggle custom emoji drawer
    customEmojiButton.addEventListener("click", () => {
        const wrapper = document.getElementById("custom-emoji-wrapper");
        if (!wrapper) return;

        if (wrapper.style.display === "none" || wrapper.style.display === "") {
            wrapper.style.display = "flex";  // show
            initializeEmojiDrawer(wrapper);
        } else {
            wrapper.style.display = "none";  // hide
        }
    });

    // send message
    sendButton.addEventListener("click", () => {
        const message = chatEditor.innerHTML.trim();
        if (message !== "") {
            fetch("/matrix/send", {
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
                    const msg = data.message;
                    appendMessage(
                        msg.username,
                        msg.display_name,
                        msg.content,
                        msg.id,
                        msg.avatar,
                        msg.bio,
                        msg.timestamp
                    );
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

    // helpers
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
});

document.addEventListener("click", (e) => {
    const unicodeWrapper = document.getElementById("unicode-emoji-wrapper");
    const customWrapper = document.getElementById("custom-emoji-wrapper");

    const isEmojiButton =
        e.target.closest("#unicode-emoji-button") ||
        e.target.closest("#custom-emoji-button");

    const isInUnicodeWrapper = e.target.closest("#unicode-emoji-wrapper");
    const isInCustomWrapper = e.target.closest("#custom-emoji-wrapper");

    if (!isEmojiButton && !isInUnicodeWrapper && !isInCustomWrapper) {
        if (unicodeWrapper) unicodeWrapper.style.display = "none";
        if (customWrapper) customWrapper.style.display = "none";
    }
    });

function initializeEmojiDrawer(wrapper) {
    // clear existing drawer
    const existingDrawer = wrapper.querySelector('.custom-emoji-drawer');
    if (existingDrawer) {
        existingDrawer.remove();
    }
    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';
    drawer.style.marginTop = '10px';
    drawer.style.display = 'flex';
    drawer.style.flexWrap = 'wrap';
    drawer.style.gap = '6px';

    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'emoji-size-toggle';

    const smallBtn = document.createElement('button');
    smallBtn.textContent = 'Small';
    smallBtn.className = 'size-option active';
    smallBtn.type = 'button'; // prevent accidental submit

    const largeBtn = document.createElement('button');
    largeBtn.textContent = 'Large';
    largeBtn.className = 'size-option';
    largeBtn.type = 'button'; // prevent accidental submit

    toggleWrapper.appendChild(smallBtn);
    toggleWrapper.appendChild(largeBtn);
    drawer.appendChild(toggleWrapper);

    // Default size
    selectedEmojiSize = 28;

    // Click handlers
    smallBtn.addEventListener('click', () => {
        selectedEmojiSize = 28;
        smallBtn.classList.add('active');
        largeBtn.classList.remove('active');
        updateDrawerEmojiSizes(drawer);
    });

    largeBtn.addEventListener('click', () => {
        selectedEmojiSize = 50;
        largeBtn.classList.add('active');
        smallBtn.classList.remove('active');
        updateDrawerEmojiSizes(drawer);
    });

    customEmojis.forEach(filename => {
        const img = document.createElement('img');
        img.src = `media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
        img.style.cursor = 'pointer';

        img.setAttribute(
            'style',
            `width:${selectedEmojiSize}px;height:${selectedEmojiSize}px;vertical-align:middle;`
        );

        img.addEventListener('click', () => {
            const editor = document.getElementById("chat-editor");
            if (editor) {
                // **ALWAYS** focus the editor first
                editor.focus();

                // place caret at the end if nothing selected
                placeCaretAtEnd(editor);

                const emoji = document.createElement('img');
                emoji.src = `media/emojis/${filename}`;
                emoji.alt = filename.split('.')[0];
                emoji.className = 'inline-emoji';
                emoji.style.width = `${selectedEmojiSize}px`;
                emoji.style.height = `${selectedEmojiSize}px`;
                emoji.style.verticalAlign = 'middle';

                insertAtCaret(emoji);
            }
        });

        drawer.appendChild(img);
    });

    wrapper.appendChild(drawer);
}

function toggleCustomEmojiDrawer() {
    const wrapper = document.querySelector('.custom-emoji-wrapper');
    const drawer = wrapper.querySelector('.custom-emoji-drawer');

    // If drawer doesn't exist yet, create it
    if (!drawer) {
        wrapper.style.display = 'flex';
        initializeEmojiDrawer(wrapper);
    } else {
        wrapper.style.display = wrapper.style.display === 'none' ? 'flex' : 'none';
    }
}

function updateDrawerEmojiSizes(drawer) {
    drawer.querySelectorAll('.custom-emoji').forEach(img => {
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
    });
}

function insertAtCaret(node) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
}

function placeCaretAtEnd(el) {
    el.focus();
    if (
        typeof window.getSelection != "undefined"
        && typeof document.createRange != "undefined"
    ) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function insertNodeAtCursor(editable, node) {
    editable.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    // Optional: move cursor after inserted node
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
}

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

    fetch(`/matrix/delete_message/${messageId}`, {
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

function scrollToBottomAfterMessagesLoad() {
  const chatContainer = document.querySelector(".chat-container");
  const lastMsg = document.querySelector("#chat-messages .chat-message:last-child");
  if (!chatContainer || !lastMsg) return;

  // Observe last message size/layout changes
  const resizeObserver = new ResizeObserver(() => {
    resizeObserver.disconnect();

    // Double RAF ensures DOM updates settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
        console.log("✅ Scrolled .chat-container to bottom:", chatContainer.scrollTop);
      });
    });

    // Backup safety scroll after 100ms in case layout delays
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      console.log("🕒 Fallback scroll .chat-container to bottom:", chatContainer.scrollTop);
    }, 100);
  });

  resizeObserver.observe(lastMsg);
}

