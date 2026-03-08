// capacity-gauge.js — reusable capacity bar component

export function render(container, committed, total) {
  const pct = total > 0 ? Math.min((committed / total) * 100, 100) : 0;
  const over = committed > total && total > 0;

  let color = 'var(--green)';
  if (pct >= 90) color = 'var(--red)';
  else if (pct >= 70) color = 'var(--yellow)';

  container.innerHTML = `
    <div class="gauge-wrap">
      <div class="gauge-bar">
        <div class="gauge-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="gauge-labels">
        <span style="color:${color}">
          ${over ? `⚠ ${committed - total} days over capacity` : `${total - committed} days remaining`}
        </span>
        <span>${total} total days</span>
      </div>
    </div>`;
}

export function renderByRole(container, committedByRole, capacityByRole) {
  const ROLES = ['Algo', 'Data', 'BI', 'Fullstack', 'DevOps'];

  const rows = ROLES.map(role => {
    const capacity  = capacityByRole[role]  || 0;
    const committed = committedByRole[role] || 0;
    const remaining = capacity - committed;
    const pct = capacity > 0 ? Math.min((committed / capacity) * 100, 100) : 0;
    const over = committed > capacity && capacity > 0;

    let color = 'var(--green)';
    if (capacity === 0)  color = 'var(--text-muted)';
    else if (pct >= 90)  color = 'var(--red)';
    else if (pct >= 70)  color = 'var(--yellow)';

    return `
      <div class="role-gauge-row">
        <span class="role-gauge-name">${role}</span>
        <div class="gauge-bar role-gauge-bar">
          <div class="gauge-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="role-gauge-capacity" title="Capacity">${capacity}d</span>
        <span class="role-gauge-remaining" style="color:${color}">
          ${capacity === 0 ? '—' : over ? `⚠ +${committed - capacity} over` : `${remaining} left`}
        </span>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="role-gauge-grid">${rows}</div>`;
}
