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
        <div class="name-cell">
          <div class="member-avatar-btn" data-member-id="${m.id}" style="cursor:pointer" title="View details">
            ${avatarHtml(m.name, m.email, m.profilePicture)}
          </div>
          <div class="name-cell-text">
            <input class="tbl-input" data-field="name" value="${esc(m.name)}">
            ${subtitle ? `<div style="font-size:.72rem;color:var(--text-muted);padding-left:.4rem">${esc(subtitle)}</div>` : ''}
          </div>
        </div>
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
        <div class="pd-tooltip-wrap" style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem">
          ${m.workingDays}d
          ${m.holidayDays  ? `<span style="color:var(--yellow)"> − ${m.holidayDays} holidays</span>` : ''}
          ${m.vacationDays ? `<span style="color:var(--red)"> − ${m.vacationDays} vacation</span>` : ''}
          ${m.reserveDays  ? `<span style="color:var(--accent)"> − ${m.reserveDays} reserve</span>` : ''}
          <div class="pd-tooltip">
            <div class="pd-tooltip-row"><span>Working days</span><span>${m.workingDays + (m.holidayDays || 0)}d</span></div>
            ${m.holidayDays  ? `<div class="pd-tooltip-row pd-holiday"><span>− Public holidays</span><span>${m.holidayDays}d</span></div>` : ''}
            ${m.vacationDays ? `<div class="pd-tooltip-row pd-vacation"><span>− Vacation</span><span>${m.vacationDays}d</span></div>` : ''}
            ${m.reserveDays  ? `<div class="pd-tooltip-row pd-reserve"><span>− Reserve duty</span><span>${m.reserveDays}d</span></div>` : ''}
            <div class="pd-tooltip-divider"></div>
            <div class="pd-tooltip-row pd-net"><span>Net available</span><span>${m.workingDays}d</span></div>
            ${m.capacityPct < 100 ? `<div class="pd-tooltip-row pd-cap"><span>× ${m.capacityPct}% capacity</span><span>${m.personDays}d</span></div>` : ''}
          </div>
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
      profilePicture: e.profilePicture || null,
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
        <div style="display:flex;align-items:center;gap:.45rem">
          ${avatarHtml(e.name, e.email, e.profilePicture)}
          <div>
            <strong class="emp-name">${esc(e.name)}</strong>
            <div style="font-size:.72rem;color:var(--text-muted)">${esc(e.email)}</div>
          </div>
        </div>
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

    // Filter to approved bookings that overlap the quarter
    const relevant = bookings.filter(b =>
      ['approved', 'Approved'].includes(b.bookingStatus) &&
      b.fromStr && b.toStr &&
      b.fromStr <= endISO && b.toStr >= startISO
    );

    // Update each team member using their own working-week schedule
    team.forEach(m => {
      const id        = String(m.shapesId);
      const workSet   = new Set(m.weekDays ?? defaultWeekDays(m.country));
      const totalWorkingDays = countWorkingDays(range.start, range.end, workSet);

      let holidayDays = 0, vacationDays = 0, reserveDays = 0;
      relevant.filter(b => String(b.employeeId) === id).forEach(b => {
        const from = clampDate(b.fromStr, startISO, endISO);
        const to   = clampDate(b.toStr,   startISO, endISO);
        const days = countWorkingDays(from, to, workSet);
        const cat  = reasonCategory[b.timeAwayReasonId] || 'vacation';
        if (cat === 'holiday')      holidayDays  += days;
        else if (cat === 'vacation') vacationDays += days;
        else if (cat === 'reserve')  reserveDays  += days;
        console.log('[Sync] mapped:', id, cat, from, '→', to, '=', days, 'days');
      });

      const workingDays = totalWorkingDays - holidayDays;
      const netDays     = Math.max(0, workingDays - vacationDays - reserveDays);
      const personDays  = Math.round(netDays * m.capacityPct / 100);

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

  tbody.querySelectorAll('.member-avatar-btn').forEach(btn => {
    btn.addEventListener('click', e => openMemberDetail(e.currentTarget.dataset.memberId));
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

// ── Member detail modal ───────────────────────────────────────────────────────

function openMemberDetail(memberId) {
  const m = store.getTeam().find(x => x.id === memberId);
  if (!m) return;

  const quarterLabel = store.getState().meta.quarterLabel;
  const range = quarterToDateRange(quarterLabel);

  modal.open({
    title: m.name || 'Team Member',
    html: `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
        ${avatarHtml(m.name, m.email, m.profilePicture)}
        <div>
          <div style="font-weight:600">${esc(m.name)}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${esc([m.role, m.team].filter(Boolean).join(' · '))}</div>
        </div>
      </div>

      <label class="form-label">Country</label>
      <input id="detail-country" class="form-input" style="margin-bottom:1.25rem"
        placeholder="e.g. Israel" value="${esc(m.country || '')}">

      ${buildWeekdayPicker(m)}

      <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.25rem">
        <button class="btn btn-ghost" id="detail-cancel">Cancel</button>
        <button class="btn btn-primary" id="detail-save">Save</button>
      </div>`
  });

  // Auto-update pills when country is typed
  document.getElementById('detail-country').addEventListener('input', e => {
    const days = new Set(defaultWeekDays(e.target.value));
    document.querySelectorAll('.wd-pill').forEach(p => {
      p.classList.toggle('active', days.has(parseInt(p.dataset.dow)));
    });
    _updateWeekdaySummary();
  });

  // Toggle individual day pill
  document.getElementById('weekday-picker').addEventListener('click', e => {
    const pill = e.target.closest('.wd-pill');
    if (!pill) return;
    pill.classList.toggle('active');
    _updateWeekdaySummary();
  });

  document.getElementById('detail-cancel').addEventListener('click', () => modal.close());
  document.getElementById('detail-save').addEventListener('click', () => {
    const country  = document.getElementById('detail-country').value.trim();
    const weekDays = [...document.querySelectorAll('.wd-pill.active')].map(p => parseInt(p.dataset.dow));
    const patch = { country, weekDays };

    if (range) {
      const workSet = new Set(weekDays);
      const totalWorkingDays = countWorkingDays(range.start, range.end, workSet);
      Object.assign(patch, {
        workingDays:    totalWorkingDays,
        personDays:     Math.round(totalWorkingDays * m.capacityPct / 100),
        availableWeeks: parseFloat((totalWorkingDays / 5).toFixed(1))
      });
    }

    store.updateTeamMember(memberId, patch);
    modal.close();
    render();
  });
}

function _updateWeekdaySummary() {
  const count = document.querySelectorAll('.wd-pill.active').length;
  const el = document.getElementById('weekday-summary');
  if (el) el.textContent = `${count} days / week`;
}

function isIsrael(country) {
  return /^(israel|il)$/i.test((country || '').trim());
}

function defaultWeekDays(country) {
  return isIsrael(country) ? [0,1,2,3,4] : [1,2,3,4,5];
}

const ALL_DAYS = [
  { dow: 0, label: 'Sun' },
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
];

function buildWeekdayPicker(m) {
  const active = new Set(m.weekDays ?? defaultWeekDays(m.country));
  const pills = ALL_DAYS.map(({ dow, label }) =>
    `<button type="button" class="wd-pill${active.has(dow) ? ' active' : ''}" data-dow="${dow}">${label}</button>`
  ).join('');
  return `
    <label class="form-label">Working Days / Week</label>
    <div id="weekday-picker" style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
      ${pills}
    </div>
    <div id="weekday-summary" style="font-size:.78rem;color:var(--text-muted)">${active.size} days / week</div>`;
}

function renderSummary() {
  const total = store.totalCapacity();
  const committed = store.committedEffort();
  const el = document.getElementById('team-gauge');
  if (el) gauge.render(el, committed, total);
  const sumEl = document.getElementById('team-total');
  if (sumEl) sumEl.textContent = `Total: ${store.getTeam().length} members`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6',
  '#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'
];

function nameHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarInitials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function avatarHtml(name, email = '', profilePicture = null) {
  const initials = avatarInitials(name);
  const color    = AVATAR_COLORS[nameHash(name || '?') % AVATAR_COLORS.length];
  const fallback = `this.style.display='none';this.parentElement.textContent='${esc(initials)}'`;

  if (profilePicture) {
    return `<div class="member-avatar" style="background:${color}" title="${esc(name)}">` +
      `<img src="${esc(profilePicture)}" alt="${esc(initials)}" onerror="${fallback}">` +
      `</div>`;
  }
  if (email) {
    const hash = gravatarHash(email);
    return `<div class="member-avatar" style="background:${color}" title="${esc(name)}">` +
      `<img src="https://www.gravatar.com/avatar/${hash}?s=68&d=404" alt="${esc(initials)}" onerror="${fallback}">` +
      `</div>`;
  }
  return `<div class="member-avatar" style="background:${color}" title="${esc(name)}">${esc(initials)}</div>`;
}


// Simple MD5 implementation for Gravatar (RFC 1321)
function gravatarHash(email) {
  return md5(email.trim().toLowerCase());
}

function md5(str) {
  function safeAdd(x, y) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a,b,c,d,x,s,t){ return md5cmn((b&c)|((~b)&d),a,b,x,s,t); }
  function md5gg(a,b,c,d,x,s,t){ return md5cmn((b&d)|(c&(~d)),a,b,x,s,t); }
  function md5hh(a,b,c,d,x,s,t){ return md5cmn(b^c^d,a,b,x,s,t); }
  function md5ii(a,b,c,d,x,s,t){ return md5cmn(c^(b|(~d)),a,b,x,s,t); }

  const bArr = [];
  for (let i = 0; i < str.length * 8; i += 8) {
    bArr[i >> 5] |= (str.charCodeAt(i / 8) & 0xff) << (i % 32);
  }
  const len = str.length * 8;
  bArr[len >> 5] |= 0x80 << (len % 32);
  bArr[(((len + 64) >>> 9) << 4) + 14] = len;

  let a= 1732584193, b=-271733879, c=-1732584194, d=271733878;
  for (let i = 0; i < bArr.length; i += 16) {
    const [A,B,C,D] = [a,b,c,d];
    a=md5ff(a,b,c,d,bArr[i],7,-680876936);    d=md5ff(d,a,b,c,bArr[i+1],12,-389564586);
    c=md5ff(c,d,a,b,bArr[i+2],17,606105819);  b=md5ff(b,c,d,a,bArr[i+3],22,-1044525330);
    a=md5ff(a,b,c,d,bArr[i+4],7,-176418897);  d=md5ff(d,a,b,c,bArr[i+5],12,1200080426);
    c=md5ff(c,d,a,b,bArr[i+6],17,-1473231341);b=md5ff(b,c,d,a,bArr[i+7],22,-45705983);
    a=md5ff(a,b,c,d,bArr[i+8],7,1770035416);  d=md5ff(d,a,b,c,bArr[i+9],12,-1958414417);
    c=md5ff(c,d,a,b,bArr[i+10],17,-42063);    b=md5ff(b,c,d,a,bArr[i+11],22,-1990404162);
    a=md5ff(a,b,c,d,bArr[i+12],7,1804603682); d=md5ff(d,a,b,c,bArr[i+13],12,-40341101);
    c=md5ff(c,d,a,b,bArr[i+14],17,-1502002290);b=md5ff(b,c,d,a,bArr[i+15],22,1236535329);
    a=md5gg(a,b,c,d,bArr[i+1],5,-165796510);  d=md5gg(d,a,b,c,bArr[i+6],9,-1069501632);
    c=md5gg(c,d,a,b,bArr[i+11],14,643717713); b=md5gg(b,c,d,a,bArr[i],20,-373897302);
    a=md5gg(a,b,c,d,bArr[i+5],5,-701558691);  d=md5gg(d,a,b,c,bArr[i+10],9,38016083);
    c=md5gg(c,d,a,b,bArr[i+15],14,-660478335);b=md5gg(b,c,d,a,bArr[i+4],20,-405537848);
    a=md5gg(a,b,c,d,bArr[i+9],5,568446438);   d=md5gg(d,a,b,c,bArr[i+14],9,-1019803690);
    c=md5gg(c,d,a,b,bArr[i+3],14,-187363961); b=md5gg(b,c,d,a,bArr[i+8],20,1163531501);
    a=md5gg(a,b,c,d,bArr[i+13],5,-1444681467);d=md5gg(d,a,b,c,bArr[i+2],9,-51403784);
    c=md5gg(c,d,a,b,bArr[i+7],14,1735328473); b=md5gg(b,c,d,a,bArr[i+12],20,-1926607734);
    a=md5hh(a,b,c,d,bArr[i+5],4,-378558);     d=md5hh(d,a,b,c,bArr[i+8],11,-2022574463);
    c=md5hh(c,d,a,b,bArr[i+11],16,1839030562);b=md5hh(b,c,d,a,bArr[i+14],23,-35309556);
    a=md5hh(a,b,c,d,bArr[i+1],4,-1530992060); d=md5hh(d,a,b,c,bArr[i+4],11,1272893353);
    c=md5hh(c,d,a,b,bArr[i+7],16,-155497632); b=md5hh(b,c,d,a,bArr[i+10],23,-1094730640);
    a=md5hh(a,b,c,d,bArr[i+13],4,681279174);  d=md5hh(d,a,b,c,bArr[i],11,-358537222);
    c=md5hh(c,d,a,b,bArr[i+3],16,-722521979); b=md5hh(b,c,d,a,bArr[i+6],23,76029189);
    a=md5hh(a,b,c,d,bArr[i+9],4,-640364487);  d=md5hh(d,a,b,c,bArr[i+12],11,-421815835);
    c=md5hh(c,d,a,b,bArr[i+15],16,530742520); b=md5hh(b,c,d,a,bArr[i+2],23,-995338651);
    a=md5ii(a,b,c,d,bArr[i],6,-198630844);    d=md5ii(d,a,b,c,bArr[i+7],10,1126891415);
    c=md5ii(c,d,a,b,bArr[i+14],15,-1416354905);b=md5ii(b,c,d,a,bArr[i+5],21,-57434055);
    a=md5ii(a,b,c,d,bArr[i+12],6,1700485571); d=md5ii(d,a,b,c,bArr[i+3],10,-1894986606);
    c=md5ii(c,d,a,b,bArr[i+10],15,-1051523);  b=md5ii(b,c,d,a,bArr[i+1],21,-2054922799);
    a=md5ii(a,b,c,d,bArr[i+8],6,1873313359);  d=md5ii(d,a,b,c,bArr[i+15],10,-30611744);
    c=md5ii(c,d,a,b,bArr[i+6],15,-1560198380);b=md5ii(b,c,d,a,bArr[i+13],21,1309151649);
    a=md5ii(a,b,c,d,bArr[i+4],6,-145523070);  d=md5ii(d,a,b,c,bArr[i+11],10,-1120210379);
    c=md5ii(c,d,a,b,bArr[i+2],15,718787259);  b=md5ii(b,c,d,a,bArr[i+9],21,-343485551);
    a=safeAdd(a,A); b=safeAdd(b,B); c=safeAdd(c,C); d=safeAdd(d,D);
  }
  return [a,b,c,d].map(n => ('00000000' + ((n < 0 ? n + 0x100000000 : n) >>> 0).toString(16)).slice(-8)).join('');
}
