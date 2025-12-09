// veganism.js
const form = document.getElementById('veganism-form');
const feed = document.getElementById('veganism-feed');

document.addEventListener("DOMContentLoaded", () => {
    const posts = feed.querySelectorAll('.vegan-post');

    if(posts.length) {
        posts.forEach(post => {
            let url = post.textContent.trim();
            if (!url) return;
            fetch(`/api/url-preview?url=${encodeURIComponent(url)}`)
                .then(res => {
                    if (res.status === 404) {
                        console.log('No preview found for URL, skipping:', url);
                        showToast("No preview found for URL!");
                        return null;
                    }
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (!data) return;
                    renderUrlPreview(data, post.id);
                })
                .catch(err => {
                    console.error('URL preview error:', err);
                    showToast('Error generating preview');
                });
        });
    };

    veganismButton = document.querySelector('.submit-button');

    veganismButton.addEventListener("click", async(e) => {
        e.preventDefault();

        if (window.CURRENT_USER_ID == null || window.CURRENT_USER_ID == 0) {
            showToast('Please login or create an account');
            return;
        }
        veganismForm = document.getElementById("veganism-form");
        const url = document.getElementById("url").value.trim();
        const csrfToken = veganismForm.querySelector('input[name="csrf_token"]').value;

        if (url !== "") {
            
            fetch("/veganism/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                },
                body: JSON.stringify({ url })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        newPost(data);
                        let newPostId = `post-${data.post_id}`;
                        fetch(`/api/url-preview?url=${encodeURIComponent(data.url)}`)
                            .then(res => res.ok ? res.json() : null)
                            .then(data => {
                                if (data) {
                                    renderUrlPreview(data, newPostId);
                                    showToast('Post submitted successfully!');
                                }
                            })
                            .catch(err => console.error("URL preview error:", err));
                        // chatEditor.innerHTML = "";
                    } else {
                        showToast(data.error);
                        console.error("Error sending message:", data.error);
                    }
                });
        }
    });
});

function newPost(data) {
    console.log('**** DATA ****', data);
    const html = `<div class="vegan-post" id="post-${data.post_id}">${data.url}</div>`
    feed.insertAdjacentHTML('afterbegin', html);
}

function renderUrlPreview(data, postId) {
    const feed = document.getElementById('veganism-feed');
    const veganPost = feed.querySelector(`#${postId}`);

    console.log('*******feed, veganPost*********', postId, data.type);

    if(!veganPost) {
        showToast('veganPost not found!');
        return
    }
    switch (data.type) {
        case 'youtube': {
            console.log('**** DATA **** data.url: ', data.url, 'data.id: ', data.id, 'data.description: ', data.description, 'data.source: ', data.source,
                'data.published: ', data.published, 'data.authors: ', data.authors, 'data.category: ', data.category);
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
            veganPost.innerHTML = `
                <div class="preview-container">
                    <div class="preview-container-inner">
                        ${data.embed_html}
                        ${data.id ? `<div><span class="article-info sdn-url"></span>
                                    <a href="https://social-democracy.net/news?article=${data.id}" target="_blank">
                                    https://social-democracy.net/news?article=${data.id}</a></div>` : ""}
                        ${data.description ? `<div><span class="article-info description"></span> ${data.description}</div>` : ""}
                        ${data.source ? `<div><span class="article-info source"></span> ${data.source}</div>` : ""}
                        ${formattedDate ? `<div><span class="article-info published"></span> ${formattedDate}</div>` : ""}
                        ${data.authors ? `<div><span class="article-info authors"></span> ${data.authors}</div>` : ""}
                        ${data.category ? `<div><span class="article-info category"></span> ${data.category}</div>` : ""}
                    </div>
                </div>
            `;
            return;
        }

        case 'x': {
            const wrap = document.createElement('div');
            wrap.className = 'url-embed';
            wrap.dataset.url = data.url;
            veganPost.appendChild(wrap);

            const tweetId = data.tweet_id || extractTweetId(data.url) || extractTweetId(data.embed_html);

            window.whenTwitterReady().then(twt => {
                if (twt?.widgets?.createTweet && tweetId) {
                    twt.widgets.createTweet(tweetId, wrap, { theme: 'dark', dnt: true })
                        .catch(() => {
                            wrap.innerHTML = data.embed_html || '';
                            twt.widgets.load?.(wrap);
                        });
                    return;
                }
                
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
            veganPost.appendChild(wrap);

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
            veganPost.innerHTML = `
                <div class="preview-container">
                    <div class="preview-container-inner">
                        <a href="${data.url}" target="_blank" class="preview-link">
                            <div class="preview-title">${data.title || data.url}</div>
                            ${data.image_url ? `<img src="${data.image_url}" class="preview-image">` : ""}
                        </a>
                        ${data.id ? `<div><span class="article-info sdn-url"></span>
                                    <a href="https://social-democracy.net/news?article=${data.id}" target="_blank">
                                    https://social-democracy.net/news?article=${data.id}</a></div>` : ""}
                        ${data.description ? `<div><span class="article-info description"></span> ${data.description}</div>` : ""}
                        ${data.source ? `<div><span class="article-info source"></span> ${data.source}</div>` : ""}
                        ${formattedDate ? `<div><span class="article-info published"></span> ${formattedDate}</div>` : ""}
                        ${data.authors ? `<div><span class="article-info authors"></span> ${data.authors}</div>` : ""}
                        ${data.category ? `<div><span class="article-info category"></span> ${data.category}</div>` : ""}
                    </div>
                </div>
            `;
        }
    }
}

function extractUrls(text) {
    if (typeof text !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    return [...text.matchAll(urlRegex)].map(m => m[0]);
}

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
