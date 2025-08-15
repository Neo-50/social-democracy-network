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
        const customWrapperReaction = toolbar?.querySelector('.custom-wrapper-reaction') ?? null;

        const isEmojiBtn =
            unicodeEmojiButton?.contains(e.target) ||
            customEmojiButton?.contains(e.target) ||
            unicodeEmojiWrapper?.contains(e.target) ||
            customEmojiWrapper?.contains(e.target) ||
            customWrapperReaction?.contains(e.target);

        if (!isEmojiBtn) {
            console.log('Not an emoji button or wrapper');
            document.querySelectorAll('.unicode-wrapper-reaction')
                .forEach(el => el.classList.remove('visible'));
            document.querySelectorAll('.custom-wrapper-reaction.visible')
                .forEach(el => el.classList.remove('visible'));
            unicodeEmojiWrapper.classList.remove('visible');
            customEmojiWrapper.classList.remove('visible');
        }

        if (toolbar) {
            const customWrapperReaction = toolbar.querySelector('.custom-wrapper-reaction');

            // open Unicode drawer
            if (e.target.closest('.unicode-emoji-button')) {
                unicodeReactionDrawer(toolbar);
            }

            // open Custom drawer
            if (e.target.closest('.custom-emoji-button')) {
                // ensure the drawer exists exactly once
                if (customWrapperReaction && !customWrapperReaction.querySelector('.custom-reaction-drawer')) {
                customChatReactionDrawer(customWrapperReaction, toolbar);
                }
                // single toggle only
                customWrapperReaction?.classList.toggle('visible');
            }
        }

    });
});


function customChatReactionDrawer(wrapper, toolbar) {
    console.log('**customChatReactionDrawer** wrapper: ', wrapper, ' | toolbar: ', toolbar)
    const drawer = document.createElement('div');
    drawer.className = 'custom-reaction-drawer';
    wrapper.appendChild(drawer);

    const target = toolbar.closest('.chat-message');
    const target_id = toolbar.closest('.chat-message')?.dataset?.messageId;

    sizeButtonHelper(drawer);
    renderCustomEmojisToDrawer(drawer, {
        target,
        target_id,
        target_type: 'chat',
    });
}


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

    sizeButtonHelper(drawer);

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
