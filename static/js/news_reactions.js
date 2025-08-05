document.addEventListener('DOMContentLoaded', () => {
    for (const [key, reactions] of Object.entries(window.reactionMap)) {
        const targetId = key.split(':')[1]; // Extract numeric ID from "news:{id}"
        const commentEl = document.querySelector(`[data-comment-id="${targetId}"] .comment-content`);
        if (!commentEl) continue;

        reactions.forEach(({ emoji, user_ids, target_id }) => {
            createNewReaction(commentEl, emoji, target_id, 'news', null, user_ids, false);
        });
    }
});

function handleExistingReaction(existing, user_ids, user_id) {
    const countSpan = existing.querySelector(".reaction-count");
    const alreadyReacted = user_ids.includes(user_id);

    if (alreadyReacted) {
        user_ids = user_ids.filter(id => id !== user_id);
        if (user_ids.length === 0) {
            existing.remove();
            return { user_ids, action: "remove", removed: true };
        } else {
            existing.classList.remove("reacted-by-me");
            countSpan.textContent = user_ids.length;
            return { user_ids, action: "remove" };
        }
    } else {
        user_ids.push(user_id);
        existing.classList.add("reacted-by-me");
        countSpan.textContent = user_ids.length;
        return { user_ids, action: "add" };
    }
}

function createNewReaction(target, emoji, targetId, targetType, user_id) {
    const span = document.createElement("span");
    span.className = "emoji-reaction reaction reacted-by-me";
    span.dataset.emoji = emoji;
    span.dataset.targetId = targetId;
    span.dataset.targetType = targetType;
    span.innerHTML = `${emoji} <span class="reaction-count">1</span>`;
    span.addEventListener("click", handleReactionClick);
    // Fix spacing
    // const inlineEmojis = target.querySelectorAll("img.inline-emoji");
    // inlineEmojis.forEach(img => img.style.marginBottom = "0.25em");
    target.appendChild(span);
    return { user_ids: [user_id], action: "add" };
}

function addUnicodeReaction(target, emoji, targetId, targetType, user_id = null, user_ids = [], emit = true) {
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    let result;

    if (existing) {
        result = handleExistingReaction(existing, [...user_ids], user_id);
        if (result.removed) return;
    } else {
        result = createNewReaction(target, emoji, targetId, targetType, user_id);
    }

    if (emit) {
        window.reactionSocket.emit("toggle_reaction", {
            emoji,
            target_type: targetType,
            target_id: targetId,
            action: result.action,
            user_id,
        });
    }
}

function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const hasReacted = span.classList.contains("reacted-by-me");

    const action = hasReacted ? "remove" : "add";

    window.reactionSocket.emit("toggle_reaction", {
        emoji,
        target_type: window.NEWS_ROOM_ID,
        target_id: targetId,
        action
    });
}
