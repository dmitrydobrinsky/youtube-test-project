// step1-wishlist.js — Wish List step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as sheet from '../utils/sheetjs-adapter.js';
import { openDrivePicker } from '../utils/drive-picker.js';
import { openMapper, applyMapping, autoMap } from '../components/column-mapper.js';
import * as modal from '../components/modal.js';

const PRIORITIES = ['', 'High', 'Medium', 'Low'];

export function init() {
  wizard.registerGuard(1, () => store.getMissions().length > 0);
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
      <td><input class="tbl-input" data-field="owner" value="${esc(m.owner)}"></td>
      <td>
        <select class="tbl-input tbl-select" data-field="priority">${prioOpts}</select>
      </td>
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

  // Drive button
  document.getElementById('wl-drive-btn').addEventListener('click', async () => {
    const settings = store.getSettings();
    try {
      const file = await openDrivePicker(settings.googleClientId, settings.googleApiKey);
      await handleFile(file);
    } catch (err) {
      if (err.message !== 'cancelled') {
        if (err.message.includes('Client ID')) {
          showDriveSetup();
        } else {
          alert('Drive error: ' + err.message);
        }
      }
    }
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
    if (e.detail.step === 1) render();
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

function showDriveSetup() {
  modal.open({
    title: 'Google Drive Setup',
    html: `
      <p style="margin-bottom:1rem;color:var(--text-muted)">Enter your Google OAuth Client ID to enable Drive import.</p>
      <label class="form-label">Google Client ID</label>
      <input id="drive-client-id" class="form-input" style="width:100%;margin-bottom:.75rem"
        placeholder="xxx.apps.googleusercontent.com"
        value="${store.getSettings().googleClientId || ''}">
      <label class="form-label">Google API Key (optional)</label>
      <input id="drive-api-key" class="form-input" style="width:100%;margin-bottom:1.5rem"
        placeholder="AIza..."
        value="${store.getSettings().googleApiKey || ''}">
      <div style="display:flex;gap:1rem;justify-content:flex-end">
        <button class="btn btn-ghost" id="drive-cancel">Cancel</button>
        <button class="btn btn-primary" id="drive-save">Save & Connect</button>
      </div>`
  });
  document.getElementById('drive-save').addEventListener('click', () => {
    store.updateSettings({
      googleClientId: document.getElementById('drive-client-id').value.trim(),
      googleApiKey: document.getElementById('drive-api-key').value.trim()
    });
    modal.close();
    document.getElementById('wl-drive-btn').click();
  });
  document.getElementById('drive-cancel').addEventListener('click', () => modal.close());
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
