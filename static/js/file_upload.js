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
            body: formData
        });
        const data = await res.json();
        if (data.success && data.url) {
            img.src = data.url;
            img.classList.add("uploaded-image");
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
