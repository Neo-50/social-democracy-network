document.addEventListener("DOMContentLoaded", () => {
    const chatButtons = document.getElementById("chat-buttons");
    const unicodeEmojiButton = chatButtons.querySelector('.unicode-emoji-button');
    const customEmojiButton = chatButtons.querySelector('.custom-emoji-button');
    const unicodeEmojiWrapper = chatButtons.querySelector(".unicode-emoji-wrapper");
    const customEmojiWrapper = chatButtons.querySelector(".custom-emoji-wrapper");
    
    console.log('chatButtons: ', chatButtons, 'unicodeEmojiButton: ', unicodeEmojiButton, 
        'unicodeEmojiWrapper: ', unicodeEmojiWrapper, 'customEmojiButton: ', customEmojiButton);

    // Click Listeners for chatEditor
    unicodeEmojiButton.addEventListener("click", () => {
        console.log('***unicodeEmojiButton click***  unicodeEmojiWrapper: ', unicodeEmojiWrapper);
        unicodeEmojiWrapper.classList.toggle('visible');
    });

    customEmojiButton.addEventListener("click", () => {
        console.log('***customEmojiButton click***', 'wrapper: ', customEmojiWrapper);
        if (!customEmojiWrapper) return;

        customEmojiWrapper.classList.toggle('visible');
        if (customEmojiWrapper.classList.contains('visible')) {
            initializeEmojiDrawer(customEmojiWrapper);
        }
    });
    
    // Click listener individual emojis insert into chatEditor
    document.addEventListener("emoji-click", (e) => {
        console.log('parentElement: ', e.target.parentElement);
        if (e.target.parentElement.classList.contains('unicode-emoji-wrapper')) {

            const emoji = e.detail.unicode;

            console.log("Inserting emoji:", emoji, "into", chatEditor);
            insertAtCursor(chatEditor, emoji);
        }
    });

    // Click listener to hide drawers & toggle reaction drawers
    document.addEventListener("click", e => {
        const toolbar = e.target.closest(".chat-toolbar");
        console.log('toolbar: ', toolbar);

        const isEmojiBtn =
            unicodeEmojiButton?.contains(e.target) ||
            customEmojiButton?.contains(e.target) ||
            unicodeEmojiWrapper?.contains(e.target) ||
            customEmojiWrapper?.contains(e.target);

        if (!isEmojiBtn) {
            console.log('Not an emoji button');
            document.querySelectorAll('.unicode-wrapper-reaction')
                .forEach(el => el.classList.remove('visible'));
                // .forEach(el => console.log(el))
            unicodeEmojiWrapper.classList.remove('visible');
            customEmojiWrapper.classList.remove('visible');
        }

        if (toolbar) {
            const customReactionButton = toolbar.querySelector(".custom-emoji-button");
            const unicodeReactionButton = toolbar.querySelector(".unicode-emoji-button");
            console.log('customReactionButton:', customReactionButton, 'unicodeReactionButton: ', unicodeReactionButton, 'toolbar: ', toolbar);
            if (e.target.parentElement.classList.contains('unicode-emoji-button')) {
                console.log('unicodeReactionButton');
                unicodeReactionDrawer(toolbar);
            }
            if (e.target.classList.contains('custom-emoji-button')) {
                console.log('customReactionButton');
                // unicodeReactionDrawer(toolbar);
            }
        }
    });
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
                emoji.className = 'emoji-reaction custom';
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
