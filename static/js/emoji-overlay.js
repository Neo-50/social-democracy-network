document.addEventListener("DOMContentLoaded", () => {
    // Create floating emoji button + drawer container
    const emojiBox = document.createElement("div");
    emojiBox.className = "comment-box";
    emojiBox.style.position = "fixed";
    emojiBox.style.bottom = "20px";
    emojiBox.style.right = "100px";
    emojiBox.style.zIndex = "9999";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-button";
    button.textContent = "🐱";
    button.addEventListener("click", toggleCustomEmojiDrawer);

    const wrapper = document.createElement("div");
    wrapper.className = "custom-wrapper";
    wrapper.style.display = "none";

    emojiBox.appendChild(button);
    emojiBox.appendChild(wrapper);
    document.body.appendChild(emojiBox);

    // Patch insertAtCaret to target Element Web's chat editor
    window.insertAtCaret = function (container, node) {
        const iframeDoc = document;
        const editor = iframeDoc.querySelector('[contenteditable="true"]');
        if (!editor) return;

        const sel = editor.ownerDocument.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
  };

// Initialize the drawer when the DOM is ready
window.addEventListener("load", () => {
        const wrapper = document.querySelector(".custom-wrapper");
        if (wrapper && typeof initializeEmojiDrawer === "function") {
        initializeEmojiDrawer(wrapper);
        } else {
        console.warn("Drawer not initialized: function or wrapper missing");
        }
    });
});

// Function to toggle the drawer visibility
function toggleCustomEmojiDrawer() {
    const wrapper = document.querySelector(".custom-wrapper");
    if (!wrapper) return;

    wrapper.style.display = wrapper.style.display === "flex" ? "none" : "flex";
}
