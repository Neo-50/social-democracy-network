
document.addEventListener('DOMContentLoaded', () => {
    for (const [key, reactions] of Object.entries(window.reactionMap)) {
        const [targetType, targetId] = key.split(":");

        const commentEl = document.querySelector(`[data-comment-id="${targetId}"] .comment-content`);
        if (!commentEl) continue;

        reactions.forEach(({ emoji, user_ids }) => {
            addUnicodeReaction(commentEl, emoji, targetId, targetType, user_ids, false);
        });
    }
});

function addUnicodeReaction(target, emoji, targetId, targetType, user_ids = []) {
    const existing = target.querySelector(`.emoji-reaction[data-emoji="${emoji}"]`);
    const alreadyReacted = user_ids.includes(CURRENT_USER_ID);

    if (existing) {
        const countSpan = existing.querySelector(".reaction-count");
        let count = parseInt(countSpan.textContent) || 0;

        if (alreadyReacted) {
            // User already reacted, so remove their reaction
            user_ids = [...user_ids, CURRENT_USER_ID];
            count = Math.max(0, count - 1);

            if (user_ids.length === 0) {
                // No more users, remove the emoji entirely
                existing.remove();
                window.reactionSocket.emit("toggle_reaction", {
                    emoji,
                    target_type: targetType,
                    target_id: targetId,
                    action: "remove",
                });
                return;
            } else {
                // Update count and class
                countSpan.textContent = count;
                existing.classList.remove("reacted-by-me");
                return;
            }
        } else {
            // Someone else reacted, user is adding their reaction
            user_ids = [...user_ids, CURRENT_USER_ID];
            count += 1;

            existing.classList.add("reacted-by-me");
            countSpan.textContent = count;
            return;
        }
    }

    // No existing reaction for this emoji — create a new span
    const span = document.createElement("span");
    span.className = "emoji-reaction reaction";
    span.dataset.emoji = emoji;
    span.dataset.targetId = targetId;
    span.dataset.targetType = targetType;

    // New reaction from this user
    if (!user_ids.includes(CURRENT_USER_ID)) {
        user_ids.push(CURRENT_USER_ID);
    }

    span.classList.add("reacted-by-me");
    span.innerHTML = `${emoji} <span class="reaction-count">1</span>`;
    span.addEventListener("click", handleReactionClick);
    target.appendChild(span);

    // Fix spacing
    const inlineEmojis = target.querySelectorAll("img.inline-emoji");
    inlineEmojis.forEach(img => img.style.marginBottom = "0.25em");

    window.reactionSocket.emit("toggle_reaction", {
        emoji,
        target_type: targetType,
        target_id: targetId,
        action: "add",
    });
}


function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const hasReacted = span.classList.contains("reacted-by-me");

    const action = hasReacted ? "remove" : "add";

    reactionSocket.emit("toggle_reaction", {
        emoji,
        target_type: window.NEWS_ROOM_ID,
        target_id: targetId,
        action
    });
}
