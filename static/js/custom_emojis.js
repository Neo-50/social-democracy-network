let selectedEmojiSize = 28;

document.addEventListener("click", (e) => {
    const unicodeWrapper = document.getElementById("unicode-emoji-wrapper");
    const customWrapper = document.getElementById("custom-emoji-wrapper");

    const isEmojiButton =
        e.target.closest(".unicode-emoji-button") ||
        e.target.closest(".custom-emoji-button");

    const isInUnicodeWrapper = e.target.closest("#unicode-emoji-wrapper");
    const isInCustomWrapper = e.target.closest("#custom-emoji-wrapper");

    if (!isEmojiButton && !isInUnicodeWrapper && !isInCustomWrapper) {
        if (unicodeWrapper) unicodeWrapper.style.display = "none";
        if (customWrapper) customWrapper.style.display = "none";
    }
});

function renderCustomEmojisToDrawer(drawer, opts) {
    // Support old calls: renderCustomEmojisToDrawer(drawer, target)
    const options = (opts instanceof Element || opts === null || opts === undefined)
        ? { target: opts }
        : (opts || {});

    const {
        target,                      // Element or null
        target_id = null,            // For reactions
        targetType = 'news',         // For reactions
        size = selectedEmojiSize,    // Thumb & inserted emoji size
    } = options;

    customEmojis.forEach((filename) => {
        const img = document.createElement('img');
        img.src = `media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.cursor = 'pointer';
        img.setAttribute('style', `width:${size}px;height:${size}px;vertical-align:middle;`);

        img.addEventListener('click', () => {
            // --- comment editor path ---
            if (target?.matches?.('.comment-editor')) {
                const emojiNode = document.createElement('img');
                emojiNode.src = img.src;
                emojiNode.className = 'custom-emoji-reaction';
                emojiNode.alt = filename.split('.')[0];
                emojiNode.style.width = `${size}px`;
                emojiNode.style.height = `${size}px`;
                emojiNode.style.verticalAlign = 'middle';
                insertCustomEmoji(target, emojiNode);
                return;
            }

            // --- reaction drawer path ---
            window.renderReaction({
                target,
                target_id,
                targetType,
                emoji: filename,
                user_id: window.CURRENT_USER_ID,
                user_ids: [window.CURRENT_USER_ID],
                mode: 'insert',
                emit: true,
            });
        });

        drawer.appendChild(img);
    });
}


function sizeButtonHelper(drawer) {
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
}

function updateDrawerEmojiSizes(drawer) {
    drawer.querySelectorAll('.custom-emoji').forEach(img => {
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
    });
}

function insertCustomEmoji(editor, node) {
    editor.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        console.warn("No selection available, placing at end instead.");
        editor.appendChild(node);
        return;
    }

    const range = sel.getRangeAt(0);

    // ensure caret is actually inside this editor
    if (!editor.contains(range.startContainer)) {
        console.warn("Selection not in this editor, placing at end.");
        editor.appendChild(node);
        placeCaretAtEnd(editor);
        return;
    }

    // insert
    range.insertNode(node);

    // move caret after the inserted emoji
    range.setStartAfter(node);
    range.collapse(true);

    // restore selection
    sel.removeAllRanges();
    sel.addRange(range);
}
