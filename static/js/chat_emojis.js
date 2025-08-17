function emojiChatDrawerListeners () {
    const chatButtons = document.getElementById("chat-buttons");
    const unicodeEmojiButton = chatButtons.querySelector('.unicode-emoji-button');
    const customEmojiButton = chatButtons.querySelector('.custom-emoji-button');
    const unicodeEmojiWrapper = chatButtons.querySelector(".unicode-emoji-wrapper");
    const customEmojiWrapper = chatButtons.querySelector(".custom-emoji-wrapper");

    // Click Listeners for chatEditor
    unicodeEmojiButton.addEventListener("click", () => {
        console.log('***unicodeEmojiButton click***  unicodeEmojiWrapper: ', unicodeEmojiWrapper);
        unicodeEmojiWrapper.classList.toggle('visible');
    });

    customEmojiButton.addEventListener("click", () => {
        console.log('***customEmojiButton click***', 'wrapper: ', customEmojiWrapper);
        customEmojiWrapper.classList.toggle('visible');
        if (customEmojiWrapper.classList.contains('visible')) {
            chatEmojiDrawer(customEmojiWrapper);
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
        const unicodeReactionButton = e.target.closest('.unicode-emoji-button');
        const customReactionButton = e.target.closest('.custom-emoji-button');
        const unicodeWrapperReaction = toolbar?.querySelector('.unicode-wrapper-reaction') ?? null;
        const customWrapperReaction = toolbar?.querySelector('.custom-wrapper-reaction') ?? null;

        const drawersAndButtons =
            unicodeEmojiButton?.contains(e.target) ||
            customEmojiButton?.contains(e.target) ||
            unicodeReactionButton?.contains(e.target) ||
            customReactionButton?.contains(e.target) ||
            unicodeEmojiWrapper?.contains(e.target) ||
            customEmojiWrapper?.contains(e.target) ||
            unicodeWrapperReaction?.contains(e.target) ||
            customWrapperReaction?.contains(e.target);
            

        if (!drawersAndButtons) {
            document.querySelectorAll('.unicode-wrapper-reaction')
                .forEach(el => el.classList.remove('visible'));
            document.querySelectorAll('.custom-wrapper-reaction.visible')
                .forEach(el => el.classList.remove('visible'));
            unicodeEmojiWrapper.classList.remove('visible');
            customEmojiWrapper.classList.remove('visible');
        }

        if (toolbar) {
            const customWrapperReaction = toolbar.querySelector('.custom-wrapper-reaction');

            if (e.target.closest('.unicode-emoji-button')) {
                unicodeWrapperReaction.classList.toggle("visible");
                unicodeReactionDrawer(toolbar);
            }

            if (e.target.closest('.custom-emoji-button')) {
                customWrapperReaction.classList.toggle('visible');
                if (customWrapperReaction && !customWrapperReaction.querySelector('.custom-reaction-drawer')) {
                    customChatReactionDrawer(customWrapperReaction, toolbar);
                }
            }
        }

    });
}

function chatEmojiDrawer(wrapper) {
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