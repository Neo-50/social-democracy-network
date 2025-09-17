async function handleBase64Images(editor) {
    console.log('******handleBase64Images called********')
    const images = editor.querySelectorAll("img");
    for (const img of images) {
        if (img.src.startsWith("data:image/")) {
            const blob = await (await fetch(img.src)).blob();

            const formData = new FormData();
            formData.append("file", blob, "pasted-image.png");

            try {
                const res = await fetch("/news/upload_news_image", {
                    method: "POST",
                    headers: { 'X-CSRFToken': window.csrfToken },
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.url) {
                    img.src = data.url;
                } else {
                    throw new Error(data.error || "Upload failed");
                }
            } catch (err) {
                console.error("Error uploading pasted image:", err);
                showToast("Failed to upload pasted image");
            }
        }
    }
}

function insertNodeAtCursor(editable, node) {
    editable.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    // Optional: move cursor after inserted node
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
}
