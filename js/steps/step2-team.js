// step2-team.js — Team Setup step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';
import * as gauge from '../components/capacity-gauge.js';
import { refreshAccessToken, fetchEmployees, fetchTimeAway } from '../utils/shapes-adapter.js';
import { countWorkingDays, quarterToDateRange, clampDate } from '../utils/holidays.js';

const ROLES = ['Algo', 'Data', 'BI', 'DevOps', 'Fullstack'];

export function init() {
  wizard.registerGuard(2, () => store.getTeam().length > 0);
  bindEvents();
  document.addEventListener('stepchange', e => { if (e.detail.step === 2) render(); });
}

function render() {
  const team = store.getTeam();
  const tbody = document.getElementById('team-tbody');
  if (!tbody) return;
  tbody.innerHTML = team.map(m => memberRow(m)).join('');
  bindRowEvents();
  renderSummary();
  applyTeamSearch();
}

function applyTeamSearch() {
  const q = (document.getElementById('team-search')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#team-tbody tr').forEach(row => {
    const name = row.querySelector('[data-field="name"]')?.value.toLowerCase() || '';
    row.style.display = !q || name.includes(q) ? '' : 'none';
  });
}

function memberRow(m) {
  const roleOpts = ROLES.map(r =>
    `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`
  ).join('');
  const subtitle = [m.role, m.team, m.country].filter(Boolean).join(' · ');
  return `
    <tr data-id="${m.id}">
      <td>
        <input class="tbl-input" data-field="name" value="${esc(m.name)}">
        ${subtitle ? `<div style="font-size:.72rem;color:var(--text-muted);padding-left:.4rem">${esc(subtitle)}</div>` : ''}
      </td>
      <td>
        <select class="tbl-input tbl-select" data-field="role">${roleOpts}</select>
      </td>
      <td>
        <input class="tbl-input" data-field="capacityPct" type="number" min="10" max="100" step="10"
          value="${m.capacityPct}" style="width:70px">%
      </td>
      <td>
        <input class="tbl-input" data-field="availableWeeks" type="number" min="1" max="13" step="1"
          value="${m.availableWeeks}" style="width:60px"> wks
      </td>
      <td>
        <span style="font-weight:600;color:var(--accent)">${m.personDays} days</span>
        ${m.workingDays != null ? `
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem" title="Working days breakdown">
          ${m.workingDays}d
          ${m.holidayDays  ? `<span style="color:var(--yellow)"> − ${m.holidayDays} holidays</span>` : ''}
          ${m.vacationDays ? `<span style="color:var(--red)"> − ${m.vacationDays} vacation</span>` : ''}
          ${m.reserveDays  ? `<span style="color:var(--accent)"> − ${m.reserveDays} reserve</span>` : ''}
        </div>` : ''}
      </td>
      <td><button class="icon-btn del-btn" title="Remove">🗑</button></td>
    </tr>`;
}

function bindEvents() {
  document.getElementById('team-add-btn').addEventListener('click', () => {
    store.addTeamMember({ name: '', role: 'Fullstack', capacityPct: 100, availableWeeks: 13 });
    render();
    const rows = document.querySelectorAll('#team-tbody tr');
    if (rows.length) rows[rows.length - 1].querySelector('[data-field="name"]')?.focus();
  });

  document.getElementById('team-shapes-btn').addEventListener('click', openShapesImport);

  document.getElementById('team-sync-days-btn').addEventListener('click', syncHolidaysAndVacations);
  document.getElementById('team-search').addEventListener('input', applyTeamSearch);

  document.getElementById('team-clear-btn').addEventListener('click', async () => {
    const team = store.getTeam();
    if (!team.length) return;
    const ok = await modal.confirm(`Remove all ${team.length} team members?`);
    if (ok) { team.forEach(m => store.deleteTeamMember(m.id)); render(); }
  });
}

// ── Shapes.co import dialog ───────────────────────────────────────────────────

function openShapesImport() {
  const settings = store.getSettings();

  modal.open({
    title: 'Import employees from Shapes.co',
    html: `
      <p style="margin-bottom:1rem;color:var(--text-muted);font-size:.85rem">
        Fetches all employees from your Shapes.co account via the GraphQL API.
      </p>

      <label class="form-label">Refresh Token <span style="color:var(--text-muted)">(long-lived)</span></label>
      <input id="shapes-refresh" class="form-input" type="password"
        style="width:100%;margin-bottom:.75rem;font-family:monospace;font-size:.75rem"
        placeholder="eyJ…" value="${esc(settings.shapesRefreshToken || '')}">

      <label class="form-label">Access Token <span style="color:var(--text-muted)">(optional — auto-refreshed if blank)</span></label>
      <input id="shapes-access" class="form-input" type="password"
        style="width:100%;margin-bottom:1rem;font-family:monospace;font-size:.75rem"
        placeholder="eyJ…" value="${esc(settings.shapesAccessToken || '')}">

      <div id="shapes-status" style="min-height:1.2rem;font-size:.82rem;margin-bottom:.75rem"></div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn btn-ghost" id="shapes-cancel">Cancel</button>
        <button class="btn btn-primary" id="shapes-fetch">⬇ Fetch Employees</button>
      </div>`
  });

  document.getElementById('shapes-cancel').addEventListener('click', () => modal.close());
  document.getElementById('shapes-fetch').addEventListener('click', doFetch);
}

async function doFetch() {
  const refreshInput = document.getElementById('shapes-refresh').value.trim();
  const accessInput  = document.getElementById('shapes-access').value.trim();

  if (!refreshInput && !accessInput) {
    setStatus('error', 'Please enter at least a Refresh Token or Access Token.');
    return;
  }

  const btn = document.getElementById('shapes-fetch');
  btn.disabled = true; btn.textContent = 'Fetching…';

  try {
    let accessToken = accessInput;
    let refreshToken = refreshInput;

    // Step 1: if we have a refresh token, get a fresh access token
    if (refreshToken) {
      setStatus('info', 'Refreshing access token…');
      try {
        const tokens = await refreshAccessToken(refreshToken);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken; // may be rotated
        setStatus('info', 'Token refreshed. Fetching employees…');
      } catch (e) {
        if (!accessToken) throw new Error('Token refresh failed: ' + e.message);
        setStatus('info', 'Refresh failed, trying existing access token…');
      }
    } else {
      setStatus('info', 'Fetching employees…');
    }

    // Step 2: fetch employees
    const employees = await fetchEmployees(accessToken);

    // Save tokens for next session
    store.updateSettings({
      shapesRefreshToken: refreshToken || refreshInput,
      shapesAccessToken: accessToken
    });

    if (!employees.length) {
      setStatus('error', 'No active employees found.');
      btn.disabled = false; btn.textContent = '⬇ Fetch Employees';
      return;
    }

    setStatus('success', `Found ${employees.length} employees.`);

    // Step 3: show preview & confirm
    await showImportPreview(employees);

  } catch (err) {
    setStatus('error', err.message);
    btn.disabled = false; btn.textContent = '⬇ Fetch Employees';
  }
}

async function showImportPreview(employees) {
  const active = employees.filter(e =>
    !e.workStatus || ['active','Active',''].includes(e.workStatus)
  );

  // Build recursive subordinate lookup: managerId → Set of all subordinate shapesIds
  const directReports = {}; // managerId → [employee, ...]
  active.forEach(e => {
    if (e.managerId) {
      (directReports[e.managerId] = directReports[e.managerId] || []).push(e);
    }
  });

  function getAllSubordinates(managerId, visited = new Set()) {
    if (visited.has(managerId)) return new Set(); // cycle guard
    visited.add(managerId);
    const result = new Set();
    (directReports[managerId] || []).forEach(e => {
      result.add(e.shapesId);
      getAllSubordinates(e.shapesId, visited).forEach(id => result.add(id));
    });
    return result;
  }

  // Only list managers who actually have reports (direct or indirect)
  const managerSet = new Set(active.map(e => e.managerId).filter(Boolean));
  const managerEmployees = active.filter(e => managerSet.has(e.shapesId));
  const managers = ['All managers', ...managerEmployees.map(e => e.name).sort()];

  // Build filter options
  const teams = ['All teams', ...new Set(active.map(e => e.team).filter(Boolean))].sort();

  modal.open({
    title: `Import employees (${active.length} found)`,
    html: `
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
        <input id="emp-search" class="form-input" placeholder="🔍 Filter by name…" style="flex:1;min-width:130px">
        <select id="emp-team-filter" class="form-input" style="width:auto;min-width:120px">
          ${teams.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <select id="emp-manager-filter" class="form-input" style="width:auto;min-width:140px">
          ${managers.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <span id="emp-count" style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${active.length} shown</span>
      </div>
      <div style="max-height:320px;overflow-y:auto;margin-bottom:1rem">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead style="position:sticky;top:0;background:var(--surface)">
            <tr style="border-bottom:1px solid var(--border)">
              <th style="padding:.35rem;text-align:left;width:28px"><input type="checkbox" id="select-all" checked></th>
              <th style="padding:.35rem;text-align:left">Name</th>
              <th style="padding:.35rem;text-align:left">Job / Team</th>
              <th style="padding:.35rem;text-align:left">Manager</th>
              <th style="padding:.35rem;text-align:left">Role</th>
            </tr>
          </thead>
          <tbody id="emp-tbody">
            ${active.map((e, i) => empRow(e, i)).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:.75rem;justify-content:flex-end;align-items:center">
        <button class="btn btn-ghost" id="import-cancel">Cancel</button>
        <button class="btn btn-primary" id="import-confirm">Import ${active.length} employees</button>
      </div>`
  });

  function updateImportBtn() {
    const checked = document.querySelectorAll('.emp-check:checked').length;
    const btn = document.getElementById('import-confirm');
    if (btn) {
      btn.textContent = checked > 0 ? `Import ${checked} employee${checked === 1 ? '' : 's'}` : 'Import Selected';
      btn.disabled = checked === 0;
    }
  }

  function applyFilters() {
    const q       = document.getElementById('emp-search').value.toLowerCase().trim();
    const team    = document.getElementById('emp-team-filter').value;
    const manager = document.getElementById('emp-manager-filter').value;

    // Resolve full subtree for the selected manager
    let subordinateIds = null;
    if (manager !== 'All managers') {
      const mgr = active.find(e => e.name === manager);
      if (mgr) subordinateIds = getAllSubordinates(mgr.shapesId);
    }

    const rows  = document.querySelectorAll('#emp-tbody tr');
    let visible = 0;
    rows.forEach(row => {
      const name      = row.querySelector('.emp-name')?.textContent.toLowerCase() || '';
      const nameMatch = !q || name.includes(q);
      const teamMatch = team === 'All teams' || (row.dataset.team || '') === team;
      const mgrMatch  = !subordinateIds || subordinateIds.has(row.dataset.shapesid || '');
      const show = nameMatch && teamMatch && mgrMatch;
      row.style.display = show ? '' : 'none';
      // auto-check visible, uncheck hidden
      row.querySelector('.emp-check').checked = show;
      if (show) visible++;
    });
    document.getElementById('emp-count').textContent = `${visible} shown`;
    document.getElementById('select-all').checked = visible > 0;
    updateImportBtn();
  }

  // Listen for individual checkbox changes to update button count
  document.getElementById('emp-tbody').addEventListener('change', e => {
    if (e.target.classList.contains('emp-check')) {
      const rows = document.querySelectorAll('#emp-tbody tr');
      const visibleRows = [...rows].filter(r => r.style.display !== 'none');
      document.getElementById('select-all').checked =
        visibleRows.length > 0 && visibleRows.every(r => r.querySelector('.emp-check')?.checked);
      updateImportBtn();
    }
  });

  document.getElementById('emp-search').addEventListener('input', applyFilters);
  document.getElementById('emp-team-filter').addEventListener('change', applyFilters);
  document.getElementById('emp-manager-filter').addEventListener('change', applyFilters);

  // Select all (only visible rows)
  document.getElementById('select-all').addEventListener('change', e => {
    document.querySelectorAll('#emp-tbody tr').forEach(row => {
      if (row.style.display !== 'none') {
        row.querySelector('.emp-check').checked = e.target.checked;
      }
    });
    updateImportBtn();
  });

  document.getElementById('import-cancel').addEventListener('click', () => modal.close());

  document.getElementById('import-confirm').addEventListener('click', () => {
    const selected = [];
    document.querySelectorAll('.emp-check:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.idx);
      const roleEl = document.querySelector(`.emp-role[data-idx="${idx}"]`);
      selected.push({ ...active[idx], role: roleEl?.value || active[idx].role });
    });

    if (!selected.length) { alert('No employees selected.'); return; }

    store.getTeam().forEach(m => store.deleteTeamMember(m.id));
    selected.forEach(e => store.addTeamMember({
      name:           e.name,
      role:           e.role,
      jobTitle:       e.jobTitle || '',
      team:           e.team || '',
      email:          e.email || '',
      country:        e.country || '',
      shapesId:       e.shapesId || null,
      capacityPct:    100,
      availableWeeks: 13
    }));

    modal.close();
    render();
    syncHolidaysAndVacations();
  });
}

function empRow(e, i) {
  return `
    <tr style="border-bottom:1px solid var(--border)"
        data-team="${esc(e.team || '')}"
        data-manager="${esc(e.managerName || '')}"
        data-shapesid="${esc(e.shapesId || '')}">
      <td style="padding:.3rem"><input type="checkbox" class="emp-check" data-idx="${i}" checked></td>
      <td style="padding:.3rem">
        <strong class="emp-name">${esc(e.name)}</strong>
        <div style="font-size:.72rem;color:var(--text-muted)">${esc(e.email)}</div>
      </td>
      <td style="padding:.3rem;font-size:.78rem;color:var(--text-muted)">
        ${esc([e.jobTitle, e.team].filter(Boolean).join(' · ') || '—')}
      </td>
      <td style="padding:.3rem;font-size:.78rem;color:var(--text-muted)">
        ${esc(e.managerName || '—')}
      </td>
      <td style="padding:.3rem">
        <select class="tbl-input tbl-select emp-role" data-idx="${i}" style="width:auto;font-size:.78rem">
          ${ROLES.map(r => `<option value="${r}" ${r === e.role ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </td>
    </tr>`;
}

function setStatus(type, msg) {
  const el = document.getElementById('shapes-status');
  if (!el) return;
  const colors = { error: 'var(--red)', success: 'var(--green)', info: 'var(--text-muted)' };
  el.style.color = colors[type];
  el.textContent = msg;
}

// ── Row events ────────────────────────────────────────────────────────────────


async function syncHolidaysAndVacations() {
  const team = store.getTeam();
  if (!team.length) { alert('No team members to sync.'); return; }

  const quarterLabel = store.getState().meta.quarterLabel;
  const range = quarterToDateRange(quarterLabel);
  if (!range) { alert('Please select a quarter on Step 1 first.'); return; }

  const settings = store.getSettings();
  if (!settings.shapesAccessToken && !settings.shapesRefreshToken) {
    alert('No Shapes.co token found. Import your team from Shapes.co first.');
    return;
  }

  const btn = document.getElementById('team-sync-days-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Syncing…';

  const startISO = range.start.toISOString().slice(0, 10);
  const endISO   = range.end.toISOString().slice(0, 10);

  try {
    // Refresh token if needed
    let accessToken = settings.shapesAccessToken;
    if (settings.shapesRefreshToken) {
      try {
        const tokens = await refreshAccessToken(settings.shapesRefreshToken);
        accessToken = tokens.accessToken;
        store.updateSettings({ shapesAccessToken: tokens.accessToken, shapesRefreshToken: tokens.refreshToken });
      } catch (e) { /* use existing access token */ }
    }

    // Fetch all time-away bookings + reasons from Shapes in one call
    const shapesIds = team.map(m => m.shapesId).filter(Boolean);
    if (!shapesIds.length) {
      alert('Team members have no Shapes ID. Please re-import the team from Shapes.co first.');
      btn.disabled = false; btn.textContent = '📅 Sync Holidays & Vacations';
      return;
    }
    const { bookings, reasonCategory } = await fetchTimeAway(accessToken, shapesIds, startISO, endISO);

    console.log('[Sync] quarter:', startISO, '→', endISO);
    console.log('[Sync] shapesIds:', shapesIds);
    console.log('[Sync] total bookings returned:', bookings.length);
    console.log('[Sync] reasonCategory:', reasonCategory);
    bookings.forEach(b => console.log('[Booking]', b.employeeId, b.fromStr, '→', b.toStr, b.bookingStatus, 'reason:', b.timeAwayReasonId));

    // Tally days per employee per category — clamp bookings to quarter window
    const maps = { vacation: {}, holiday: {}, reserve: {} };

    bookings
      .filter(b => {
        if (!['approved', 'Approved'].includes(b.bookingStatus)) return false;
        if (!b.fromStr || !b.toStr) return false;
        return b.fromStr <= endISO && b.toStr >= startISO;
      })
      .forEach(b => {
        const from = clampDate(b.fromStr, startISO, endISO);
        const to   = clampDate(b.toStr,   startISO, endISO);
        const days = countWorkingDays(from, to);
        const cat  = reasonCategory[b.timeAwayReasonId] || 'vacation';
        const id   = String(b.employeeId);
        maps[cat][id] = (maps[cat][id] || 0) + days;
        console.log('[Sync] mapped:', id, cat, from, '→', to, '=', days, 'days');
      });

    // Total working days in the quarter (Mon–Fri, no adjustments)
    const totalWorkingDays = countWorkingDays(range.start, range.end);
    console.log('[Sync] totalWorkingDays:', totalWorkingDays);

    // Update each team member
    team.forEach(m => {
      const id          = String(m.shapesId);
      const holidayDays  = maps.holiday[id]  || 0;
      const vacationDays = maps.vacation[id] || 0;
      const reserveDays  = maps.reserve[id]  || 0;
      const workingDays  = totalWorkingDays - holidayDays;
      const netDays      = Math.max(0, workingDays - vacationDays - reserveDays);
      const personDays   = Math.round(netDays * m.capacityPct / 100);

      console.log(`[Sync] ${m.name} | shapesId:${id} | working:${workingDays} holiday:${holidayDays} vacation:${vacationDays} reserve:${reserveDays} net:${netDays} → ${personDays}d`);

      store.updateTeamMember(m.id, {
        workingDays,
        holidayDays,
        vacationDays,
        reserveDays,
        personDays,
        availableWeeks: parseFloat((netDays / 5).toFixed(1))
      });
    });

    render();
  } catch (err) {
    alert('Sync failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📅 Sync Holidays & Vacations';
  }
}

function bindRowEvents() {
  const tbody = document.getElementById('team-tbody');

  tbody.querySelectorAll('.tbl-input').forEach(inp => {
    const event = inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(event, e => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const field = e.target.dataset.field;
      const val = ['capacityPct','availableWeeks'].includes(field)
        ? Number(e.target.value) : e.target.value;
      store.updateTeamMember(id, { [field]: val });
      const m = store.getTeam().find(x => x.id === id);
      if (m) row.querySelector('td:nth-child(5)').textContent = m.personDays + ' days';
      renderSummary();
    });
  });

  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const ok = await modal.confirm('Remove this team member?');
      if (ok) { store.deleteTeamMember(id); render(); }
    });
  });
}

function renderSummary() {
  const total = store.totalCapacity();
  const committed = store.committedEffort();
  const el = document.getElementById('team-gauge');
  if (el) gauge.render(el, committed, total);
  const sumEl = document.getElementById('team-total');
  if (sumEl) sumEl.textContent = `Total: ${store.getTeam().length} members · ${total} person-days available`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
