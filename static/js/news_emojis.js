function emojiNewsDrawerListeners () {
    document.addEventListener("click", e => {

        closeAllNewsDrawers(e);

        const toolbar = e.target.closest(".comment-toolbar");

        if (toolbar) {
            const unicodeWrapperReaction = toolbar.querySelector(".unicode-wrapper-reaction");
            const customWrapperReaction = toolbar.querySelector(".custom-wrapper-reaction");
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
                unicodeReactionDrawer(toolbar, "news");
            }
        }
        
        if (!toolbar) {
            const box = e.target.closest(".comment-box");
            const unicodeEmojiWrapper = box?.querySelector('.unicode-emoji-wrapper') ?? null;
            const customEmojiWrapper = box?.querySelector('.custom-emoji-wrapper') ?? null;
            const customEmojiDrawer = customEmojiWrapper?.querySelector(".custom-emoji-drawer") ?? null;
            console.log('wrapper: ', customEmojiWrapper, "drawer: ", customEmojiDrawer);
            if (e.target.parentElement.classList.contains('unicode-emoji-button')) {
                
                unicodeEmojiWrapper.classList.toggle('visible');
                unicodeEmojiDrawer(box, "news");
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

function closeAllNewsDrawers(e) {
	const el = e?.target instanceof Element ? e.target : null;
	if (!el) return;

	const inControl = el.closest(
		'.unicode-emoji-button, .custom-emoji-button, .unicode-wrapper-reaction, ' +
        '.custom-wrapper-reaction, .unicode-emoji-wrapper, .custom-emoji-wrapper'
	);
	if (inControl) return;

	document
		.querySelectorAll('.unicode-wrapper-reaction.visible, .custom-wrapper-reaction.visible, ' +
            '.unicode-emoji-wrapper.visible, .custom-emoji-wrapper.visible')
		.forEach((n) => n.classList.remove('visible'));

	document
		.querySelectorAll('.custom-wrapper-reaction .custom-emoji-drawer')
		.forEach((d) => d?.remove());
}


function customNewsCommentDrawer(commentBox, wrapper) {
    if (wrapper.querySelector('.custom-emoji-drawer')) return;

    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';
    wrapper.appendChild(drawer);

    const target = commentBox.querySelector('.comment-editor');

    sizeButtonHelper(drawer);
    
    renderCustomEmojisToDrawer(drawer, { target });
}
