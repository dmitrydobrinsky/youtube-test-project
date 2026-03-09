// step1-wishlist.js — Wish List step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as sheet from '../utils/sheetjs-adapter.js';
import { fetchFromSharedUrl } from '../utils/drive-picker.js';
import { openMapper, applyMapping, autoMap } from '../components/column-mapper.js';
import * as modal from '../components/modal.js';
import { fetchIssues } from '../utils/jira-adapter.js';

const PRIORITIES = ['', 'High', 'Medium', 'Low'];

export function init() {
  wizard.registerGuard(2, () => store.getMissions().length > 0);
  render();
  bindEvents();
}

function render() {
  const missions = store.getMissions();
  const tbody = document.getElementById('wl-tbody');
  if (!tbody) return;
  tbody.innerHTML = missions.map((m, i) => rowHTML(m, i)).join('');
  bindRowEvents();
  updateCount();
}

function rowHTML(m) {
  const prioOpts = PRIORITIES.map(p =>
    `<option value="${p}" ${m.priority === p ? 'selected' : ''}>${p || '—'}</option>`
  ).join('');
  return `
    <tr data-id="${m.id}">
      <td class="drag-handle" title="Drag to reorder">⠿</td>
      <td><input class="tbl-input" data-field="title" value="${esc(m.title)}"></td>
      <td><input class="tbl-input" data-field="description" value="${esc(m.description)}"></td>
      <td>
        <button class="icon-btn del-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
}

function bindEvents() {
  // Add row
  document.getElementById('wl-add-row').addEventListener('click', () => {
    store.addMission({ title: '', description: '', owner: '', priority: '' });
    render();
    // focus last title input
    const rows = document.querySelectorAll('#wl-tbody tr');
    if (rows.length) rows[rows.length - 1].querySelector('[data-field="title"]')?.focus();
  });

  // Upload button
  document.getElementById('wl-upload-btn').addEventListener('click', () => {
    document.getElementById('wl-file-input').click();
  });

  document.getElementById('wl-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) await handleFile(file);
    e.target.value = '';
  });

  // Drive button — shared link flow
  document.getElementById('wl-drive-btn').addEventListener('click', () => {
    modal.open({
      title: 'Import from Google Drive',
      html: `
        <p style="margin-bottom:.75rem;color:var(--text-muted);font-size:.85rem">
          In Google Sheets, click <strong>Share → Anyone with the link → Viewer</strong>,
          then copy and paste the link below.
        </p>
        <label class="form-label">Shared link</label>
        <input id="drive-link-input" class="form-input" style="width:100%;margin-bottom:1rem"
          placeholder="https://docs.google.com/spreadsheets/d/…">
        <div id="drive-link-status" style="min-height:1.1rem;font-size:.82rem;margin-bottom:.75rem"></div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end">
          <button class="btn btn-ghost" id="drive-link-cancel">Cancel</button>
          <button class="btn btn-primary" id="drive-link-import">⬇ Import</button>
        </div>`
    });

    document.getElementById('drive-link-cancel').addEventListener('click', () => modal.close());
    document.getElementById('drive-link-import').addEventListener('click', async () => {
      const url = document.getElementById('drive-link-input').value.trim();
      if (!url) return;
      const statusEl = document.getElementById('drive-link-status');
      const btn = document.getElementById('drive-link-import');
      btn.disabled = true; btn.textContent = 'Fetching…';
      statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Downloading…';
      try {
        const file = await fetchFromSharedUrl(url);
        modal.close();
        await handleFile(file);
      } catch (err) {
        statusEl.style.color = 'var(--red)'; statusEl.textContent = err.message;
        btn.disabled = false; btn.textContent = '⬇ Import';
      }
    });
  });

  // Jira import
  document.getElementById('wl-jira-btn').addEventListener('click', () => openJiraModal());

  // Delete all
  document.getElementById('wl-clear-btn').addEventListener('click', async () => {
    const count = store.getMissions().length;
    if (!count) return;
    const ok = await modal.confirm(`Delete all ${count} mission(s)?`);
    if (ok) { store.setMissions([]); render(); }
  });

  // Drag-and-drop zone
  const zone = document.getElementById('wl-drop-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  });

  // Quarter selector — current quarter + next 3
  const qlSelect = document.getElementById('wl-quarter-label');
  if (qlSelect) {
    const quarters = nextFourQuarters();
    const saved = store.getState().meta.quarterLabel || quarters[0];
    qlSelect.innerHTML = quarters.map(q =>
      `<option value="${q}" ${q === saved ? 'selected' : ''}>${q}</option>`
    ).join('');
    if (!store.getState().meta.quarterLabel) store.setQuarterLabel(quarters[0]);
    qlSelect.addEventListener('change', e => store.setQuarterLabel(e.target.value));
  }

  // Re-render on step change
  document.addEventListener('stepchange', e => {
    if (e.detail.step === 2) render();
  });
}

function bindRowEvents() {
  const tbody = document.getElementById('wl-tbody');

  // Inline edit
  tbody.querySelectorAll('.tbl-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      store.updateMission(id, { [e.target.dataset.field]: e.target.value });
    });
    // live update for inputs
    if (inp.tagName === 'INPUT') {
      inp.addEventListener('input', e => {
        const row = e.target.closest('tr');
        const id = row.dataset.id;
        store.updateMission(id, { [e.target.dataset.field]: e.target.value });
        updateCount();
      });
    }
  });

  // Delete
  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const ok = await modal.confirm('Delete this mission?');
      if (ok) { store.deleteMission(id); render(); }
    });
  });

  // Drag-to-reorder rows
  if (window.Sortable) {
    Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: () => {
        const ids = [...tbody.querySelectorAll('tr')].map(r => r.dataset.id);
        const missions = store.getMissions();
        const reordered = ids.map(id => missions.find(m => m.id === id)).filter(Boolean);
        store.setMissions(reordered);
      }
    });
  }
}

async function handleFile(file) {
  try {
    const hasHeader = document.getElementById('wl-has-header')?.checked !== false;
    const { rows, headers } = await sheet.parseFile(file, hasHeader);
    if (!rows.length) { alert('No data found in file.'); return; }

    const autoMapped = autoMap(headers);
    // If title column is not obvious, open mapper
    let mapping = autoMapped;
    if (!autoMapped.title) {
      mapping = await openMapper(headers);
      if (!mapping) return; // cancelled
    }

    const missions = applyMapping(rows, mapping);
    if (!missions.length) { alert('No valid missions found. Make sure there is a Title/Mission column.'); return; }

    const existing = store.getMissions();
    if (existing.length > 0) {
      const ok = await modal.confirm(`Replace ${existing.length} existing missions with ${missions.length} imported rows?`);
      if (!ok) {
        missions.forEach(m => store.addMission(m));
      } else {
        store.setMissions([]);
        missions.forEach(m => store.addMission(m));
      }
    } else {
      missions.forEach(m => store.addMission(m));
    }
    render();
  } catch (err) {
    alert('Failed to parse file: ' + err.message);
  }
}


const JIRA_DOMAIN = 'onebeat.atlassian.net';

function openJiraModal() {
  const saved = store.getSettings();
  const email = saved.jiraEmail || '';
  const token = saved.jiraToken || '';
  const jql   = saved.jiraJql   || 'project IN (10033) AND type IN (Epic) AND "Quarter[Checkboxes]" In ("Q2 2026") ORDER BY Rank ASC';

  modal.open({
    title: 'Import from Jira',
    html: `
      <div style="display:flex;flex-direction:column;gap:.75rem">
        <div>
          <label class="form-label">Jira domain</label>
          <input class="form-input" style="width:100%;color:var(--text-muted)" value="${esc(JIRA_DOMAIN)}" disabled>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
          <div>
            <label class="form-label">Email</label>
            <input id="jira-email" class="form-input" style="width:100%"
              type="email" placeholder="you@example.com" value="${esc(email)}">
          </div>
          <div>
            <label class="form-label">
              API token
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank" rel="noopener"
                style="font-size:.75rem;margin-left:.4rem;color:var(--primary)">Get token ↗</a>
            </label>
            <input id="jira-token" class="form-input" style="width:100%"
              type="password" placeholder="••••••••" value="${esc(token)}">
          </div>
        </div>
        <div>
          <label class="form-label">JQL query</label>
          <input id="jira-jql" class="form-input" style="width:100%" value="${esc(jql)}">
        </div>
        <div id="jira-status" style="min-height:1.1rem;font-size:.82rem"></div>
        <div id="jira-preview" style="display:none">
          <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.4rem" id="jira-preview-count"></div>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:.5rem;font-size:.82rem" id="jira-preview-list"></div>
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:.25rem">
          <button class="btn btn-ghost" id="jira-cancel">Cancel</button>
          <button class="btn btn-ghost" id="jira-fetch">Fetch Issues</button>
          <button class="btn btn-primary" id="jira-import" style="display:none">Import</button>
        </div>
      </div>`
  });

  let _fetchedIssues = [];

  document.getElementById('jira-cancel').addEventListener('click', () => modal.close());

  document.getElementById('jira-fetch').addEventListener('click', async () => {
    const emailVal = document.getElementById('jira-email').value.trim();
    const tokenVal = document.getElementById('jira-token').value.trim();
    const jqlVal   = document.getElementById('jira-jql').value.trim();
    const statusEl = document.getElementById('jira-status');
    const fetchBtn = document.getElementById('jira-fetch');

    if (!emailVal || !tokenVal || !jqlVal) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = 'Please fill in all fields.';
      return;
    }

    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching…';
    statusEl.style.color = 'var(--text-muted)';
    statusEl.textContent = 'Connecting to Jira…';
    document.getElementById('jira-preview').style.display = 'none';
    document.getElementById('jira-import').style.display = 'none';

    try {
      _fetchedIssues = await fetchIssues({ domain: JIRA_DOMAIN, email: emailVal, token: tokenVal, jql: jqlVal });
      store.updateSettings({ jiraEmail: emailVal, jiraToken: tokenVal, jiraJql: jqlVal });

      statusEl.textContent = '';
      document.getElementById('jira-preview-count').textContent =
        `${_fetchedIssues.length} issue${_fetchedIssues.length !== 1 ? 's' : ''} found`;
      document.getElementById('jira-preview-list').innerHTML = _fetchedIssues
        .map(i => `<div style="padding:.25rem 0;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          <span style="color:var(--text-muted);margin-right:.4rem">${esc(i.key)}</span>${esc(i.title)}
        </div>`).join('');
      document.getElementById('jira-preview').style.display = 'block';
      document.getElementById('jira-import').style.display = '';
    } catch (err) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = err.message;
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = 'Fetch Issues';
    }
  });

  document.getElementById('jira-import').addEventListener('click', async () => {
    if (!_fetchedIssues.length) return;
    const existing = store.getMissions();
    if (existing.length > 0) {
      const ok = await modal.confirm(`Replace ${existing.length} existing mission(s) with ${_fetchedIssues.length} Jira issue(s)?`);
      if (ok) store.setMissions([]);
      else if (ok === false) { /* append */ }
      else return;
    }
    modal.close();
    _fetchedIssues.forEach(i => store.addMission({ title: i.title, description: i.description, priority: i.priority, owner: i.owner }));
    render();
  });
}

function updateCount() {
  const el = document.getElementById('wl-count');
  if (el) el.textContent = `${store.getMissions().length} mission(s)`;
}

function nextFourQuarters() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3); // current quarter (1-4)
  const result = [];
  for (let i = 0; i < 4; i++) {
    let qn = q + i, yn = year;
    if (qn > 4) { qn -= 4; yn++; }
    result.push(`Q${qn} ${yn}`);
  }
  return result;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
