
function updateDrawerEmojiSizes(drawer) {
    drawer.querySelectorAll('.custom-emoji').forEach(img => {
        img.style.width = `${selectedEmojiSize}px`;
        img.style.height = `${selectedEmojiSize}px`;
    });
}

function insertAtCursor(editable, text) {
    editable.focus();

    // Create a text node for the emoji
    const node = document.createTextNode(text);
    editable.appendChild(node);

    // Move caret after the inserted text
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false); // false = move to end

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function placeCaretAtEnd(el) {
    el.focus();
    if (
        typeof window.getSelection != "undefined"
        && typeof document.createRange != "undefined"
    ) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
