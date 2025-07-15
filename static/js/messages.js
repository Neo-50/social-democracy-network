let chatEditor;
let messageForm;

document.addEventListener('DOMContentLoaded', function () {
    messageForm = document.getElementById("message-form");
    chatEditor = document.getElementById('chat-editor');
    const newMessageForm = document.getElementById('new-message-form');

    scrollChatToBottom()

    if (newMessageForm) {
        newMessageForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(newMessageForm);
            const response = await fetch('/api/send_message', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showToast('Message sent!');
                newMessageForm.reset();
                window.location.reload();
            } else {
                alert(result.error || 'Message failed to send.');
            }
        });
    }
    
    if (messageForm && chatEditor) {
        messageForm.addEventListener("submit", submitMessageForm);
            chatEditor.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMessageForm(e);
                scrollChatToBottom()
            }
        });
    }
});

document.querySelectorAll('.timestamp').forEach(el => {
    const raw = el.dataset.timestamp;
    if (raw) {
        el.textContent = formatLocalDate(raw);
    }
});

function formatLocalDate(dateStr) {
    const date = new Date(dateStr);
    const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    };
    return date.toLocaleString('en-US', options);
}

async function submitMessageForm(e) {
    e.preventDefault();

    const hiddenInput = document.getElementById("content-hidden");
    hiddenInput.value = chatEditor.innerHTML.trim();
    const formData = new FormData(messageForm);

    const recipientInput = messageForm.querySelector('input[name="recipient_id"]');
    if (!recipientInput || !recipientInput.value) {
        showToast('❗ Select a thread before sending a message.');
        return;
    }

    const response = await fetch("/api/send_message", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Server error:", text);
        throw new Error("Server error");
    }

    const result = await response.json();

    if (result.success) {
        const msg = result.message;
        console.log("Message ID:", msg.id);
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message-wrapper", "sent");
        const timestamp = msg.timestamp + 'Z';

        messageDiv.innerHTML = `
            <div class="message sent">
                <div class="content">${msg.content}</div>
                <div class="meta">${msg.sender.username} • <span class="timestamp" data-timestamp="${timestamp}"></span>
                <button class="delete-im" type="button">🗑️ Delete</button></div>
            </div>
        `;
        
        // Manually attach the data-id to the dynamically added delete button
        const deleteBtn = messageDiv.querySelector(".delete-im");
        deleteBtn.dataset.id = msg.id.toString();

        document.querySelector(".messages-container").appendChild(messageDiv);

        // Format the new timestamp
        const timestampEl = messageDiv.querySelector(".timestamp");
        if (timestampEl && timestampEl.dataset.timestamp) {
            timestampEl.textContent = formatLocalDate(timestampEl.dataset.timestamp);
        }

        chatEditor.innerHTML = ""; // Clear input
    } else {
        alert(result.error || "Failed to send message.");
    }
}

function scrollChatToBottom() {
    const container = document.querySelector('.messages-container');
    if (!container) return;

    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        console.log("✅ Scrolled to:", container.scrollTop);
    });

    // Double fallback in case layout isn't stable yet
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        console.log("⏱️ Fallback scroll to:", container.scrollTop);
    }, 1000);
}

document.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-im");
    if (!deleteBtn) return;

    console.log("Delete button event handler caught");

    const messageEl = deleteBtn.closest(".message-wrapper");
    const messageId = deleteBtn.dataset.id;

    console.log("deleteBtn:", deleteBtn);
    console.log("messageEl:", messageEl);
    console.log("messageId:", messageId);

    if (!messageId) {
        console.warn("Missing messageId on delete button", deleteBtn);
        return;
    }

    if (!messageEl) {
        console.warn("Could not find message wrapper for deletion", deleteBtn);
        return;
    }

    if (confirm("Delete this message?")) {
    fetch(`/api/delete_im/${messageId}`, { method: "DELETE" })
        .then((res) => {
            console.log("Response status:", res.status);
            return res.json();
        })
        .then((data) => {
        if (data.success) {
            console.log("Removing message element:", messageEl);
            messageEl.remove();
        } else {
            showToast(data.error || "Failed to delete message.");
        }
        })
        .catch((err) => {
            console.error("Fetch failed:", err);
            showToast("Failed to send delete request.");
        });
    }
});
