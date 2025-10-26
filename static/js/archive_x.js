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

			if (data.primary_video) {
				// Append a card to the feed
				const card = document.createElement('article');
				card.style = 'border:1px solid #333;border-radius:12px;padding:12px;';
				card.innerHTML = `
                    <div style="font-weight:600;margin-bottom:.25rem;">Tweet URL: ${data.url}</div>
                    <div style="font-weight:600;margin-bottom:.25rem;">Tweet ID: ${data.tweet_id}</div>
					<p>Created at: ${data.created_at}</p>
					<p>Likes: ${data.counts.likes} | Retweets: ${data.counts.retweets}, | Comments: ${data.counts.replies}</p>
					<p>${data.text}</p>
                    <div class="gallery" style="display:grid;gap:.5rem;">
                        ${(data.primary_video || []).map(v => `
                            <video class="twitter-video" controls preload="metadata">
                                <source src="/media/${v}" type="video/mp4">
                            </video>
                        `).join('')}
                    </div>
                `;
				feed.prepend(card);
				form.reset();
			} 
			else if (data.images) {
					const card = document.createElement('tweet-card');
					card.innerHTML = ` 
						<div>Tweet URL: ${data.url}</div>
						<div>Tweet ID: ${data.tweet_id}</div>
						<div>Created at: ${data.created_at}</div>
						<div>Likes: ${data.counts.likes} | Retweets: ${data.counts.retweets}, | Comments: ${data.counts.replies}</div>
						<div>${data.text}</div>
						<div><img class="twitter-image" src="${data.images[0]}"></div>
						
					`;
					feed.prepend(card);
					form.reset();
				}
		} catch (err) {
			alert(err.message || 'Error');
		} finally {
			btn.disabled = false; btn.textContent = 'Download';
		}
	});
})();