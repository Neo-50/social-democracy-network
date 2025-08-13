document.addEventListener('DOMContentLoaded', () => {
    for (const [key, reactions] of Object.entries(window.reactionMap)) {
        const target_id = key.split(':')[1]; // Extract numeric ID from "news:{id}"
        const commentEl = document.querySelector(`[data-comment-id="${target_id}"] .comment-content`);
        if (!commentEl) continue;
        reactions.forEach(({ emoji, user_ids, target_id }) => {
            console.log('DOMContentLoaded: ', 'emoji: ', emoji, '| user_ids: ', user_ids)
            window.renderReaction({
                target: commentEl,
                emoji,
                target_id,
                targetType: 'news',
                user_ids,
                mode: 'load'
            });
        });
    }
});


window.renderReaction = function({
    target,
    emoji,
    target_id,
    targetType,
    user_id = null,
    user_ids = [],
    mode = "update", // "load" | "update" | "insert"
    emit = false
}) {
    console.log('renderReaction: ', 'target: ', target, 'target_id: ', target_id, ' | user_ids: ', user_ids);
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    let result;

    switch (mode) {
        case "load":
            // On page load, skip if it already exists
            if (existing) return;
            result = createNewReaction(target, emoji, target_id, targetType, user_id, user_ids);
            break;

        case "update":
            console.log('renderReaction update called')
            if (existing) {
                result = handleExistingReaction(existing, [...user_ids], user_id);
            } else {
                result = createNewReaction(target, emoji, target_id, targetType, user_id, user_ids);
            }
            break;

        case "insert":
            // Always create new reaction for insertion
            result = createNewReaction(target, emoji, target_id, targetType, user_id, user_ids);
            break;

        default:
            console.warn(`Unknown mode: ${mode}`);
            return;
    }

    // Emit socket event only when explicitly told (e.g. user insertion)
    if (emit && result) {
        console.log('emit toggle_reaction: ', 'emoji: ', emoji, '| target_id: ', target_id, '| target_type: ', targetType, 
            '| action: ', result.action, '| user_id', user_id, '| user_ids', result.user_ids);
        window.reactionSocket.emit("toggle_reaction", {
            emoji,
            target_id: target_id,
            target_type: targetType,
            action: result.action,
            user_id: user_id,
            user_ids: result.user_ids
        }), namespace='/reactions';
    }
};


function handleExistingReaction(existing, user_ids, user_id) {
    const countSpan = existing.querySelector(".reaction-count");
    const alreadyReacted = user_ids.includes(user_id);
    console.log('handleExistingReaction: ', 'alreadyReacted ', alreadyReacted, '| user ids: ', user_ids, '| user id: ', user_id);

    if (alreadyReacted) {
        user_ids = user_ids.filter(id => id !== user_id);
        const usernames = user_ids.map(id => window.userMap[id] || `User ${id}`);
        if (user_ids.length === 0) {
            existing.remove();
            console.log('Reaction removed, user_ids: ', user_ids)
            return { user_id, action: "remove", removed: true };
        } else {
            existing.dataset.user_ids = JSON.stringify(user_ids);
            existing.title = `${usernames.join(", ")}`;
            countSpan.textContent = user_ids.length;
            return { user_ids, action: "remove" };
        }
    } else {
        if (!user_ids.includes(user_id)) {
            user_ids.push(user_id);
        }
        console.log('handleExistingReaction user_ids list updated: ', user_ids);
        existing.dataset.user_ids = JSON.stringify(user_ids);
        console.log('updated existing dataset user_ids: ', existing.dataset.user_ids);
        const usernames = user_ids.map(id => window.userMap[id] || `User ${id}`);
        existing.title = `${usernames.join(", ")}`;
        countSpan.textContent = user_ids.length;
        return { user_ids, action: "add" };
    }
}

function isCustomEmoji(val) {
  return typeof val === "string" && /\.(png|webp|gif|jpe?g|svg)$/i.test(val);
}

function createNewReaction(target, emoji, target_id, targetType, user_id, user_ids) {

    console.log('createNewReaction: ', target, emoji, target_id, targetType, user_id, user_ids);

    // bail if already present
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    if (existing) return { user_ids, action: "noop" };

    const span = document.createElement("span");
    span.className = "emoji-reaction";
    span.dataset.emoji = emoji;            // use filename or the unicode itself
    span.dataset.targetId = target_id;
    span.dataset.targetType = targetType;
    span.dataset.user_ids = JSON.stringify(user_ids);

    // --- build the emoji node (no innerHTML, no string coercion) ---
    let emojiEl;

    if (isCustomEmoji(emoji)) {
        // `emoji` is a filename like "derp.png"
        emojiEl = document.createElement("img");
        emojiEl.className = "custom-emoji-reaction";
        emojiEl.src = `/media/emojis/${emoji}`;       // adjust to your path
        emojiEl.alt = emoji.replace(/\.[^.]+$/, "");  // filename without ext
        emojiEl.style.width = "28px";
        emojiEl.style.height = "28px";
        emojiEl.style.verticalAlign = "middle";
    } else {
        // unicode emoji
        emojiEl = document.createElement("span");
        emojiEl.className = "unicode-emoji-reaction";
        emojiEl.textContent = emoji; // safe: text node
    }

    const countEl = document.createElement("span");
    countEl.className = "reaction-count";
    countEl.textContent = String(user_ids.length);

    span.appendChild(emojiEl);
    span.appendChild(countEl);

    span.addEventListener("click", handleReactionClick);

    target.appendChild(span);
    window.updateReactionTooltip(span, user_ids);
    if (!user_ids.includes(user_id)) user_ids.push(user_id);
    return { user_ids, action: "add" };
}

function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const user_ids = JSON.parse(span.dataset.user_ids || "[]");

    console.log('handleReactionClick data: ', 'span: ', span, '| emoji: ', emoji, ' | targetId: ', targetId, 
        ' | user_ids: ', user_ids, ' | current user: ', window.CURRENT_USER_ID);

    window.renderReaction({
        target: span.parentElement,
        emoji,
        target_id: targetId,
        targetType: window.NEWS_ROOM_ID,
        user_id: window.CURRENT_USER_ID,
        user_ids: user_ids,
        mode: "update",
        emit: true
    });
}

function unicodeReactionDrawer(toolbar) {
    const picker = document.querySelector("#unicode-emoji-picker");
    console.log('unicodeReactionDrawer picker: ', picker);
    let wrapper = document.querySelector("#unicode-wrapper-reaction");
    console.log('unicodeReactionDrawer wrapper: ', wrapper);
    picker.dataset.commentId = toolbar.closest(".comment-container").dataset.commentId;


    if (!toolbar.contains(wrapper)) {
        toolbar.appendChild(wrapper);
    }

    // Set current target for emoji insert
    activeCommentContent = toolbar.parentElement.querySelector(".comment-content");

    wrapper.classList.toggle("visible");

    if (!picker.dataset.bound) {
        picker.addEventListener("emoji-click", (e) => {
            const commentId = picker.closest('.comment-container')?.dataset.commentId;

            if (activeCommentContent) {
                const emoji = e.detail.unicode;

                console.log("unicodeReactionDrawer: ", 'user_ids | ', [window.CURRENT_USER_ID], 'emoji | ', emoji, "user_id | ", window.CURRENT_USER_ID);

                window.renderReaction({
                    target: activeCommentContent,
                    emoji: emoji,
                    target_id: commentId,
                    targetType: window.NEWS_ROOM_ID,
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