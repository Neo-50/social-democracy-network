let activeCommentBox = null;

document.addEventListener('DOMContentLoaded', () => {

    // UNICODE EMOJI DRAWER
    document.addEventListener("click", e => {
        const emojiButton = e.target.closest(".emoji-button[data-emoji-type='unicode']");
        if (!emojiButton) return;

        toggleEmojiPicker({ target: emojiButton });
        });

    // CUSTOM EMOJI DRAWER
    document.addEventListener("click", e => {
        const customButton = e.target.closest(".emoji-button[data-emoji-type='custom']");
        if (customButton) {
            toggleCustomEmojiDrawer(customButton);
        }
    });
  
    // FILE UPLOAD
    document.querySelectorAll("form").forEach(form => {
        const editor = form.querySelector(".comment-editor");
        const fileInput = form.querySelector(".file-input");
        const uploadButton = form.querySelector(".upload-button");

        if (!editor || !fileInput || !uploadButton) {
            return;
        }

        uploadButton.addEventListener("click", () => {
            fileInput.click();
        });
    
        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (!file || !file.type.startsWith("image/")) return;

            const formData = new FormData();
            formData.append("file", file);

            fetch("/news/upload_news_image", {
                method: "POST",
                body: formData,
            })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok || !data.success) {
                        throw new Error(data.error || "Upload failed");
                    }
                    return data;
                })
                .then(data => {
                    const img = document.createElement("img");
                    img.src = data.url;
                    img.alt = file.name;
                    img.className = "uploaded-image";

                    insertNodeAtCursor(editor, img);
                })
                .catch(err => {
                    console.error("Upload failed:", err);
                    showToast(err.message || "Upload error");
                });
            fileInput.value = "";
        });
    });

    // COMMENT SYNC ON SUBMIT
    document.querySelectorAll("form[action^='/comment/']").forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();  // 🔸 Prevent immediate submission

            const editor = form.querySelector('.comment-editor');
            const hiddenInput = form.querySelector('input[name="comment-content"]');

            console.log("SUBMIT FIRED");
            console.log("editor content:", editor?.innerHTML);
            console.log("hidden input before:", hiddenInput?.value);

            if (editor) {
                await handleBase64Images(editor);  // 🔸 Wait for base64 → upload → URL replace
            }

            if (editor && hiddenInput) {
                hiddenInput.value = editor.innerHTML;
                console.log("Set hidden input to:", hiddenInput.value);
                form.submit();  // 🔸 Now safely submit the form with updated content
            } else {
                console.log("Editor or hidden input not found", editor, hiddenInput);
            }
        });
    });

    document.addEventListener("click", (e) => {
        const isCustomButton = e.target.closest(".emoji-button[data-emoji-type='custom']");
        const isInCustomDrawer = e.target.closest(".custom-wrapper");

        if (!isCustomButton && !isInCustomDrawer && activeCommentBox) {
            // clicked outside, close drawer
            const wrapper = activeCommentBox.querySelector(".custom-wrapper");
            if (wrapper) wrapper.style.display = "none";
            activeCommentBox = null;
        }
    });
  
    document.addEventListener("click", (e) => {
        const isEmojiButton = e.target.closest(".emoji-button[data-emoji-type='unicode']");
        const isInUnicodeDrawer = e.target.closest(".emoji-wrapper");

        if (!isEmojiButton && !isInUnicodeDrawer) {
            document.querySelectorAll(".emoji-wrapper").forEach(wrapper => {
                wrapper.style.display = "none";
            });
        }
    });

    document.querySelectorAll(".comment-content img").forEach(img => {
        if (img.src.includes("/media/news/") && !img.className) {
            img.classList.add("uploaded-image");
        }
    });
});

function toggleUnicodeEmojiDrawer(commentBox) {
    const wrapper = commentBox.querySelector(".emoji-wrapper");
    if (!wrapper) return;

    wrapper.style.display = wrapper.style.display === "none" ? "block" : "none";
}

function toggleCustomEmojiDrawer(button) {
    console.log('Toggling custom emoji drawer')
    const commentBox = button.closest(".comment-box");
    const wrapper = commentBox.querySelector(".custom-wrapper");

    if (wrapper.style.display === "flex") {
        wrapper.style.display = "none";
        const drawer = wrapper.querySelector(".custom-emoji-drawer");
        if (drawer) drawer.remove();
        activeCommentBox = null;
        console.log('Emoji drawer has been closed!');
        return;
    }

    // open it
    wrapper.style.display = "flex";

    let drawer = wrapper.querySelector(".custom-emoji-drawer");
    if (!drawer) {
        initializeEmojiDrawer(commentBox, wrapper);
    }
    activeCommentBox = commentBox;
}

function toggleEmojiPicker(event) {
  const button = event.target.closest(".emoji-button");
  const toolbar = button.closest(".comment-toolbar");
  const box = button.closest(".comment-box");

  if (box) {
    // Existing reply logic
    const pickerWrapper = box.querySelector(".emoji-wrapper");
    const picker = pickerWrapper.querySelector("emoji-picker");

    pickerWrapper.style.display =
      pickerWrapper.style.display === "none" || !pickerWrapper.style.display
        ? "block"
        : "none";

    if (!picker.dataset.bound) {
      picker.addEventListener("emoji-click", (e) => {
        const editor = box.querySelector(".comment-editor");
        const hidden = box.querySelector(".hidden-content");
        editor.focus();
        insertAtCursor(editor, e.detail.unicode);
        if (hidden) hidden.value = editor.innerHTML;
      });
      picker.dataset.bound = "true";
    }

    return;
  }

  if (toolbar) {
    console.log("****Toolbar Branch*****")
    const picker = document.querySelector("#unicode-emoji-picker");
    let wrapper = document.querySelector("#emoji-wrapper");

    // Move it into the clicked toolbar (if it's not already there)
    if (!toolbar.contains(wrapper)) {
        toolbar.appendChild(wrapper);
    }

    wrapper.classList.toggle("visible");
    console.log(wrapper.classList.value);

    if (!picker.dataset.bound) {
      picker.addEventListener("emoji-click", (e) => {
        const commentContent = toolbar.parentElement.querySelector(".comment-content");
        addUnicodeReaction(commentContent, e.detail.unicode);
      });
      picker.dataset.bound = "true";
    }
  }
}

function addUnicodeReaction(target, emoji) {
    console.log("*****Firing addUnicodeReaction()*******")
    const span = document.createElement("span");
    span.className = "emoji-reaction";
    span.textContent = emoji;
    target.appendChild(span);
}

// function toggleEmojiPicker(event) {
//     const button = event.target;
//     const box = button.closest(".comment-box");
//     const pickerWrapper = box.querySelector(".emoji-wrapper");
//     const picker = pickerWrapper.querySelector("emoji-picker");

//     pickerWrapper.style.display = pickerWrapper.style.display === "none" || !pickerWrapper.style.display ? "block" : "none";

//     if (!picker.dataset.bound) {
//         picker.addEventListener("emoji-click", (e) => {
//             const editor = box.querySelector(".comment-editor");
//             const hidden = box.querySelector(".hidden-content");
//             editor.focus();
//             insertAtCursor(editor, e.detail.unicode);
//             if (hidden) hidden.value = editor.innerHTML;
//         });
//     picker.dataset.bound = "true";
//     }
// }

document.querySelectorAll('.reply-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const wrapper = button.closest('.comment-container');
        const drawer = wrapper.querySelector('.reply-drawer');
        if (drawer) {
            drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
            const pickerWrapper = drawer.querySelector('.emoji-wrapper');
            if (pickerWrapper) {
                initializeEmojiDrawer(pickerWrapper);
            }
        }
    });
});

document.querySelectorAll('.cancel-reply').forEach(button => {
    button.addEventListener('click', (e) => {
        const drawer = e.target.closest('.reply-drawer');
        if (drawer) {
                drawer.style.display = 'none';
        }
    });
});

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".youtube-placeholder").forEach(placeholder => {
        placeholder.innerHTML = placeholder.dataset.src;
    });
});

function copyLink(articleId) {
    const id = parseInt(articleId);
    const url = new URL(window.location.href);
    url.searchParams.set("article", id);

    navigator.clipboard.writeText(url.toString())
        .then(() => {
            showToast("🔗 Link copied!");
        })
        .catch(() => {
            showToast("❌ Failed to copy link.");
        });
}

function insertAtCursor(editable, text) {
    editable.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    // move cursor after the inserted text
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function insertNodeAtCursor(editable, node) {
  if (!editable || typeof editable.focus !== "function") {
    console.error("insertNodeAtCursor: invalid editable target", editable);
    return;
  }

  editable.focus();

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    // Put it at the end as a fallback
    editable.appendChild(node);
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);

  // Place caret after the inserted node
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

