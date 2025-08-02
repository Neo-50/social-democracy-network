
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

function addUnicodeReaction(target, emoji, targetId, targetType, users, emit = true) {
    console.log("***Firing addUnicodeReaction()***");
    console.log("Value of users in addUnicodeReaction: ", users)
    const span = document.createElement("span");
    span.className = "emoji-reaction";
    span.dataset.emoji = emoji;
    span.dataset.targetId = targetId;
    span.dataset.targetType = targetType;
    span.dataset.users = JSON.stringify(users);
    let action = "add";

    // 👇 Set up count element
    span.innerHTML = `${emoji} <span class="reaction-count">1</span>`;
    span.addEventListener("click", handleReactionClick);
    target.appendChild(span);

    // Layout fix for inline emojis
    const inlineEmojis = target.querySelectorAll("img.inline-emoji");
    inlineEmojis.forEach(img => {
    img.style.marginBottom = "0.25em";
    });

    if (emit) {
        window.reactionSocket.emit("reaction_update", {
            emoji,
            target_type: targetType,
            target_id: targetId,
            user_id: CURRENT_USER_ID,
            users: [users],
            action,
            room_id: NEWS_ROOM_ID,
        });

        reactionSocket.emit("toggle_reaction", {
            emoji,
            target_type: targetType,
            target_id: targetId,
            users: users,
            action
        });
    }
}

function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const countSpan = span.querySelector(".reaction-count");
    let action;

    // Parse current users
    let users = JSON.parse(span.dataset.users || "[]");
    console.log("Parsed users type:", typeof users, "Value:", users);

    if (users.includes(CURRENT_USER_ID)) {
        // Remove user from list
        users = users.filter(id => id !== CURRENT_USER_ID);

        if (users.length === 0) {
            // Remove the reaction element entirely
            span.remove();
            console.log("Users after removal:", users);
            action = "remove";
        } else {
            // Update count and user list
            countSpan.textContent = users.length;
            span.dataset.users = JSON.stringify(users);
            action = "remove";
        }
    } else {
        // Add user
        users.push(CURRENT_USER_ID);
        countSpan.textContent = users.length;
        span.dataset.users = JSON.stringify(users);
        action = "add";
    }
    console.log('Initiating reaction Flask route');
    console.log('Data payload: ', emoji, NEWS_ROOM_ID, targetId, users, action)
    reactionSocket.emit("toggle_reaction", {
        emoji,
        target_type: NEWS_ROOM_ID,
        target_id: targetId,
        users,
        action
    });
}