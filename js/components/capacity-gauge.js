// capacity-gauge.js — reusable capacity bar component

export function render(container, committed, total) {
  const pct = total > 0 ? Math.min((committed / total) * 100, 100) : 0;
  const over = committed > total && total > 0;
  const overPct = total > 0 ? ((committed - total) / total * 100).toFixed(0) : 0;

  let color = 'var(--green)';
  if (pct >= 90) color = 'var(--red)';
  else if (pct >= 70) color = 'var(--yellow)';

  container.innerHTML = `
    <div class="gauge-wrap">
      <div class="gauge-bar">
        <div class="gauge-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="gauge-labels">
        <span>${committed} days committed</span>
        <span style="color:${color}">
          ${over
            ? `⚠ ${committed - total} days over capacity`
            : `${total - committed} days remaining`}
        </span>
        <span>${total} total days</span>
      </div>
    </div>`;
}
