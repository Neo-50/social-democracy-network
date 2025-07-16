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
  return date.toLocaleString('en-US', options).replace(',', ' ');
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
      const date = new Date(raw);
      el.textContent = date.toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short"
      });
    } catch (err) {
      console.warn("Invalid timestamp:", raw);
    }
  });
}
