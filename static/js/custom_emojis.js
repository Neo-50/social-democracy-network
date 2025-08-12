let selectedEmojiSize = 28;

document.addEventListener("click", (e) => {
    const unicodeWrapper = document.getElementById("unicode-emoji-wrapper");
    const customWrapper = document.getElementById("custom-emoji-wrapper");

    const isEmojiButton =
        e.target.closest("#unicode-emoji-button") ||
        e.target.closest("#custom-emoji-button");

    const isInUnicodeWrapper = e.target.closest("#unicode-emoji-wrapper");
    const isInCustomWrapper = e.target.closest("#custom-emoji-wrapper");

    if (!isEmojiButton && !isInUnicodeWrapper && !isInCustomWrapper) {
        if (unicodeWrapper) unicodeWrapper.style.display = "none";
        if (customWrapper) customWrapper.style.display = "none";
    }
});

function customEmojiDrawer(button) {
    console.log('Toggling custom emoji drawer');
    console.log('Parent element of button: ', button.parentElement.classList);
    

    const commentBox = button.closest(".comment-box");
    console.log('Comment box:', commentBox);
    if (!commentBox) {
        console.warn('commentBox not found!')
    }

    const toolbar = button.closest(".comment-toolbar");
    console.log('Toolbar value: ', toolbar);
    let drawer = null;
    let wrapper = null;
    if (toolbar) {
        wrapper = toolbar.querySelector("#custom-emoji-wrapper");
        console.log('Wrapper:', wrapper);

        drawer = wrapper.querySelector(".custom-reaction-drawer")
        console.log('Drawer:', drawer);
    }

    if (!commentBox) {
        console.log('No comment box here!')
        // If drawer exists and is visible, hide it and clean up
        if (drawer && wrapper.style.display === "flex") {
            console.log('Drawer exists and is not hidden')
            wrapper.style.display = "none";
            activeCommentBox = null;
            return;
        }

        // If drawer already exists but was hidden, just show it
        if (drawer && wrapper.style.display === "none") {
            console.log('Drawer exists but is hidden so showing it')
            wrapper.style.display = "flex";
            activeCommentBox = commentBox;
            return;
        }

        // If no drawer exists, inject it and show
        if (!drawer) {
            console.log('Drawer doesnt exist, injecting')
            injectCustomReactionDrawer(wrapper, toolbar);
            wrapper.style.display = "flex";
        }
    }
    if (commentBox) {
        console.log('Comment box dectected!', commentBox)
        let wrapper = commentBox.querySelector(".custom-wrapper");
        if (!wrapper) {
            console.warn("No custom-wrapper found inside this commentBox:", commentBox);
            return;
        }
        let drawer = wrapper.querySelector(".custom-emoji-drawer");
        if (wrapper.style.display === "flex") {
            console.log('Wapper detected with flex display');
            wrapper.style.display = "none";
            if (drawer) drawer.remove();
            activeCommentBox = null;
            console.log('Emoji drawer has been closed!');
            return;
        }
        if (wrapper.style.display === "none") {
            console.log('Wapper detected with hidden display');
            wrapper.style.display = "flex";
            if (!drawer || !wrapper.querySelector(".custom-emoji-drawer")) {
                initializeEmojiDrawer(commentBox, wrapper);
            }
            activeCommentBox = commentBox;
        }
    }
}

function injectCustomReactionDrawer(wrapper, toolbar) {
    console.log('injectCustomReactionDrawer reached!')
    
    const drawer = document.createElement('div');
    drawer.className = 'custom-reaction-drawer';
    const selectedEmojiSize = 28;
    
    sizeButtonHelper(drawer);

    customEmojis.forEach(filename => {
        const img = document.createElement('img');
        img.src = `media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
        img.style.cursor = 'pointer';

        img.setAttribute(
            'style',
            `width:${selectedEmojiSize}px;height:${selectedEmojiSize}px;vertical-align:middle;`
        );

        img.addEventListener("click", () => {
            const target = toolbar.closest(".comment-container")?.querySelector(".comment-content");
            const target_id = toolbar.closest(".comment-container").dataset.commentId;
            console.log ('**Custom reaction img click** toolbar: ', toolbar, ' | target: ', target, ' | target_id: ', target_id);
            if (target) {
                const emojiNode = document.createElement("img");
                emojiNode.src = img.src;
                emojiNode.className = "custom-emoji-reaction";
                emojiNode.alt = filename.split(".")[0];
                emojiNode.style.width = `${selectedEmojiSize}px`;
                emojiNode.style.height = `${selectedEmojiSize}px`;
                emojiNode.style.verticalAlign = "middle";

                window.renderReaction({
                    target,
                    emoji: filename,
                    target_id,
                    targetType: "news",
                    user_id: window.CURRENT_USER_ID,
                    user_ids: [window.CURRENT_USER_ID],
                    mode: "insert",
                    emit: true,
                });

                // update hidden field
                const hidden = wrapper.closest(".comment-box")?.querySelector(".hidden-content");
                if (hidden) hidden.value = editor.innerHTML;
            }
        });

        drawer.appendChild(img);
    });

    wrapper.appendChild(drawer);
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
}

function initializeEmojiDrawer(commentBox, wrapper) {
    console.log('***initializeEmojiDrawer*** commentBox: ', commentBox, 'wrapper: ', wrapper);
    if (wrapper.querySelector('.custom-emoji-drawer')) return;

    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';
    drawer.style.marginTop = '10px';
    drawer.style.display = 'flex';
    drawer.style.flexWrap = 'wrap';
    drawer.style.gap = '6px';

    const editorBox = commentBox.querySelector('.comment-editor');
    console.log("initializeEmojiDrawer: ", 'commentBox ', commentBox, '| drawer: ', drawer,
             '| wrapper', wrapper, '| editorBox: ', editorBox, '| editorBox.id ', editorBox.id);
    console.log('Appending drawer as child of wrapper')
    wrapper.appendChild(drawer);

    sizeButtonHelper(drawer);

    customEmojis.forEach(filename => {
        const img = document.createElement('img');
        img.src = `media/emojis/${filename}`;
        img.alt = filename;
        img.className = 'custom-emoji';
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
        img.style.cursor = 'pointer';

        img.setAttribute(
            'style',
            `width:${selectedEmojiSize}px;height:${selectedEmojiSize}px;vertical-align:middle;`
        );
        
        img.addEventListener("click", () => {
            const editor = wrapper.closest(".comment-box")?.querySelector(".comment-editor");
            if (editor) {
                const emojiNode = document.createElement("img");
                emojiNode.src = img.src;
                emojiNode.className = "custom-emoji-reaction";
                emojiNode.alt = filename.split(".")[0];
                emojiNode.style.width = `${selectedEmojiSize}px`;
                emojiNode.style.height = `${selectedEmojiSize}px`;
                emojiNode.style.verticalAlign = "middle";

                insertCustomEmoji(editor, emojiNode);

                // update hidden field
                const hidden = wrapper.closest(".comment-box")?.querySelector(".hidden-content");
                if (hidden) hidden.value = editor.innerHTML;
            }
        });

        drawer.appendChild(img);
    });

    wrapper.appendChild(drawer);
}

function updateDrawerEmojiSizes(drawer) {
    drawer.querySelectorAll('.custom-emoji').forEach(img => {
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
    });
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
