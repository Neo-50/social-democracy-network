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


// Parse many inputs → Date. Return null if unparseable.
function parseToDate(raw) {
	if (!raw) return null;
	const s = String(raw).trim();

	// 1) Pure digits → epoch (sec or ms)
	if (/^\d+$/.test(s)) {
		const n = Number(s);
		return new Date(n < 1e12 ? n * 1000 : n);
	}

	// 2) Try native Date (handles ISO and many RFC strings)
	let d = new Date(s);
	if (!isNaN(d.getTime())) return d;

	// 3) "YYYY-MM-DD HH:MM:SS"
	const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
	if (m1) {
		const [, y, mo, da, h, mi, se] = m1.map(Number);
		return new Date(Date.UTC(y, mo - 1, da, h, mi, se));
	}

	// 4) Twitter format: "Wed Oct 22 12:08:35 +0000 2025"
	const m2 = s.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})\s+(\d{4})$/);
	if (m2) {
		const [, monStr, day, hh, mm, ss, tz, year] = m2;
		const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
		const mo = months[monStr];
		if (mo != null) {
			// Build an ISO string with timezone to let Date parse reliably
			const pad = n => String(n).padStart(2,'0');
			const iso = `${year}-${pad(mo+1)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}${tz}`;
			d = new Date(iso);
			if (!isNaN(d.getTime())) return d;
		}
	}

	return null;
}

// Always output: MM/DD/YYYY | h:mm AM/PM
function renderMDY(date) {
	const dateStr = date.toLocaleDateString('en-US', {
		month: '2-digit', day: '2-digit', year: 'numeric'
	});
	const timeStr = date.toLocaleTimeString('en-US', {
		hour: 'numeric', minute: '2-digit', hour12: true
	});
	return `${dateStr} | ${timeStr}`;
}

// Format all .timestamp inside a container (or document)
function formatTimestamp(container = document) {
	const els = container.querySelectorAll('.timestamp');
	els.forEach(el => {
		const raw = el.dataset.timestamp || el.textContent || '';
		const d = parseToDate(raw);
		el.textContent = d ? renderMDY(d) : '';
	});
}


