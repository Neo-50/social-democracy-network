function emojiNewsDrawerListeners () {
    document.addEventListener("click", e => {
        
        const toolbar = e.target.closest(".comment-toolbar");

        closeAll(e);

        if (toolbar) {
            const unicodeWrapperReaction = toolbar.querySelector(".unicode-wrapper-reaction");
            const customWrapperReaction = toolbar.querySelector(".custom-wrapper-reaction");

        const box = e.target.closest(".comment-box");
        const unicodeEmojiWrapper = box?.querySelector('.unicode-emoji-wrapper') ?? null;
        const customEmojiWrapper = box?.querySelector('.custom-emoji-wrapper') ?? null;
        const customEmojiDrawer = customEmojiWrapper?.querySelector(".custom-emoji-drawer") ?? null;

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

function closeAll (e) {
    const unicodeEmojiButton = e.target.closest('.unicode-emoji-button');
    const customEmojiButton = e.target.closest('.custom-emoji-button');

    const unicodeEmojiWrapper = e.target.closest('.unicode-emoji-wrapper.visible');
    const customEmojiWrapper = e.target.closest('.custom-emoji-wrapper.visible');

    if (unicodeEmojiButton || customEmojiButton || unicodeEmojiWrapper || customEmojiWrapper) {
        console.log('Button or wrapper detected, exiting: ', unicodeEmojiButton, customEmojiButton, unicodeEmojiWrapper, customEmojiWrapper);
        return;
    }

    document.querySelectorAll('.unicode-wrapper-reaction.visible, .custom-wrapper-reaction.visible')
        .forEach((n) => n.classList.remove('visible'));
    

    const drawersAndButtons =
        unicodeEmojiButton?.contains(e.target) ||
        customEmojiButton?.contains(e.target) ||
        unicodeEmojiWrapper?.contains(e.target) ||
        customEmojiWrapper?.contains(e.target) ||
        unicodeWrapperReaction?.contains(e.target) ||
        customWrapperReaction?.contains(e.target);
    
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
