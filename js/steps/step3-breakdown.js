// step3-breakdown.js — Initiative Breakdown step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';
import * as gauge from '../components/capacity-gauge.js';

const ROLES = ['Algo', 'Data', 'BI', 'Fullstack', 'DevOps'];
const TARGETS = ['H1', 'H2', 'Full', 'Stretch'];

export function init() {
  wizard.registerGuard(3, () => store.getInitiatives().length > 0);
  document.addEventListener('stepchange', e => { if (e.detail.step === 3) render(); });
}

function render() {
  const missions = store.getMissions();
  const container = document.getElementById('breakdown-missions');
  if (!container) return;
  container.innerHTML = missions.map(m => missionBlock(m)).join('');
  bindEvents();
  renderGauge();
}

function missionEffort(missionId) {
  return store.getInitiativesByMission(missionId)
    .filter(i => !i.isStretch)
    .reduce((s, i) => s + (i.effortDays || 0), 0);
}

function missionBlock(mission) {
  const color = store.getState().settings.missionColors[mission.id] || '#6366f1';
  const initiatives = store.getInitiativesByMission(mission.id);
  const total = missionEffort(mission.id);
  return `
    <div class="mission-block" data-mission-id="${mission.id}">
      <div class="mission-header" style="border-left:4px solid ${color}">
        <span class="mission-title">${esc(mission.title)}</span>
        ${total ? `<span style="font-size:.78rem;color:var(--text-muted);margin-left:auto;margin-right:.75rem">${total} days total</span>` : ''}
        <button class="btn btn-sm btn-primary add-init-btn" data-mission="${mission.id}">+ Add Task</button>
      </div>
      <div class="initiatives-list" id="inits-${mission.id}">
        ${initiatives.map(i => initiativeRow(i)).join('')}
        ${!initiatives.length ? '<p class="empty-hint">No tasks yet. Click "+ Add Task" to start.</p>' : ''}
      </div>
    </div>`;
}

function initiativeRow(init) {
  const team = store.getTeam();
  const ownerOpts = [{ id: '', name: '—' }, ...team]
    .map(m => `<option value="${m.id}" ${init.ownerId === m.id ? 'selected' : ''}>${esc(m.name || '—')}</option>`)
    .join('');
  const targetOpts = TARGETS.map(t =>
    `<option value="${t}" ${init.target === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  const roleEfforts = init.roleEfforts || {};
  const total = init.effortDays || 0;

  const roleInputs = ROLES.map(r => `
    <div class="role-effort-cell">
      <div class="role-effort-label">${r}</div>
      <input class="tbl-input role-effort-input" data-role="${r}"
        type="number" min="0" value="${Number(roleEfforts[r] || 0)}"
        style="width:52px;text-align:center">
    </div>`).join('');

  return `
    <div class="init-row ${init.isStretch ? 'stretch' : ''}" data-init-id="${init.id}">
      <div class="init-main">
        <input class="tbl-input init-title" data-field="title" placeholder="Task title" value="${esc(init.title)}">

        <div class="role-effort-row">
          ${roleInputs}
          <div class="role-effort-cell role-effort-total">
            <div class="role-effort-label">Total</div>
            <div class="role-effort-sum">${total} d</div>
          </div>
        </div>

        <div class="init-meta">
          <label>Owner:
            <select class="tbl-input tbl-select init-field" data-field="ownerId">${ownerOpts}</select>
          </label>
          <label>Target:
            <select class="tbl-input tbl-select init-field" data-field="target">${targetOpts}</select>
          </label>
          <label class="stretch-label">
            <input type="checkbox" class="init-field" data-field="isStretch" ${init.isStretch ? 'checked' : ''}> Stretch
          </label>
        </div>
        <textarea class="tbl-input init-notes" data-field="notes" placeholder="Notes…" rows="2">${esc(init.notes)}</textarea>
      </div>
      <button class="icon-btn del-btn" title="Delete">🗑</button>
    </div>`;
}

function bindEvents() {
  const container = document.getElementById('breakdown-missions');

  // Add task
  container.querySelectorAll('.add-init-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const missionId = e.target.dataset.mission;
      store.addInitiative({ missionId, title: '' });
      render();
      const list = document.getElementById(`inits-${missionId}`);
      const rows = list.querySelectorAll('.init-title');
      if (rows.length) rows[rows.length - 1].focus();
    });
  });

  // Role effort inputs
  container.querySelectorAll('.role-effort-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const init = store.getInitiatives().find(x => x.id === id);
      if (!init) return;

      const roleEfforts = { ...(init.roleEfforts || {}) };
      roleEfforts[e.target.dataset.role] = Number(e.target.value) || 0;
      store.updateInitiative(id, { roleEfforts });

      // Update total display inline without full re-render
      const updated = store.getInitiatives().find(x => x.id === id);
      const sumEl = row.querySelector('.role-effort-sum');
      if (sumEl) sumEl.textContent = (updated?.effortDays || 0) + ' d';

      // Update mission total
      const missionBlock = row.closest('.mission-block');
      if (missionBlock) {
        const missionId = missionBlock.dataset.missionId;
        const mTotal = store.getInitiativesByMission(missionId)
          .filter(i => !i.isStretch).reduce((s, i) => s + (i.effortDays || 0), 0);
        let totalEl = missionBlock.querySelector('.mission-header span[style*="text-muted"]');
        if (totalEl) {
          totalEl.textContent = mTotal ? `${mTotal} days total` : '';
        } else if (mTotal) {
          const addBtn = missionBlock.querySelector('.add-init-btn');
          const span = document.createElement('span');
          span.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-left:auto;margin-right:.75rem';
          missionBlock.querySelector('.mission-header').insertBefore(span, addBtn);
          span.textContent = `${mTotal} days total`;
        }
      }

      renderGauge();
    });
  });

  // Other inline fields
  container.querySelectorAll('.init-field, .init-title, .init-notes').forEach(inp => {
    const event = (inp.tagName === 'SELECT' || inp.type === 'checkbox') ? 'change' : 'input';
    inp.addEventListener(event, e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const field = e.target.dataset.field;
      let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      store.updateInitiative(id, { [field]: val });
      if (field === 'isStretch') { row.classList.toggle('stretch', val); renderGauge(); }
    });
  });

  // Delete
  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const ok = await modal.confirm('Delete this task?');
      if (ok) { store.deleteInitiative(id); render(); }
    });
  });
}

function renderGauge() {
  const el = document.getElementById('breakdown-gauge');
  if (el) gauge.render(el, store.committedEffort(), store.totalCapacity());
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
