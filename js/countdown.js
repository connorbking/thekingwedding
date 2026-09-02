function pad(value) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function diffParts(target) {
  const now = Date.now();
  const distance = Math.max(0, target - now);
  const totalSeconds = Math.floor(distance / 1000);
  const monthsEstimate = Math.floor(totalSeconds / (30.4375 * 24 * 3600));
  const remainderAfterMonths = totalSeconds - Math.floor(monthsEstimate * 30.4375 * 24 * 3600);
  const days = Math.floor(remainderAfterMonths / 86400);
  const hours = Math.floor((remainderAfterMonths % 86400) / 3600);
  const minutes = Math.floor((remainderAfterMonths % 3600) / 60);
  const seconds = remainderAfterMonths % 60;
  return { months: monthsEstimate, days, hours, minutes, seconds };
}

export function initCountdown(root = document) {
  const nodes = [...root.querySelectorAll("[data-countdown]")];
  if (!nodes.length) return;

  const tick = () => {
    nodes.forEach((node) => {
      const target = Date.parse(node.dataset.countdown);
      if (Number.isNaN(target)) return;
      const parts = diffParts(target);
      node.querySelectorAll("[data-unit]").forEach((el) => {
        const unit = el.dataset.unit;
        if (unit in parts) el.textContent = pad(parts[unit]);
      });
    });
  };

  tick();
  window.setInterval(tick, 1000);
}
