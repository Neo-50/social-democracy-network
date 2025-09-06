window.renderReaction = function({
    target,
    emoji,
    emote_title='',
    target_type,
    user_id = null,
    user_ids = [],
    target_id = null,
    article_id = null,
    mode = "update", // "load" | "update" | "insert"
    emit = false
}) {
    console.log('renderReaction received: ', 'target: ', target, ' | emoji: ', emoji, ' | emote_title: ', emote_title, ' | target_type: ', target_type,
        ' | user_id: ', user_id, ' | user_ids: ', user_ids, ' | target_id, ', target_id,' | article_id: ', article_id, ' | mode: ', mode);
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    let result;

    switch (mode) {
        case "load":
            // On page load, skip if it already exists
            if (existing) return;
            result = createNewReaction({target, emoji, target_type, user_id, user_ids, target_id, article_id});
            break;

        case "update":
            console.log('renderReaction update called')
            if (existing) {
                result = handleExistingReaction(existing, [...user_ids], user_id);
            } else {
                result = createNewReaction({target, emoji, target_type, user_id, user_ids, target_id, article_id});
            }
            break;

        case "insert":
            // Always create new reaction for insertion
            result = createNewReaction({target, emoji, emote_title, target_type, user_id, user_ids, target_id, article_id});
            break;

        default:
            console.warn(`Unknown mode: ${mode}`);
            return;
    }

    // Emit socket event only when explicitly told (e.g. user insertion)
    if (emit && result) {
        console.log('emit toggle_reaction: ', 'emoji: ', emoji, '| target_type: ', target_type, '| action: ', result.action,
            '| user_id', user_id, '| user_ids', result.user_ids, '| target_id: ', target_id, ' | article_id: ', article_id);
        const payload = {
            emoji,
            emote_title,
            target_type,
            action: result.action,
            user_id,
            user_ids: result.user_ids,
            ...(target_id != null ? { target_id } : { article_id }),
        };

        window.reactionSocket.emit("toggle_reaction", payload);
    }
};

function unicodeReactionDrawer(toolbar, target_type) {
    const wrapper = toolbar.querySelector(".unicode-wrapper-reaction");
    const picker = wrapper.querySelector("emoji-picker");
    let target_id;
    let article_id;

    console.log('unicodeReactionDrawer | toolbar: ', toolbar, ' | wrapper, ', wrapper,  ' | picker: ', picker, ' | target_type: ', target_type);

    if (!picker.dataset.bound && target_type == "news") {
        if (toolbar.classList.contains('article-toolbar-reactions')) {
            newsArticle = toolbar.closest('.news-article');
            article_id = newsArticle && newsArticle.dataset.articleId
                ? Number(newsArticle.dataset.articleId)
                : null;
            picker.dataset.articleId = article_id;
        } else {
            target_id = picker.closest('.comment-container')?.dataset.commentId;
            target_id = target_id != null ? Number(target_id) : null;
            picker.dataset.commentId = target_id;
        }

        picker.addEventListener("emoji-click", (e) => {
            const emoji = e.detail.unicode;
            const emote_title = e.detail.emoji.annotation || e.detail.emoji.shortcodes?.[0] || '';

            // read cached IDs
            const article_id = picker.dataset.articleId ? Number(picker.dataset.articleId) : null;
            const target_id = picker.dataset.commentId ? Number(picker.dataset.commentId) : null;

            // compute container, then guard
            const reactionsContainer = toolbar.classList.contains("article-toolbar-reactions")
                ? toolbar.previousElementSibling
                : toolbar.nextElementSibling;

            console.log('unicodeReactionDrawer: ', 'reactionsContainer: ', reactionsContainer, ' | user_ids: ', [window.CURRENT_USER_ID], ' | emoji: ', emoji,
                ' | emote_title: ', emote_title, ' | target_type: ', target_type, ' | user_id: ', window.CURRENT_USER_ID);

            if (!reactionsContainer) return;
            if (window.CURRENT_USER_ID == null || window.CURRENT_USER_ID == 0) {
                showToast('Please login or create an account');
                return;
            }

            window.renderReaction({
                target: reactionsContainer,
                emoji,
                emote_title: emote_title,
                target_type,
                user_id: window.CURRENT_USER_ID,
                user_ids: [window.CURRENT_USER_ID],
                ...(target_id != null ? { target_id } : { article_id }),
                mode: "insert",
                emit: true,
            });

            console.log("Reaction inserted: ", emoji);
        });


        picker.dataset.bound = "true";
    }

    if (!picker.dataset.bound && target_type == "chat") {
        console.log('unicodeReactionDrawer chat branch');
        const chatMessage = toolbar.closest('.chat-message');
        target = chatMessage.querySelector('.reactions-container');
        if (chatMessage) {
            const chatId = chatMessage.dataset.messageId;
            picker.dataset.chatId = chatId;
        }
        if (!toolbar.contains(wrapper)) {
            toolbar.appendChild(wrapper);
        }
        console.log('unicodeReactionDrawer appended drawer inside toolbar');
        picker.addEventListener("emoji-click", (e) => {
            console.log('unicodeReactionDrawer emoji click');
            const chatId = chatMessage.dataset.messageId;

            if (chatMessage) {
                const emoji = e.detail.unicode;
                const emote_title = e.target.title;

                console.log("unicodeReactionDrawer renderReaction ", ' | target: ', chatMessage,
                    ' | emoji: ', emoji, ' | target_id: ', chatId, ' | target_type: ', target_type,
                    ' | user_ids: ', [window.CURRENT_USER_ID], " | user_id: ", window.CURRENT_USER_ID, ' | emote_title: ', emote_title);

                window.renderReaction({
                    target: target,
                    emoji: emoji,
                    emote_title: emote_title,
                    target_id: chatId,
                    target_type: target_type,
                    user_id: window.CURRENT_USER_ID,
                    user_ids: [window.CURRENT_USER_ID],
                    mode: "insert",
                    emit: true
                });

                console.log("Reaction inserted:", emoji);
            }
        });
        picker.dataset.bound = "true";
    }
}

function customNewsReactionDrawer(wrapper, toolbar) {
    const drawer = document.createElement('div');
    drawer.className = 'custom-reaction-drawer';
    wrapper.appendChild(drawer);
    let target, target_id, article_id, newsArticle;

    if (toolbar.classList.contains('article-toolbar-reactions')) {
        newsArticle = toolbar.closest('.news-article');
        target = newsArticle.querySelector('.reactions-container');
        article_id = newsArticle && newsArticle.dataset.articleId
            ? Number(newsArticle.dataset.articleId)
            : null;
    } else {
        target = toolbar.closest('.comment-container')?.querySelector('.reactions-container');
        target_id = toolbar.closest('.comment-container')?.dataset?.commentId;
        target_id = target_id != null ? Number(target_id) : null;
    }

    sizeButtonHelper(drawer);

    renderCustomEmojisToDrawer(drawer, {
        target,        // NOT a .comment-editor → reaction path will run
        ...(target_id != null ? { target_id } : { article_id }),
        target_type: 'news'
    });
}

function customChatReactionDrawer(wrapper, toolbar) {
    console.log('**customChatReactionDrawer** wrapper: ', wrapper, ' | toolbar: ', toolbar)
    const drawer = document.createElement('div');
    drawer.className = 'custom-reaction-drawer';
    wrapper.appendChild(drawer);

    const chatMessage = toolbar.closest('.chat-message');
    target = chatMessage.querySelector('.reactions-container');
    const target_id = toolbar.closest('.chat-message')?.dataset?.messageId;

    sizeButtonHelper(drawer);
    renderCustomEmojisToDrawer(drawer, {
        target,
        target_id,
        target_type: 'chat',
    });
}

function handleExistingReaction(existing, user_ids, user_id) {
    const countSpan = existing.querySelector(".reaction-count");
    const alreadyReacted = user_ids.includes(user_id);
    const emoji = String(existing.dataset.emoji);
	let emote_title = window.emojiMap[emoji] || '';
    if (!emote_title) {
        emote_title = emoji.replace(/\.[^.]+$/, "");
    }
    console.log('handleExistingReaction: ', 'alreadyReacted ', alreadyReacted, ' | emoji: ', emoji,
        ' | existing: ', existing, ' | emote_title: ', emote_title, '| user ids: ', user_ids, '| user id: ', user_id);

    if (alreadyReacted) {
        user_ids = user_ids.filter(id => id !== user_id);
        const names = user_ids.map(id => {
            const u = window.userMap[id] || {};
            return u.display_name || u.username || `User ${id}`;
        });
        
        if (user_ids.length === 0) {
            existing.remove();
            console.log('Reaction removed, user_ids: ', user_ids)
            return { user_id, action: "remove", removed: true };
        } else {
            existing.dataset.user_ids = JSON.stringify(user_ids);
            existing.title = `${emote_title} reacted by: ${names.join(", ")}`;
            countSpan.textContent = user_ids.length;
            return { user_ids, action: "remove" };
        }
    } else {
        if (!user_ids.includes(user_id)) {
            user_ids.push(user_id);
        }
        const names = user_ids.map(id => {
            const u = window.userMap[id] || {};
            return u.display_name || u.username || `User ${id}`;
        });
        console.log('handleExistingReaction user_ids list updated: ', user_ids);
        existing.dataset.user_ids = JSON.stringify(user_ids);
        console.log('updated existing dataset user_ids: ', existing.dataset.user_ids);
        const usernames = user_ids.map(id => window.userMap[id] || `User ${id}`);
        existing.title = `${emote_title} reacted by: ${names.join(", ")}`;
        countSpan.textContent = user_ids.length;
        return { user_ids, action: "add" };
    }
}

function isCustomEmoji(val) {
  return typeof val === "string" && /\.(png|webp|gif|jpe?g|svg)$/i.test(val);
}

function createNewReaction({
    target,
    emoji,
    emote_title='',
    target_type,
    user_id,
    user_ids = [],
    target_id = null,
    article_id = null
}) {

    console.log('createNewReaction received: ', 'target: ', target, ' | emoji: ', emoji, 
        ' | emote_title: ', emote_title, ' | target_type: ', target_type,' | user_id: ', user_id,
        ' | user_ids: ', user_ids, ' | target_id: ', target_id, ' | article_id: ', article_id);
    // ---- normalize inputs ----
    const uid = Number(user_id);

    // turn undefined / stringified JSON / single value into a clean number[]
    const toIds = (v) => {
        if (Array.isArray(v)) return v.map(Number);
        if (typeof v === "string") {
            try {
                const arr = JSON.parse(v);
                return Array.isArray(arr) ? arr.map(Number) : [];
            } catch { return []; }
        }
        if (v == null) return [];
        return [Number(v)];
    };

    user_ids = toIds(user_ids);

    console.log('createNewReaction updated user_ids: user_ids');

    // bail if already present
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    if (existing) return { user_ids, action: "noop" };

    const span = document.createElement("span");
    span.className = "emoji-reaction";
    span.dataset.emoji = emoji;

    if (target_id != null) {
        span.dataset.target_id = String(target_id);
    } else if (article_id != null) {
        span.dataset.article_id = String(article_id);
    }

    span.dataset.target_type = target_type;
    span.dataset.user_ids = JSON.stringify(user_ids);

    // --- build the emoji node (no innerHTML, no string coercion) ---
    let emojiEl;

    if (isCustomEmoji(emoji)) {
        // `emoji` is a filename like "derp.png"
        emojiEl = document.createElement("img");
        emojiEl.className = "emoji-reaction custom";
        emojiEl.src = `/media/emojis/${emoji}`;
        emojiEl.alt = emoji.replace(/\.[^.]+$/, "");  // filename without ext
        emojiEl.style.verticalAlign = "middle";
    } else {
        // unicode emoji
        emojiEl = document.createElement("span");
        emojiEl.className = "emoji-reaction unicode";
        emojiEl.textContent = emoji; // safe: text node
    }

    const countEl = document.createElement("span");
    countEl.className = "reaction-count";

    if (!emote_title) {
        emote_title = window.emojiMap[emoji]
    }

    if (!user_ids.includes(user_id) && user_id !== null) user_ids.push(user_id);
    window.onEmojiMapReady(() => window.updateReactionTooltip(span, user_ids, emote_title));
    countEl.textContent = String(user_ids.length);

    span.appendChild(emojiEl);
    span.appendChild(countEl);

    span.addEventListener("click", (event) => handleReactionClick(event, target_type));

    target.appendChild(span);

    return { user_ids, action: "add" };
}

function handleReactionClick(event) {
    if (window.CURRENT_USER_ID == null) {
        showToast('Please login or create an account');
        return;
    }
    const span = event.currentTarget;

    const emoji = span.dataset.emoji;
    const target_type = span.dataset.target_type; // already stamped in createNewReaction

    const article_id = span.dataset.article_id != null && span.dataset.article_id !== ""
        ? Number(span.dataset.article_id)
        : null;

    const target_id = span.dataset.target_id != null && span.dataset.target_id !== ""
        ? Number(span.dataset.target_id)
        : null;

    // keep user_ids in sync
    const user_ids = JSON.parse(span.dataset.user_ids || "[]");

    // sanity: exactly one of the two must be set
    if ((article_id == null) === (target_id == null)) {
        console.warn("Reaction span missing/duplicated IDs:", { article_id, target_id, span });
        return;
    }

    window.renderReaction({
        target: span.parentElement, // the reactions container
        emoji,
        target_type,
        ...(target_id != null ? { target_id } : { article_id }),
        user_id: window.CURRENT_USER_ID,
        user_ids,
        mode: "update",
        emit: true,
    });
}

