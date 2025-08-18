function unicodeEmojiDrawer(box, target_type) {
    console.log('unicodeEmojiDrawer: box: ', box, ' | target_type: ', target_type);
    const pickerWrapper = box.querySelector(".unicode-emoji-wrapper");
    const picker = pickerWrapper.querySelector("emoji-picker");
    let editor;
    
    console.log('Target type is: ', target_type);
    switch (target_type) {
        case "news": editor = box.querySelector(".comment-editor"); break;
        case "messages":
        case "chat": editor = box.querySelector(".chat-editor"); break;
    }

    console.log('target_type: ', target_type, ' | editor: ', editor);

    if (!picker.dataset.bound) {
        console.log('picker.dataset.bound');
        picker.addEventListener("emoji-click", (e) => {
            
            const hidden = box.querySelector(".hidden-content");
            editor.focus();
            insertAtCursor(editor, e.detail.unicode);
            if (hidden) hidden.value = editor.innerHTML;
        });
        picker.dataset.bound = "true";
    }
    return;
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