// step3-breakdown.js — Initiative Breakdown step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';
import { renderByRole } from '../components/capacity-gauge.js';
import { fetchIssues } from '../utils/jira-adapter.js';

const ROLES = ['Algo', 'Data', 'BI', 'Fullstack', 'DevOps'];
const TARGETS = ['H1', 'H2', 'Full', 'Stretch'];

const JIRA_DOMAIN = 'onebeat.atlassian.net';

export function init() {
  wizard.registerGuard(4, () => store.getInitiatives().length > 0);
  document.addEventListener('stepchange', e => { if (e.detail.step === 4) render(); });
  document.getElementById('breakdown-jira-btn')?.addEventListener('click', openJiraImportModal);
}

// Remember which missions are collapsed across re-renders
const collapsedMissions = new Set();

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
  const team = store.getTeam();
  const ownerOpts = [{ id: '', name: '—' }, ...team]
    .map(m => `<option value="${m.id}" ${mission.ownerId === m.id ? 'selected' : ''}>${esc(m.name || '—')}</option>`)
    .join('');
  const hasTasks = initiatives.length > 0;
  const collapsed = collapsedMissions.has(mission.id);
  return `
    <div class="mission-block" data-mission-id="${mission.id}">
      <div class="mission-header" style="border-left:4px solid ${color}">
        ${hasTasks ? `<button class="collapse-btn icon-btn" data-mission-id="${mission.id}" title="${collapsed ? 'Expand' : 'Collapse'}" style="font-size:.85rem;padding:.2rem .35rem;opacity:.7">${collapsed ? '▶' : '▼'}</button>` : '<span style="width:24px;flex-shrink:0"></span>'}
        <span class="mission-title">${esc(mission.title)}</span>
        <label style="display:flex;align-items:center;gap:.35rem;font-size:.78rem;color:var(--text-muted);margin-left:.75rem">
          Owner:
          <select class="tbl-input tbl-select mission-owner-select" data-mission-id="${mission.id}" style="font-size:.78rem;padding:.25rem .5rem">${ownerOpts}</select>
        </label>
        <div style="flex:1"></div>
        <span class="mission-total-label" style="font-size:.78rem;color:var(--text-muted);margin-right:.75rem">${total ? total + ' days total' : ''}</span>
        <button class="btn btn-sm btn-primary add-init-btn" data-mission="${mission.id}">+ Add Task</button>
      </div>
      <div class="initiatives-list" id="inits-${mission.id}" ${collapsed ? 'style="display:none"' : ''}>
        ${initiatives.map(i => initiativeRow(i)).join('')}
        ${!hasTasks ? '<p class="empty-hint">No tasks yet. Click "+ Add Task" to start.</p>' : ''}
      </div>
    </div>`;
}

function initiativeRow(init) {
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
          <label>Target:
            <select class="tbl-input tbl-select init-field" data-field="target">${targetOpts}</select>
          </label>
          <label class="stretch-label">
            <input type="checkbox" class="init-field" data-field="isStretch" ${init.isStretch ? 'checked' : ''}> Stretch
          </label>
        </div>
        <textarea class="tbl-input init-notes" data-field="notes" placeholder="Notes…" rows="2">${esc(init.notes)}</textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:.3rem">
        <button class="icon-btn clone-btn" title="Clone task">⧉</button>
        <button class="icon-btn del-btn" title="Delete">🗑</button>
      </div>
    </div>`;
}

function bindEvents() {
  const container = document.getElementById('breakdown-missions');

  // Collapse / expand
  container.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.missionId;
      const list = document.getElementById(`inits-${id}`);
      if (collapsedMissions.has(id)) {
        collapsedMissions.delete(id);
        list.style.display = '';
        e.currentTarget.textContent = '▼';
        e.currentTarget.title = 'Collapse';
      } else {
        collapsedMissions.add(id);
        list.style.display = 'none';
        e.currentTarget.textContent = '▶';
        e.currentTarget.title = 'Expand';
      }
    });
  });

  // Mission owner
  container.querySelectorAll('.mission-owner-select').forEach(sel => {
    sel.addEventListener('change', e => {
      store.updateMission(e.target.dataset.missionId, { ownerId: e.target.value });
    });
  });

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

  // Clone
  container.querySelectorAll('.clone-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const row = e.target.closest('[data-init-id]');
      const id = row.dataset.initId;
      const src = store.getInitiatives().find(x => x.id === id);
      if (!src) return;
      store.addInitiative({
        missionId:   src.missionId,
        title:       src.title + ' (copy)',
        roleEfforts: { ...src.roleEfforts },
        target:      src.target,
        notes:       src.notes,
        isStretch:   src.isStretch
      });
      render();
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
  if (el) renderByRole(el, store.committedEffortByRole(), store.capacityByRole());
}

function openJiraImportModal() {
  const settings = store.getSettings();
  const quarter = store.getState().meta.quarterLabel || '';
  const defaultJql = settings.jiraJql ||
    `project IN (10033) AND type IN (Epic) AND "Quarter[Checkboxes]" In ("${quarter}") ORDER BY Rank ASC`;
  const missions = store.getMissions();

  if (!settings.jiraEmail || !settings.jiraToken) {
    modal.open({
      title: 'Jira not configured',
      html: `<p style="color:var(--text-muted);font-size:.88rem">
        Please configure your Jira credentials on the <strong>Setup</strong> screen (step 1) first.
      </p>
      <div style="display:flex;justify-content:flex-end;margin-top:1rem">
        <button class="btn btn-primary" onclick="document.getElementById('modal-close-btn').click()">OK</button>
      </div>`
    });
    return;
  }

  const missionOpts = missions.map(m =>
    `<option value="${m.id}">${esc(m.title || '—')}</option>`
  ).join('');

  modal.open({
    title: 'Import from Jira',
    html: `
      <div style="display:flex;flex-direction:column;gap:.75rem">
        <div>
          <label class="form-label">JQL Query</label>
          <input id="bdj-jql" class="form-input" style="width:100%" value="${esc(defaultJql)}">
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-ghost" id="bdj-fetch">Fetch Issues</button>
        </div>
        <div id="bdj-status" style="min-height:1rem;font-size:.82rem"></div>
        <div id="bdj-preview" style="display:none">
          <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem" id="bdj-count"></div>
          <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
            <table style="width:100%;border-collapse:collapse;font-size:.82rem" id="bdj-table">
              <thead>
                <tr style="border-bottom:1px solid var(--border);background:var(--surface3)">
                  <th style="padding:.4rem .6rem;width:28px"><input type="checkbox" id="bdj-check-all" checked></th>
                  <th style="padding:.4rem .6rem;text-align:left">Epic</th>
                  <th style="padding:.4rem .6rem;text-align:left;width:180px">Mission</th>
                </tr>
              </thead>
              <tbody id="bdj-tbody"></tbody>
            </table>
          </div>
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:.25rem">
          <button class="btn btn-ghost" id="bdj-cancel">Cancel</button>
          <button class="btn btn-primary" id="bdj-import" style="display:none">Import Selected</button>
        </div>
      </div>`
  });

  let _fetched = [];

  document.getElementById('bdj-cancel').addEventListener('click', () => modal.close());

  document.getElementById('bdj-check-all').addEventListener('change', e => {
    document.querySelectorAll('.bdj-row-check').forEach(cb => { cb.checked = e.target.checked; });
  });

  document.getElementById('bdj-fetch').addEventListener('click', async () => {
    const jql = document.getElementById('bdj-jql').value.trim();
    const statusEl = document.getElementById('bdj-status');
    const fetchBtn = document.getElementById('bdj-fetch');
    if (!jql) return;

    fetchBtn.disabled = true; fetchBtn.textContent = 'Fetching…';
    statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Connecting to Jira…';
    document.getElementById('bdj-preview').style.display = 'none';
    document.getElementById('bdj-import').style.display = 'none';

    try {
      _fetched = await fetchIssues({ domain: JIRA_DOMAIN, email: settings.jiraEmail, token: settings.jiraToken, jql });
      store.updateSettings({ jiraJql: jql });

      if (!_fetched.length) {
        statusEl.style.color = 'var(--yellow)'; statusEl.textContent = 'No issues found.';
      } else {
        statusEl.textContent = '';
        document.getElementById('bdj-count').textContent =
          `${_fetched.length} issue${_fetched.length !== 1 ? 's' : ''} found — select a mission for each`;
        document.getElementById('bdj-tbody').innerHTML = _fetched.map((issue, i) => `
          <tr style="border-bottom:1px solid var(--border-subtle)" data-idx="${i}">
            <td style="padding:.35rem .6rem"><input type="checkbox" class="bdj-row-check" checked></td>
            <td style="padding:.35rem .6rem">
              <span style="color:var(--text-muted);margin-right:.4rem;font-size:.75rem">${esc(issue.key)}</span>
              ${esc(issue.title)}
              <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.25rem">
                ${issue.owner ? `<span style="font-size:.73rem;color:var(--text-soft)">👤 ${esc(issue.owner)}</span>` : ''}
                ${issue.components ? `<span style="font-size:.73rem;color:var(--text-soft)">🏷 ${esc(issue.components)}</span>` : ''}
              </div>
            </td>
            <td style="padding:.35rem .6rem">
              <select class="tbl-input tbl-select bdj-mission-select" style="width:100%;font-size:.78rem">
                <option value="">— unassigned —</option>
                ${missionOpts}
              </select>
            </td>
          </tr>`).join('');
        document.getElementById('bdj-preview').style.display = 'block';
        document.getElementById('bdj-import').style.display = '';
      }
    } catch (err) {
      statusEl.style.color = 'var(--red)'; statusEl.textContent = err.message;
    } finally {
      fetchBtn.disabled = false; fetchBtn.textContent = 'Fetch Issues';
    }
  });

  document.getElementById('bdj-import').addEventListener('click', () => {
    const rows = document.querySelectorAll('#bdj-tbody tr');
    let added = 0;
    rows.forEach(row => {
      const checked = row.querySelector('.bdj-row-check')?.checked;
      if (!checked) return;
      const idx = parseInt(row.dataset.idx, 10);
      const missionId = row.querySelector('.bdj-mission-select')?.value || '';
      const issue = _fetched[idx];
      if (!issue) return;
      store.addInitiative({
        missionId,
        title: issue.title,
        notes: issue.description || ''
      });
      added++;
    });
    modal.close();
    render();
    if (added) {
      const missionId = document.querySelector('#bdj-tbody .bdj-mission-select')?.value;
      if (missionId) {
        const list = document.getElementById(`inits-${missionId}`);
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
