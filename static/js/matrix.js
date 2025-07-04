document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const emojiButton = document.getElementById('emoji-button');
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');

    sendButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text) {
            console.log("Sending message: ", text);
            // later, send to Flask backend
        }
    });

    emojiButton.addEventListener('click', () => {
        // hook in your emoji drawer
        alert("Open emoji picker (to be implemented)");
    });

    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            console.log("File selected: ", fileInput.files[0].name);
            // later, handle upload
        }
    });
});
