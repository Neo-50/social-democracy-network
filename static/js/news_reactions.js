
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

function addUnicodeReaction(target, emoji, targetId, targetType, user_ids) {
    user_ids = user_ids || [];
    const span = document.createElement("span");
    span.className = "emoji-reaction reaction";
    span.dataset.emoji = emoji;
    span.dataset.targetId = targetId;
    span.dataset.targetType = targetType;

    // ✅ Set highlight class on initial render
    if (user_ids.includes(CURRENT_USER_ID)) {
        span.classList.add("reacted-by-me");
    }

    // Inner structure
    span.innerHTML = `${emoji} <span class="reaction-count">${user_ids.length}</span>`;
    span.addEventListener("click", handleReactionClick);
    target.appendChild(span);

    // Fix inline emoji spacing
    const inlineEmojis = target.querySelectorAll("img.inline-emoji");
    inlineEmojis.forEach(img => img.style.marginBottom = "0.25em");
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
