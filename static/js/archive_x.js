(() => {
	const form = document.getElementById('archive-form');
	const feed = document.getElementById('feed');

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (window.CURRENT_USER_ID == null || window.CURRENT_USER_ID == 0) {
            showToast('Please login or create an account');
            return;
        }
		const fd = new FormData(form);
		const csrf = form.querySelector('input[name="csrf_token"]')?.value || '';

		const btn = form.querySelector('button[type="submit"]');
		btn.disabled = true; btn.textContent = 'Downloading…';

		try {
			const res = await fetch('/api/archive-x', {
				method: 'POST',
				headers: { 'X-CSRFToken': csrf },
				body: fd
			});
			const data = await res.json();
			if (res.status === 409 || data.error === 'duplicate' || data.duplicate) {
				showToast('Tweet has already been submitted!', 'danger');
				return;
			}
			else if (!res.ok || !data.ok) { throw new Error(data.error || 'Download failed'); }

			const counts = data.counts ?? {};
			const views = counts.views ?? 0;

            console.log('>>>>>> Data received from /api/archive-x: ', data);

				const videosHTML = (Array.isArray(data.videos) ? data.videos : [])
					.map(vid => `<video class="twitter-video" controls preload="metadata">
									<source src="/media/${vid}" type="video/mp4">
								</video>`)
					.join('');

				const imagesHTML = (Array.isArray(data.images) ? data.images : [])
					.map(img => `<img class="twitter-image" src="/media/${img}" alt="">`)
				.join('');

				const galleryHTML = videosHTML || imagesHTML
					? `<div class="gallery">${videosHTML}${imagesHTML}</div>`
					: '';

				const card = document.createElement('div');
				card.className = 'tweet-card';
				card.innerHTML = `
					<div>Tweet URL: <a href="${data.url}" target="_blank">${data.url}</a></div>
					<div>Tweet ID: ${data.tweet_id}</div>
					<br>
					<span>@${data.author_handle}</span>—
					${data.author_name}
					<div class="tweet-text">${data.text}</div>
					${galleryHTML}
					<span class="timestamp" data-timestamp="${data.created_at_utc ?? ''}"></span>
					<hr>
					<div>👀 ${data.counts.views} | ❤️ ${data.counts.likes} | 💬 ${data.counts.replies}
					 | 🔁 ${data.counts.retweets} | 🗨️ ${data.counts.quotes} | 🔖 ${data.counts.bookmarks}</div>
					<button type="button" class="sharelink" onclick="copyTweetLink('${data.tweet_id}')">🔗 Copy Share Link</button>
				`;
				formatTimestamp(card);
				feed.prepend(card);
				form.reset();
		} catch (err) {
			alert(err.message || 'Error');
		} finally {
			btn.disabled = false; btn.textContent = 'Download';
		}
	});
})();

const monthSel = document.getElementById('monthSel');
const yearSel = document.getElementById('yearSel');
const orderSel = document.getElementById('orderSel');

function updateUrl() {
	const params = new URLSearchParams(window.location.search);
	params.set('month', monthSel.value);
	params.set('year', yearSel.value);
	params.set('order', orderSel.value);
	window.location.search = params.toString();
}

monthSel.addEventListener('change', updateUrl);
yearSel.addEventListener('change', updateUrl);
orderSel.addEventListener('change', updateUrl);

function copyTweetLink(tweetId) {
	const baseUrl = window.location.origin;
	const shareUrl = `${baseUrl}/archive-x?focus=${tweetId}`;

	navigator.clipboard.writeText(shareUrl)
		.then(() => {
			showToast("🔗 Link Copied!");
		})
		.catch(err => {
			console.error("Clipboard copy failed:", err);
			showToast("⚠️ Unable to copy link");
		});
}