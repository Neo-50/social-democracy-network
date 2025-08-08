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
    console.log('renderReaction: ', 'target_id ', target_id, '| user_ids ', user_ids);
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
        if (user_ids.length === 0) {
            existing.remove();
            console.log('Reaction removed, user_ids: ', user_id)
            return { user_id, action: "remove", removed: true };
        } else {
            existing.classList.remove("reacted-by-me");
            existing.dataset.user_ids = JSON.stringify(user_ids);
            countSpan.textContent = user_ids.length;
            return { user_ids, action: "remove" };
        }
    } else {
        existing.classList.add("reacted-by-me");;
        if (!user_ids.includes(user_id)) {
            user_ids.push(user_id);
        }
        existing.dataset.user_ids = JSON.stringify(user_ids);
        countSpan.textContent = user_ids.length
        return { user_ids, action: "add" };
    }
}

function createNewReaction(target, emoji, target_id, targetType, user_id, user_ids) {
    console.log('createNewReaction: ', 'target ', target, '| emoji ', emoji, '| target_id ', target_id,
        '| targetType ', targetType, '| user_id ', user_id, '| user_ids ', user_ids)
    const span = document.createElement("span");
    span.className = "emoji-reaction reaction reacted-by-me";
    span.dataset.emoji = emoji;
    span.dataset.targetId = target_id;
    span.dataset.targetType = targetType;
    span.dataset.user_ids = JSON.stringify(user_ids);
    const usernames = user_ids.map(id => window.userMap[id] || `User ${id}`);
    const tooltip = `${usernames.join(", ")}`;
    console.log("Tooltip:", tooltip);
    span.innerHTML = `${emoji} <span class="reaction-count"  title="${tooltip}">${user_ids.length}</span>`;
    span.addEventListener("click", handleReactionClick);
    console.log('createNewReaction data: ', span)
    target.appendChild(span);
    if (!user_ids.includes(user_id)) {
        user_ids.push(user_id);
    }
    return { user_ids, action: "add" };
}

function handleReactionClick(event) {
    const span = event.currentTarget;
    const emoji = span.dataset.emoji;
    const targetId = span.dataset.targetId;
    const user_ids = JSON.parse(span.dataset.user_ids || "[]");

    console.log('handleReactionClick data: ', emoji, targetId, user_ids, window.CURRENT_USER_ID);
    console.log('handleReactionClick span: ', span)

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

