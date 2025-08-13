document.addEventListener("DOMContentLoaded", () => {
    const chatButtons = document.getElementById("chat-buttons");
    const unicodeEmojiButton = chatButtons.querySelector('.unicode-emoji-button');
    const customEmojiButton = chatButtons.querySelector('.custom-emoji-button');
    const unicodeEmojiWrapper = chatButtons.querySelector(".unicode-emoji-wrapper");
    

    console.log('chatButtons: ', chatButtons, 'unicodeEmojiButton: ', unicodeEmojiButton, 
        'unicodeEmojiWrapper: ', unicodeEmojiWrapper, 'customEmojiButton: ', customEmojiButton);

    unicodeEmojiButton.addEventListener("click", () => {
        console.log('unicode button clicked');
        unicodeEmojiWrapper.style.display =
            unicodeEmojiWrapper.style.display === "none" ? "block" : "none";
    });
    // handle unicode emoji selection
    document.addEventListener("emoji-click", (e) => {
        const emoji = e.detail.unicode;

        console.log("Inserting emoji:", emoji, "into", chatEditor);
        insertAtCursor(chatEditor, emoji);
    });

    customEmojiButton.addEventListener("click", () => {
        console.log('***customEmojiButton click***');
        const wrapper = chatButtons.querySelector(".custom-emoji-wrapper");
        console.log('wrapper: ', wrapper);
        if (!wrapper) return;

        if (wrapper.style.display === "none" || wrapper.style.display === "") {
            wrapper.style.display = "flex";  // show
            initializeEmojiDrawer(wrapper);
        } else {
            wrapper.style.display = "none";  // hide
        }
    });
    document.addEventListener("click", e => {
        const toolbar = e.target.closest(".chat-toolbar");
        console.log('toolbar: ', toolbar);
        if (toolbar) {
            const customReactioniButton = toolbar.querySelector(".custom-emoji-button");
            const unicodeReactioniButton = toolbar.querySelector(".unicode-emoji-button");
            console.log('customReactionButton:', customReactioniButton, 'unicodeReactionButton: ', unicodeReactioniButton, 'toolbar: ', toolbar)
        }
        
    });
});

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

function initializeEmojiDrawer(wrapper) {
    console.log('initializeEmojiDrawer wrapper: ', wrapper);
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
        img.src = `/media/emojis/${filename}`;
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
                emoji.src = `/media/emojis/${filename}`;
                emoji.alt = filename.split('.')[0];
                emoji.className = 'custom-emoji-reaction';
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

function customEmojiDrawer() {
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

function insertAtCursor(editable, text) {
  editable.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));

  // Move cursor after inserted emoji
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
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
