(() => {
	const form = document.getElementById('archive-form');
	const feed = document.getElementById('feed');

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
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
			if (!res.ok || !data.ok) { throw new Error(data.error || 'Download failed'); }

            console.log('>>>>>> Data received from /api/archive-x: ', data)

			const hasVideo  = Array.isArray(data.primary_video) && data.primary_video.length > 0;
            const hasImages = Array.isArray(data.images)        && data.images.length > 0;

            if (hasVideo) {
				// Append a card to the feed
				const card = document.createElement('div');
                card.className = 'tweet-card';
				card.innerHTML = `
                    <div>Tweet URL: ${data.url}</div>
                    <div >Tweet ID: ${data.tweet_id}</div>
                    <br>
					<span>@${data.author_handle}</span>—
                    ${data.author_name}
                    <div>${data.text}</div>
                    <div class="gallery" style="display:grid;gap:.5rem;">
                        ${(data.primary_video || []).map(v => `
                            <video class="twitter-video" controls preload="metadata">
                                <source src="/media/${v}" type="video/mp4">
                            </video>
                        `).join('')}
                    </div>
					<span class="timestamp" data-timestamp="${data.created_at_utc ?? ''}"></span>
                    <hr>
					<div>👀 ${data.counts.views} | ❤️ ${data.counts.likes} | 💬 ${data.counts.replies}
					 | 🔁 ${data.counts.retweets} | ” ${data.counts.quotes} | 🔖 ${data.counts.bookmarks}</div>
                `;
				feed.prepend(card);
				formatTimestamp(card);
				form.reset();
			} 
			else if (hasImages) {
					const card = document.createElement('div');
                    card.className = 'tweet-card'; 
					card.innerHTML = ` 
                        <div>Tweet URL: ${data.url}</div>
						<div>Tweet ID: ${data.tweet_id}</div>
                        <br>
                        <span>@${data.author_handle}</span>—
                    	${data.author_name}
                        <div>${data.text}</div>
                        <div><img class="twitter-image" src="/media/${data.images[0]}" alt=""></div>
						<span class="timestamp" data-timestamp="${data.created_at_utc ?? ''}"></span>
                        <hr>
						<div>👀 ${data.counts.views} | ❤️ ${data.counts.likes} | 💬 ${data.counts.replies}
						 | 🔁 ${data.counts.retweets} | ” ${data.counts.quotes} | 🔖 ${data.counts.bookmarks}</div>
					`;
					feed.prepend(card);
					formatTimestamp(card);
					form.reset();
				}
		} catch (err) {
			alert(err.message || 'Error');
		} finally {
			btn.disabled = false; btn.textContent = 'Download';
		}
	});
})();