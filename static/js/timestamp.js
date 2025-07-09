document.addEventListener('DOMContentLoaded', formatTimestamp)

function formatTimestamp() {
  const timestampElements = document.querySelectorAll('.comment-timestamp');
  timestampElements.forEach(el => {
    const utcIso = el.dataset.timestamp;
    if (!utcIso) return;

    const date = new Date(utcIso);
    const options = {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: 'numeric',
      hour12: true,
    };
    const localTime = new Intl.DateTimeFormat(undefined, options).format(date);
    el.textContent = localTime;
  });
}
