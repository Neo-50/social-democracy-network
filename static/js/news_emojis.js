function emojiNewsDrawerListeners () {
    document.addEventListener("click", e => {

        closeAll(e);

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
                unicodeReactionDrawer(toolbar);
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

function closeAll(e) {
	const el = e?.target instanceof Element ? e.target : null;
	if (!el) return;

	// If click is on a button or inside any drawer, do nothing.
	const inControl = el.closest(
		'.unicode-emoji-button, .custom-emoji-button, .unicode-wrapper-reaction, ' +
        '.custom-wrapper-reaction, .unicode-emoji-wrapper, .custom-emoji-wrapper'
	);
	if (inControl) return;

	// Hide all open drawers
	document
		.querySelectorAll('.unicode-wrapper-reaction.visible, .custom-wrapper-reaction.visible, .unicode-emoji-wrapper.visible, .custom-emoji-wrapper.visible')
		.forEach((n) => n.classList.remove('visible'));

	// If you want to purge dynamic custom drawers, remove their inner content
	// (don’t rely on .visible here)
	document
		.querySelectorAll('.custom-wrapper-reaction .custom-emoji-drawer')
		.forEach((d) => d?.remove());
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
