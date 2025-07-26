const customEmojis = ['gir.webp', 'gir-cool.webp', 'gir-hyper.webp', 'gir-stare.webp', 'gir-flat.webp', 'gir-suit.png', 'gir-happy.png', 'zimthonk.png',
                    'pepe-yes.png', 'pepe-no.png', 'hmm.png', 'peepo-ban.png', 'peepo-cute.png', 'peepo-happy.png', 'peepo-heart.png', 
                    'pepe-clown.png', 'pepe-copium.png', 'pepe-cringe.png', 'pepe-cry.png', 'pepe-dumb.png', 'pepe-evil.png', 'pepe-ez.png',
                    'pepe-fu.png', 'pepe-giggle.png', 'pepe-gun.png', 'pepe-happy.png', 'pepe-holy.png', 'pepe-megacringe.png', 'pepe-nervous.png',
                    'pepe-noted.png', 'pepe-nuke.png', 'pepe-ok-boomer.png', 'pepe-omg.png', 'pepe-poggers.png', 'pepe-popcorn.png',
                    'pepe-pray.png', 'pepe-rage.png', 'pepe-sadclown.png', 'pepe-sadge.png', 'pepe-sad-hands.png', 'pepe-salute.png', 'pepe-shades.png',
                    'pepe-sip.png', 'pepe-sword.png', 'pepe-teddy-cry.png', 'pepe-think.png', 'pepe-wait.png', 'peepo-rifle.png', 'pepe-angery.png',
                    'peepo-blush.png', 'peepo-sip.png', 'peepo-sit.png', 'peepo-think.png', 'pepe-angry-police.png', 'pepe-angry-scimter.png',
                    'pepe-bigsmile.png', 'pepe-blankie.png', 'pepe-blubbers.png', 'pepe-chat-dead.png', 'pepe-cheer.gif', 'pepe-chef.png', 'pepe-depressed.png',
                    'pepe-fightme.png', 'pepe-flower.png', 'pepe-heart02.png', 'pepe-hug.png', 'pepe-nerd.gif', 'pepe-pirate.png', 'pepe-pitchfork.png',
                    'pepe-police.png', 'pepe-sleep.png', 'pepe-ukraine.png', 'pepe-wizard.png', 'pepe-yep.png', 'pepe-yikes.png',
                    'catblip.webp', 'catblush.webp', 'catclap.webp', 'catcool.webp', 'catcry.webp', 'catcry2.webp', 'catcry3.webp', 'catcry4.webp', 'catcry5.webp',
                    'catdance.webp', 'catjam.webp', 'catno.webp', 'catpolice.webp', 'catrave.webp', 'catsadge.png', 'catshake.webp',
                    'catstare.webp', 'catthumbsup.webp', 'cattocry.webp', 'cat_cry.webp', 'close.webp', 'clowncat.webp', 'meowyey.webp', 'nekocatsip.webp',
                    'polite.webp', 'politecri.png', 'red_angry.png', 'sadcat.png', 'sadcat.webp', 'smudge.png', 'typingcat.webp', 'yellcat.webp'];

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

function initializeEmojiDrawer(commentBox, wrapper) {
    if (wrapper.querySelector('.custom-emoji-drawer')) return;

    const drawer = document.createElement('div');
    drawer.className = 'custom-emoji-drawer';
    drawer.style.marginTop = '10px';
    drawer.style.display = 'flex';
    drawer.style.flexWrap = 'wrap';
    drawer.style.gap = '6px';

    // get editor inside this comment box
    const editorBox = commentBox.querySelector('.comment-editor');
    if (!editorBox || !editorBox.id) {
        console.error("Editor missing or missing id in commentBox", commentBox);
        return;
    }
    drawer.dataset.targetEditorId = editorBox.id;

    wrapper.appendChild(drawer);

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

        img.addEventListener('click', () => {
            const editor = wrapper.closest('.comment-box')?.querySelector(".comment-editor");
            const hidden = wrapper.closest('.comment-box')?.querySelector(".hidden-content");

            if (editor) {
                const emoji = document.createElement('img');
                emoji.src = `media/emojis/${filename}`;
                emoji.alt = filename.split('.')[0];
                emoji.className = 'inline-emoji';
                emoji.style.width = `${selectedEmojiSize}px`;
                emoji.style.height = `${selectedEmojiSize}px`;
                emoji.style.verticalAlign = 'middle';

                insertAtCaret(editor, emoji);
                editor.focus();
                if (hidden) hidden.value = editor.innerHTML;
            }
        });
        
            img.addEventListener("click", () => {
                const editor = wrapper.closest(".comment-box")?.querySelector(".comment-editor");
                if (editor) {
                    const emojiNode = document.createElement("img");
                    emojiNode.src = img.src;
                    emojiNode.className = "inline-emoji";
                    emojiNode.alt = filename.split(".")[0];
                    emojiNode.style.width = `${selectedEmojiSize}px`;
                    emojiNode.style.height = `${selectedEmojiSize}px`;
                    emojiNode.style.verticalAlign = "middle";

                    insertEmojiAtEditorCaret(editor, emojiNode);

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

function insertEmojiAtEditorCaret(editor, node) {
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
