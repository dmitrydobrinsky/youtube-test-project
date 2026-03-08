// step3-breakdown.js — Initiative Breakdown step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';
import * as gauge from '../components/capacity-gauge.js';

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

function missionBlock(mission) {
  const color = store.getState().settings.missionColors[mission.id] || '#6366f1';
  const initiatives = store.getInitiativesByMission(mission.id);
  return `
    <div class="mission-block" data-mission-id="${mission.id}">
      <div class="mission-header" style="border-left:4px solid ${color}">
        <span class="mission-title">${esc(mission.title)}</span>
        <span class="mission-prio badge badge-${(mission.priority||'').toLowerCase()}">${mission.priority || ''}</span>
        <button class="btn btn-sm btn-primary add-init-btn" data-mission="${mission.id}">+ Add Initiative</button>
      </div>
      <div class="initiatives-list" id="inits-${mission.id}">
        ${initiatives.map(i => initiativeRow(i)).join('')}
        ${!initiatives.length ? '<p class="empty-hint">No initiatives yet. Click "+ Add Initiative" to start.</p>' : ''}
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

  return `
    <div class="init-row ${init.isStretch ? 'stretch' : ''}" data-init-id="${init.id}">
      <div class="init-main">
        <input class="tbl-input init-title" data-field="title" placeholder="Initiative title" value="${esc(init.title)}">
        <div class="init-meta">
          <label>Owner:
            <select class="tbl-input tbl-select init-field" data-field="ownerId">${ownerOpts}</select>
          </label>
          <label>Effort:
            <input class="tbl-input init-field" data-field="effortDays" type="number" min="0" value="${init.effortDays}" style="width:70px"> days
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

  // Add initiative
  container.querySelectorAll('.add-init-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const missionId = e.target.dataset.mission;
      store.addInitiative({ missionId, title: '', effortDays: 5 });
      render();
      // focus the new title
      const list = document.getElementById(`inits-${missionId}`);
      const rows = list.querySelectorAll('.init-title');
      if (rows.length) rows[rows.length - 1].focus();
    });
  });

  // Inline edit
  container.querySelectorAll('.init-field, .init-title, .init-notes').forEach(inp => {
    const event = (inp.tagName === 'SELECT' || inp.type === 'checkbox') ? 'change' : 'input';
    inp.addEventListener(event, e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const field = e.target.dataset.field;
      let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (field === 'effortDays') val = Number(val);
      store.updateInitiative(id, { [field]: val });
      if (field === 'effortDays' || field === 'isStretch') renderGauge();
      if (field === 'isStretch') row.classList.toggle('stretch', val);
    });
  });

  // Delete
  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const ok = await modal.confirm('Delete this initiative?');
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
