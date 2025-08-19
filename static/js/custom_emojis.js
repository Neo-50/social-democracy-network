function renderCustomEmojisToDrawer(drawer, opts) {
    console.log('**renderCustomEmojisToDrawer** drawer: ', drawer, ' | opts: ', opts);
    // Support old calls: renderCustomEmojisToDrawer(drawer, target)
    const options = (opts instanceof Element || opts === null || opts === undefined)
        ? { target: opts }
        : (opts || {});

    const {
        target,                      // Element or null
        target_id = null,            // For reactions
        target_type = 'news',         // For reactions
        size = window.selectedEmojiSize,    // Thumb & inserted emoji size
    } = options;

    customEmojis.forEach((filename) => {
        const img = document.createElement('img');
        img.src = `media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${window.selectedEmojiSize}px`;
        img.style.height = `${window.selectedEmojiSize}px`;
        img.style.cursor = 'pointer';
        img.setAttribute('style', `width:${window.selectedEmojiSize}px;height:${window.selectedEmojiSize}px;vertical-align:middle;`);

        img.addEventListener('click', () => {
            // --- comment editor path ---
            if (target?.matches?.('.comment-editor')) {
                const emojiNode = document.createElement('img');
                emojiNode.src = img.src;
                emojiNode.className = 'inline-emoji custom';
                emojiNode.alt = filename.split('.')[0];
                emojiNode.style.width = `${window.selectedEmojiSize}px`;
                emojiNode.style.height = `${window.selectedEmojiSize}px`;
                emojiNode.style.verticalAlign = 'middle';
                insertCustomEmoji(target, emojiNode);
                return;
            }

            // --- reaction drawer path ---
            window.renderReaction({
                target,
                target_id,
                target_type,
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

function customMessagesChatDrawer(wrapper) {
    console.log('initializeEmojiDrawer wrapper: ', wrapper);
    const existingDrawer = wrapper.querySelector('.custom-emoji-drawer');
    if (existingDrawer) {
        existingDrawer.remove();
    }
    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';

    sizeButtonHelper(drawer);

    customEmojis.forEach(filename => {
        const img = document.createElement('img');
        img.src = `/media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${window.selectedEmojiSize}px`;
        img.style.height = `${window.selectedEmojiSize}px`;
        img.style.cursor = 'pointer';

        img.setAttribute(
            'style',
            `width:${window.selectedEmojiSize}px;height:${window.selectedEmojiSize}px;vertical-align:middle;`
        );

        img.addEventListener('click', () => {
            const editor = document.getElementById("chat-editor");
            if (editor) {
                // **ALWAYS** focus the editor first
                editor.focus();

                // place caret at the end if nothing selected
                placeCaretAtEnd(editor);

                const emoji = document.createElement('img');
                emoji.src = `/media/emojis/${filename}`;
                emoji.alt = filename.split('.')[0];
                emoji.className = 'inline-emoji custom';
                emoji.style.width = `${window.selectedEmojiSize}px`;
                emoji.style.height = `${window.selectedEmojiSize}px`;
                emoji.style.verticalAlign = 'middle';

                insertAtCaret(emoji);
            }
        });

        drawer.appendChild(img);
    });

    wrapper.appendChild(drawer);
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
        window.selectedEmojiSize = 28;
        smallBtn.classList.add('active');
        largeBtn.classList.remove('active');
        updateDrawerEmojiSizes(drawer);
    });

    largeBtn.addEventListener('click', () => {
        window.selectedEmojiSize = 50;
        largeBtn.classList.add('active');
        smallBtn.classList.remove('active');
        updateDrawerEmojiSizes(drawer);
    });
}

function updateDrawerEmojiSizes(drawer) {
    drawer.querySelectorAll('.custom-emoji').forEach(img => {
        img.style.width = `${window.selectedEmojiSize}px`;
        img.style.height = `${window.selectedEmojiSize}px`;
    });
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
