
document.addEventListener('DOMContentLoaded', function () {
    const newMessageForm = document.getElementById('new-message-form');
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

    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(messageForm);
            const response = await fetch('/api/send_message', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Server error:', text);
                throw new Error('Server error');
            }

            const result = await response.json();
            if (result.success) {
                const msg = result.message;
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message-wrapper', 'sent');
                const timestamp = msg.timestamp + 'Z';
                messageDiv.innerHTML = `
                    <div class="message sent">
                        <div class="content">${msg.content}</div>
                        <div class="meta">${msg.sender.username} • <span class="timestamp" data-timestamp="${timestamp}"></span></div>
                    </div>
                `;
                document.querySelector('.messages-container').appendChild(messageDiv);
                
                // Format the newly inserted timestamp
                const timestampEl = messageDiv.querySelector('.timestamp');
                if (timestampEl && timestampEl.dataset.timestamp) {
                    timestampEl.textContent = formatLocalDate(timestampEl.dataset.timestamp);
                }

                messageDiv.scrollIntoView({ behavior: 'smooth' });
                messageForm.querySelector('input[name="content"]').value = '';
            } else {
                alert(result.error || 'Failed to send message.');
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