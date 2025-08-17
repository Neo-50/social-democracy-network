function emojiNewsDrawerListeners () {
    document.addEventListener("click", e => {
        const unicodeEmojiButton = e.target.closest('.unicode-emoji-button');
        const customEmojiButton = e.target.closest('.custom-emoji-button');

        const toolbar = e.target.closest(".comment-toolbar");
        const unicodeWrapperReaction = toolbar?.querySelector(".unicode-wrapper-reaction") ?? null;
        const customWrapperReaction = toolbar?.querySelector(".custom-wrapper-reaction") ?? null;

        const box = e.target.closest(".comment-box");
        const unicodeEmojiWrapper = box?.querySelector('.unicode-emoji-wrapper') ?? null;
        const customEmojiWrapper = box?.querySelector('.custom-emoji-wrapper') ?? null;
        const customEmojiDrawer = customEmojiWrapper?.querySelector(".custom-emoji-drawer") ?? null;

        const drawersAndButtons =
            unicodeEmojiButton?.contains(e.target) ||
            customEmojiButton?.contains(e.target) ||
            unicodeEmojiWrapper?.contains(e.target) ||
            customEmojiWrapper?.contains(e.target) ||
            unicodeWrapperReaction?.contains(e.target) ||
            customWrapperReaction?.contains(e.target);
            
        console.log ('Are we clicking on customWrapperReaction? ', customWrapperReaction?.contains(e.target));
        if (!drawersAndButtons) {
            document.querySelectorAll('.unicode-wrapper-reaction')
                .forEach(el => el.classList.remove('visible'));
            document.querySelectorAll('.custom-wrapper-reaction.visible')
                .forEach(el => {
                    el.classList.remove('visible');
                    el.remove();
                });
            unicodeEmojiWrapper?.classList.remove('visible');
            customEmojiWrapper?.classList.remove('visible');
        }

        if (toolbar) {
            const customReactionDrawer = customWrapperReaction.querySelector(".custom-reaction-drawer")
            
            if (!customReactionDrawer && e.target.classList.contains('custom-emoji-button')) {
                console.log('Drawer doesnt exist, injecting', )
                customWrapperReaction.classList.toggle('visible');
                customNewsReactionDrawer(customWrapperReaction, toolbar);
            }

            if (customReactionDrawer && e.target.classList.contains('custom-emoji-button')) {
                customWrapperReaction.classList.toggle('visible');
            }

            if (e.target.matches("img.icon")) {
                unicodeWrapperReaction.classList.toggle('visible');
                unicodeReactionDrawer(toolbar);
            }
        }
        
        if (!toolbar) {
            console.log('wrapper: ', customEmojiWrapper, "drawer: ", customEmojiDrawer);
            if (e.target.parentElement.classList.contains('unicode-emoji-button')) {
                
                unicodeEmojiWrapper.classList.toggle('visible');
                unicodeEmojiDrawer(box);
            }
            if (e.target.classList.contains('custom-emoji-button')) {

                customEmojiWrapper.classList.toggle('visible');
                if (customEmojiWrapper.classList.contains('visible')) {
                    customNewsCommentDrawer(box, customEmojiWrapper);
                } else {
                    customEmojiDrawer.remove();
                }
            }

        }
    });
}

function customNewsCommentDrawer(commentBox, wrapper) {
    if (wrapper.querySelector('.custom-emoji-drawer')) return;

    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';
    wrapper.appendChild(drawer);

    const target = commentBox.querySelector('.comment-editor'); // editor element

    sizeButtonHelper(drawer);
    // pass as options or legacy second arg; both work:
    renderCustomEmojisToDrawer(drawer, { target });  // inserts into editor
}


function customNewsReactionDrawer(wrapper, toolbar) {
    const drawer = document.createElement('div');
    drawer.className = 'custom-reaction-drawer';
    wrapper.appendChild(drawer);

    const target = toolbar.closest('.comment-container')?.querySelector('.comment-content');
    const target_id = toolbar.closest('.comment-container')?.dataset?.commentId;

    sizeButtonHelper(drawer);
    renderCustomEmojisToDrawer(drawer, {
        target,        // NOT a .comment-editor → reaction path will run
        target_id,
        targetType: 'news',
    });
}
