document.addEventListener('DOMContentLoaded', formatTimestamp)

function formatTimestamp(container = document) {
  if (!timestampContainer) return;
  if (!(container instanceof Element) && container !== document) {
    console.warn("formatTimestamp called with invalid container:", container);
    return;
  }

  const elements = container.querySelectorAll(".comment-timestamp");
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
