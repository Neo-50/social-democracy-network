// veganism.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById('veganism-form');
    const feed = document.getElementById('veganism-feed');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (window.CURRENT_USER_ID == null || window.CURRENT_USER_ID == 0) {
            showToast('Please login or create an account');
            return;
        }
        showToast('You clicked the submit button!');
        // const fd = new FormData(form);
        // const csrf = form.querySelector('input[name="csrf_token"]')?.value || '';
    });

    // send message
    // sendButton.addEventListener("click", () => {
    //     if (window.CURRENT_USER_ID == null || window.CURRENT_USER_ID == 0) {
    //         showToast('Please login or create an account');
    //         return;
    //     }
    //     const message = chatEditor.innerHTML.trim();
    //     if (message !== "") {
    //         fetch("/veganism/send", {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 "X-CSRFToken": window.csrfToken
    //             },
    //             body: JSON.stringify({
    //                 content: message,
    //                 message_type: "text"
    //             })
    //         })
    //             .then(res => res.json())
    //             .then(data => {
    //                 if (data.success) {
    //                     chatEditor.innerHTML = "";
    //                 } else {
    //                     console.error("Error sending message:", data.error);
    //                 }
    //             });
    //     }
    // });
});

function deleteMessage(messageId) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    fetch(`/veganism/delete_message/${messageId}`, {
        method: "DELETE",
        headers: {
            "X-CSRFToken": window.csrfToken,
        },
    })
        .then(res => {
            if (res.ok) {
                const msgEl = document.querySelector(`.veganism[data-message-id="${messageId}"]`);
                if (msgEl) msgEl.remove();
            } else {
                alert("Failed to delete message");
            }
        })
        .catch(err => {
            console.error("Delete failed:", err);
            alert("Error occurred while deleting message");
        });
}

function renderUrlPreview(msgElement, data) {
    const preview = document.createElement("div");
    preview.className = "url-preview";
    const messageBody = msgElement.querySelector('.message-body');

    let container = msgElement.querySelector('.url-previews');
    if (!container) {
        container = document.createElement('div');
        container.className = 'url-previews';
        messageBody.after(container);
    }

    console.log('renderUrlPreview data.type: ', data.type);

    switch (data.type) {
        case 'youtube': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            wrap.dataset.url = data.url;
            wrap.innerHTML = data.embed_html || '';
            container.appendChild(wrap);
            return;
        }

        case 'x': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            wrap.dataset.url = data.url;			// use data.url (no undefined 'url')
            container.appendChild(wrap);

            const tweetId = data.tweet_id || extractTweetId(data.url) || extractTweetId(data.embed_html);

            window.whenTwitterReady().then(twt => {
                if (twt?.widgets?.createTweet && tweetId) {
                    twt.widgets.createTweet(tweetId, wrap, { theme: 'dark', dnt: true })
                        .catch(() => {						// only fallback on failure
                            wrap.innerHTML = data.embed_html || '';
                            twt.widgets.load?.(wrap);
                        });
                    return;									// <-- important: don’t run the fallback below
                }
                // Fallback path when we don’t have an id or the API is missing
                wrap.innerHTML = data.embed_html || '';
                twt?.widgets?.load?.(wrap);
            });

            setTimeout(() => {
                if (!wrap.querySelector('iframe')) {
                    wrap.innerHTML = `<a href="${data.url}" target="_blank" rel="noopener">View on X</a>`;
                }
            }, 1500);

            return;
        }

        case 'bluesky': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            container.appendChild(wrap);

            // 1) Put the oEmbed blockquote in the DOM (do NOT remove/replace it)
            wrap.innerHTML = data.embed_html || `<a href="${data.url}" target="_blank" rel="noopener">View on Bluesky</a>`;

            // 2) Ask Bluesky to scan just this node; it will create the iframe for you
            ensureBlueskyRuntime().then(() => {
                window.bluesky?.scan?.(wrap);
                // window.notifyEmbedRendered?.();
            });

            return;
        }

        case 'card': {
            let formattedDate = "";
            if (data.published) {
                const date = new Date(data.published);
                if (!isNaN(date)) {
                    // Example: "July 9, 2025"
                    formattedDate = date.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }
            preview.innerHTML = `
                <div class="preview-container">
                    <div class="preview-container-inner">
                        <a href="${data.url}" target="_blank" class="preview-link">
                            <div class="preview-title">${data.title || data.url}</div>
                            ${data.image_url ? `<img src="${data.image_url}" class="preview-image">` : ""}
                        </a>
                        ${data.description ? `<div><span class="article-info description"></span> ${data.description}</div>` : ""}
                        ${data.source ? `<div><span class="article-info source"></span> ${data.source}</div>` : ""}
                        ${formattedDate ? `<div><span class="article-info published"></span> ${formattedDate}</div>` : ""}
                        ${data.authors ? `<div><span class="article-info authors"></span> ${data.authors}</div>` : ""}
                        ${data.category ? `<div><span class="article-info category"></span> ${data.category}</div>` : ""}
                    </div>
                </div>
            `;
            messageBody.after(preview);
        }
    }
}

function extractUrls(text) {
    if (typeof text !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    return [...text.matchAll(urlRegex)].map(m => m[0]);
}
