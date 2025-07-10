document.addEventListener('DOMContentLoaded', formatTimestamp)

function formatTimestamp(container = document) {
  const elements = container.querySelectorAll(".comment-timestamp");
  elements.forEach(el => {
    const raw = el.dataset.timestamp;
    try {
      const date = new Date(raw);
      el.textContent = date.toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch (err) {
      console.warn("Invalid timestamp:", raw);
    }
  });
}

