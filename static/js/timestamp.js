document.querySelectorAll('.timestamp').forEach(el => {
	const raw = el.dataset.timestamp;
	if (raw) {
		el.textContent = formatLocalDate(raw);
	}
});

function formatLocalDate(dateStr) {
  const date = new Date(dateStr);
  const options = {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  return date.toLocaleString('en-US', options).replace(',', '•');
}

function formatTimestamp(container = document) {
  	if (!(container instanceof Element) && container !== document) {
    	console.warn("formatTimestamp called with invalid container:", container);
    	return;
  	}

  	const elements = container.querySelectorAll(".timestamp");
  	elements.forEach(el => {
    	const raw = el.dataset.timestamp;
    	try {
      		let date;

      	// ISO 8601 with Z — treat as UTC
      	if (raw.endsWith('Z')) {
        	date = new Date(raw); // auto UTC → local
      	} else {
        	// Format: "YYYY-MM-DD HH:MM:SS"
        	const [datePart, timePart] = raw.split(" ");
        	const [year, month, day] = datePart.split("-").map(Number);
        	const [hour, minute, second] = timePart.split(":").map(Number);
        	date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      	}

      	const dateStr = date.toLocaleDateString('en-US', {
        	month: 'numeric',
        	day: 'numeric',
        	year: 'numeric',
      	});

      	const timeStr = date.toLocaleTimeString('en-US', {
        	hour: 'numeric',
        	minute: '2-digit',
      	});

      	el.textContent = `${dateStr} | ${timeStr}`;
    	} catch (err) {
      	console.warn("Invalid timestamp:", raw);
    	}
  	});
}

