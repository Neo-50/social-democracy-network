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

    // Pull chat messages from DB and insert in chat-messages
        window.addEventListener("DOMContentLoaded", () => {
        fetch("/get_messages")
            .then(res => res.json())
            .then(messages => {
                messages.forEach(msg => {
                    appendMessage(msg.sender, msg.content, msg.id);
                });
            })
            .catch(err => {
                console.error("Failed to load messages:", err);
            });
    });

    function appendMessage(sender, text, messageId = null) {
        const chatMessages = document.getElementById("chat-messages");
        const msg = document.createElement("div");
        msg.className = "chat-message";

        if (messageId) {
            msg.dataset.messageId = messageId;
        }

        // Message content
        msg.innerHTML = `
            <strong>${sender}:</strong> <span class="message-body">${text}</span>
            <button class="delete-btn" onclick="deleteMessage(${messageId})">🗑️</button>
        `;

        chatMessages.appendChild(msg);
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
                    appendMessage("You", message, data.message_id);
                    chatEditor.innerHTML = "";
                } else {
                    console.error("Error sending message:", data.error);
                }
            });
        }
    });

    // file upload
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




