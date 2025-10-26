document.querySelectorAll('.timestamp').forEach(el => {
	const raw = el.dataset.timestamp;
	if (raw) {
		el.textContent = formatLocalDate(raw);
	}
});

function formatLocalDate(dateStr) {
    if (!dateStr) return '';

	// Try normal Date parse first (works for ISO strings)
	let date = new Date(dateStr);

    if (isNaN(date.getTime())) {
		const n = Number(dateStr);
		if (Number.isFinite(n)) {
			// < 1e12 → seconds, else milliseconds
			date = new Date(n < 1e12 ? n * 1000 : n);
		}
	}

	// If still invalid, return the original string
	if (isNaN(date)) return dateStr;

	const options = {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	};

	return date.toLocaleString('en-US', options).replace(',', ' |');
}


function formatTimestamp(container = document) {
	// Accept a DOM Element or document
	if (!(container instanceof Element) && container !== document) {
		console.warn("formatTimestamp called with invalid container:", container);
		return;
	}

	const els = container.querySelectorAll(".timestamp");
	els.forEach(el => {
		const rawAttr = (el.dataset.timestamp || "").trim();
		if (!rawAttr) {
			el.textContent = "";
			return;
		}

		let date;

		// 1) Pure numeric → epoch (sec or ms)
		if (/^\d+$/.test(rawAttr)) {
			const n = Number(rawAttr);
			date = new Date(n < 1e12 ? n * 1000 : n); // <1e12 → seconds
		}
		// 2) ISO (or anything Date can parse)
		else if (rawAttr.includes("T")) {
			date = new Date(rawAttr);
		}
		// 3) "YYYY-MM-DD HH:MM:SS"
		else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(rawAttr)) {
			const [d, t] = rawAttr.split(/\s+/);
			const [y, m, dd] = d.split("-").map(Number);
			const [hh, mm, ss] = t.split(":").map(Number);
			// Interpret as UTC to be consistent with server-side epoch
			date = new Date(Date.UTC(y, m - 1, dd, hh, mm, ss));
		}

		// Fallback/validation
		if (!(date instanceof Date) || isNaN(date.getTime())) {
			console.warn("Invalid timestamp:", rawAttr);
			el.textContent = rawAttr; // leave as-is rather than empty
			return;
		}

		el.textContent = date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}).replace(",", " |");
	});
}


