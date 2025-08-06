document.addEventListener('DOMContentLoaded', () => {
    for (const [key, reactions] of Object.entries(window.reactionMap)) {
        const targetId = key.split(':')[1]; // Extract numeric ID from "news:{id}"
        const commentEl = document.querySelector(`[data-comment-id="${targetId}"] .comment-content`);
        if (!commentEl) continue;

        reactions.forEach(({ emoji, user_ids, target_id }) => {
            window.renderReaction({
                target: commentEl,
                emoji,
                targetId,
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
    targetId,
    targetType,
    user_id = null,
    user_ids = [],
    mode = "update", // "load" | "update" | "insert"
    emit = false
}) {
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    let result;

    switch (mode) {
        case "load":
            // On page load, skip if it already exists
            if (existing) return;
            result = createNewReaction(target, emoji, targetId, targetType, user_id);
            break;

        case "update":
            if (existing) {
                result = handleExistingReaction(existing, [...user_ids], user_id);
                if (result.removed) return; // No further action needed if it was removed
            } else {
                result = createNewReaction(target, emoji, targetId, targetType, user_id);
            }
            break;

        case "insert":
            // Always create new reaction for insertion
            result = createNewReaction(target, emoji, targetId, targetType, user_id);
            break;

        default:
            console.warn(`Unknown mode: ${mode}`);
            return;
    }

    // Emit socket event only when explicitly told (e.g. user insertion)
    if (emit && result) {
        console.log("emit toggle_reaction");
        window.reactionSocket.emit("toggle_reaction", {
            emoji,
            target_id: targetId,
            target_type: targetType,
            action: result.action,
            user_id: user_id,
            user_ids: result.user_ids
        });
    }
};


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

function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const userIds = JSON.parse(span.dataset.userIds || "[]");
    const hasReacted = userIds.includes(window.CURRENT_USER_ID);

    console.log('handleReactionClilck data: ', emoji, targetId, userIds, window.CURRENT_USER_ID, hasReacted);
    return;
    const action = hasReacted ? "remove" : "add";

    window.renderReaction({
        target: span.parentElement,
        emoji,
        targetId,
        targetType: window.NEWS_ROOM_ID,
        user_id: window.CURRENT_USER_ID,
        user_ids: userIds,
        mode: "update",
        emit: true
    });
}

