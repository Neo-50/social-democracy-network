function emojiChatDrawerListeners () {
    const chatButtons = document.getElementById("chat-buttons");
    const unicodeEmojiButton = chatButtons.querySelector('.unicode-emoji-button');
    const customEmojiButton = chatButtons.querySelector('.custom-emoji-button');
    const unicodeEmojiWrapper = chatButtons.querySelector(".unicode-emoji-wrapper");
    const customEmojiWrapper = chatButtons.querySelector(".custom-emoji-wrapper");

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
                unicodeReactionDrawer(toolbar, "chat");
            }

            if (e.target.closest('.custom-emoji-button')) {
                customWrapperReaction.classList.toggle('visible');
                if (customWrapperReaction && !customWrapperReaction.querySelector('.custom-reaction-drawer')) {
                    customChatReactionDrawer(customWrapperReaction, toolbar);
                }
            }
        }

    });

    // Click Listeners for chatEditor
    unicodeEmojiButton.addEventListener("click", () => {
        console.log('***unicodeEmojiButton click***  unicodeEmojiWrapper: ', unicodeEmojiWrapper);
        unicodeEmojiWrapper.classList.toggle('visible');
    });

    customEmojiButton.addEventListener("click", () => {
        console.log('***customEmojiButton click***', 'wrapper: ', customEmojiWrapper);
        customEmojiWrapper.classList.toggle('visible');
        if (customEmojiWrapper.classList.contains('visible')) {
            customMessagesChatDrawer(customEmojiWrapper);
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
}
