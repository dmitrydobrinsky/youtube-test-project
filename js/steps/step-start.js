// step-start.js — Planning Setup: quarter, Shapes.co & Jira configuration

import * as store from '../store.js';
import { refreshAccessToken, fetchEmployees } from '../utils/shapes-adapter.js';

const JIRA_DOMAIN = 'onebeat.atlassian.net';

export function init() {
  document.addEventListener('stepchange', e => {
    if (e.detail.step === 1) {
      renderQuarterCards();
      renderShapesCard();
      renderJiraCard();
      renderHolidaysCard();
    }
  });
  bindEvents();
}

function renderQuarterCards() {
  const el = document.getElementById('start-quarter-cards');
  if (!el) return;
  const quarters = nextSixQuarters();
  const current = store.getState().meta.quarterLabel || quarters[0];
  if (!store.getState().meta.quarterLabel) store.setQuarterLabel(quarters[0]);
  el.innerHTML = quarters.map(q => `
    <button class="quarter-card ${q === current ? 'selected' : ''}" data-quarter="${q}">${q}</button>
  `).join('');
}

function renderShapesCard() {
  const settings = store.getSettings();
  const connected = !!(settings.shapesRefreshToken || settings.shapesAccessToken);
  const badge = document.getElementById('shapes-conn-badge');
  if (badge) {
    badge.textContent = connected ? 'Connected' : 'Not connected';
    badge.className = 'conn-badge ' + (connected ? 'conn-badge--ok' : 'conn-badge--off');
  }
  const r = document.getElementById('start-shapes-refresh');
  const a = document.getElementById('start-shapes-access');
  if (r && !r.value) r.value = settings.shapesRefreshToken || '';
  if (a && !a.value) a.value = settings.shapesAccessToken || '';
}

function renderJiraCard() {
  const settings = store.getSettings();
  const configured = !!(settings.jiraEmail && settings.jiraToken);
  const badge = document.getElementById('jira-conn-badge');
  if (badge) {
    badge.textContent = configured ? 'Configured' : 'Not configured';
    badge.className = 'conn-badge ' + (configured ? 'conn-badge--ok' : 'conn-badge--off');
  }
  const e = document.getElementById('start-jira-email');
  const t = document.getElementById('start-jira-token');
  if (e && !e.value) e.value = settings.jiraEmail || '';
  if (t && !t.value) t.value = settings.jiraToken || '';
}

function renderHolidaysCard() {
  const countryHolidays = store.getSettings().countryHolidays || {};
  const countries = Object.keys(countryHolidays).sort();
  const listEl = document.getElementById('start-holidays-list');
  const saveBtn = document.getElementById('start-holidays-save');
  if (!listEl) return;
  if (countries.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;margin:0">Load employees from Shapes to configure holidays per country.</p>';
    if (saveBtn) saveBtn.style.display = 'none';
    return;
  }
  listEl.innerHTML = countries.map(country => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.35rem 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:.9rem">${country}</span>
      <input type="number" min="0" max="60" value="${countryHolidays[country] || 0}"
        class="form-input" style="width:4.5rem;text-align:center" data-country="${country}">
      <span style="font-size:.8rem;color:var(--text-muted);width:2.5rem">days</span>
    </div>
  `).join('');
  if (saveBtn) saveBtn.style.display = '';
}

function bindEvents() {
  // Quarter card selection
  document.querySelectorAll('.quarter-card').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('[setup] quarter-card clicked:', btn.dataset.quarter);
      document.querySelectorAll('.quarter-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      store.setQuarterLabel(btn.dataset.quarter);
    });
  });

  // Shapes save
  const shapesBtn = document.getElementById('start-shapes-save');
  if (shapesBtn) {
    shapesBtn.onclick = () => {
      const r = document.getElementById('start-shapes-refresh').value.trim();
      const a = document.getElementById('start-shapes-access').value.trim();
      console.log('[setup] shapes save clicked — refreshToken:', r ? '(set)' : '(empty)', '| accessToken:', a ? '(set)' : '(empty)');
      store.updateSettings({ shapesRefreshToken: r, shapesAccessToken: a });
      renderShapesCard();
      shapesBtn.textContent = '✓ Saved';
      setTimeout(() => { shapesBtn.textContent = 'Save'; }, 1500);
    };
  }

  // Shapes test
  const shapesTestBtn = document.getElementById('start-shapes-test');
  console.log('[setup] bindEvents — shapes-test button found:', !!shapesTestBtn);
  if (shapesTestBtn) {
    shapesTestBtn.onclick = async () => {
      const refreshToken = document.getElementById('start-shapes-refresh').value.trim();
      const accessToken  = document.getElementById('start-shapes-access').value.trim();
      console.log('[setup] shapes test clicked — refreshToken:', refreshToken ? '(set)' : '(empty)', '| accessToken:', accessToken ? '(set)' : '(empty)');
      const statusEl = document.getElementById('start-shapes-status');
      if (!refreshToken && !accessToken) {
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Enter a refresh or access token first.'; }
        return;
      }
      shapesTestBtn.disabled = true;
      shapesTestBtn.textContent = 'Testing…';
      if (statusEl) { statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Connecting…'; }
      try {
        let token = accessToken;
        if (refreshToken) {
          console.log('[setup] shapes test — attempting token refresh');
          const tokens = await refreshAccessToken(refreshToken);
          token = tokens.accessToken;
          console.log('[setup] shapes test — token refresh succeeded');
          store.updateSettings({ shapesRefreshToken: tokens.refreshToken, shapesAccessToken: token });
          document.getElementById('start-shapes-refresh').value = tokens.refreshToken;
          document.getElementById('start-shapes-access').value  = token;
        }
        // Lightweight probe: fetch just employee IDs
        console.log('[setup] shapes test — probing /api/shapes');
        const res = await fetch('/api/shapes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query: '{ employees { id } }' })
        });
        const json = await res.json();
        console.log('[setup] shapes test — response status:', res.status, '| body:', json);
        if (!res.ok || json.errors) throw new Error((json.errors?.[0]?.message) || `API error ${res.status}`);
        const count = json.data.employees.length;
        renderShapesCard();
        if (statusEl) {
          statusEl.style.color = 'var(--green)';
          statusEl.textContent = `✓ Connected — ${count} employee${count !== 1 ? 's' : ''} found`;
        }
      } catch (err) {
        console.error('[setup] shapes test — error:', err.message);
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = err.message; }
      } finally {
        shapesTestBtn.disabled = false;
        shapesTestBtn.textContent = 'Test Connection';
      }
    };
  }

  // Jira save
  const jiraSaveBtn = document.getElementById('start-jira-save');
  if (jiraSaveBtn) {
    jiraSaveBtn.onclick = () => {
      const email = document.getElementById('start-jira-email').value.trim();
      const token = document.getElementById('start-jira-token').value.trim();
      console.log('[setup] jira save clicked — email:', email || '(empty)', '| token:', token ? '(set)' : '(empty)');
      store.updateSettings({ jiraEmail: email, jiraToken: token });
      renderJiraCard();
      jiraSaveBtn.textContent = '✓ Saved';
      setTimeout(() => { jiraSaveBtn.textContent = 'Save'; }, 1500);
    };
  }

  // Jira test
  // Holidays load
  const holidaysLoadBtn = document.getElementById('start-holidays-load');
  if (holidaysLoadBtn) {
    holidaysLoadBtn.onclick = async () => {
      const settings = store.getSettings();
      const statusEl = document.getElementById('start-holidays-status');
      if (!settings.shapesAccessToken && !settings.shapesRefreshToken) {
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Connect Shapes first.'; }
        return;
      }
      holidaysLoadBtn.disabled = true;
      holidaysLoadBtn.textContent = 'Loading…';
      if (statusEl) { statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Fetching employees…'; }
      try {
        let token = settings.shapesAccessToken;
        if (!token) {
          const tokens = await refreshAccessToken(settings.shapesRefreshToken);
          token = tokens.accessToken;
          store.updateSettings({ shapesRefreshToken: tokens.refreshToken, shapesAccessToken: token });
        }
        const employees = await fetchEmployees(token);
        console.log('[setup] holidays load — employees:', employees.length);
        const countries = [...new Set(employees.map(e => e.country).filter(Boolean))].sort();
        const existing = store.getSettings().countryHolidays || {};
        const merged = {};
        countries.forEach(c => { merged[c] = existing[c] ?? 0; });
        store.updateSettings({ countryHolidays: merged });
        renderHolidaysCard();
        if (statusEl) {
          statusEl.style.color = 'var(--green)';
          statusEl.textContent = `✓ ${countries.length} countr${countries.length !== 1 ? 'ies' : 'y'} found`;
        }
      } catch (err) {
        console.error('[setup] holidays load — error:', err.message);
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = err.message; }
      } finally {
        holidaysLoadBtn.disabled = false;
        holidaysLoadBtn.textContent = 'Load from Shapes';
      }
    };
  }

  // Holidays save & apply
  const holidaysSaveBtn = document.getElementById('start-holidays-save');
  if (holidaysSaveBtn) {
    holidaysSaveBtn.onclick = () => {
      const inputs = document.querySelectorAll('#start-holidays-list input[data-country]');
      const countryHolidays = {};
      inputs.forEach(inp => {
        countryHolidays[inp.dataset.country] = Math.max(0, parseInt(inp.value) || 0);
      });
      store.updateSettings({ countryHolidays });
      // Apply to team members by country (case-insensitive match)
      const team = store.getTeam();
      let applied = 0;
      team.forEach(m => {
        const key = Object.keys(countryHolidays).find(c => c.toLowerCase() === (m.country || '').toLowerCase());
        if (key !== undefined) {
          store.updateTeamMember(m.id, { holidayDays: countryHolidays[key] });
          applied++;
        }
      });
      console.log('[setup] holidays saved:', countryHolidays, '— applied to', applied, 'team members');
      holidaysSaveBtn.textContent = '✓ Saved';
      setTimeout(() => { holidaysSaveBtn.textContent = 'Save & Apply to Team'; }, 1500);
    };
  }

  // Jira test
  const jiraTestBtn = document.getElementById('start-jira-test');
  console.log('[setup] bindEvents — jira-test button found:', !!jiraTestBtn);
  if (jiraTestBtn) {
    jiraTestBtn.onclick = async () => {
      const email = document.getElementById('start-jira-email').value.trim();
      const token = document.getElementById('start-jira-token').value.trim();
      console.log('[setup] jira test clicked — email:', email || '(empty)', '| token:', token ? '(set)' : '(empty)');
      const statusEl = document.getElementById('start-jira-status');
      if (!email || !token) {
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Enter email and API token first.'; }
        return;
      }
      jiraTestBtn.disabled = true;
      jiraTestBtn.textContent = 'Testing…';
      if (statusEl) { statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Connecting…'; }
      try {
        const auth = btoa(`${email}:${token}`);
        const resp = await fetch('/api/jira-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `https://${JIRA_DOMAIN}/rest/api/3/myself`, auth: `Basic ${auth}` })
        });
        const data = await resp.json();
        console.log('[setup] jira test — response status:', resp.status, '| body:', data);
        if (!resp.ok) throw new Error((data.errorMessages || []).join(' ') || data.message || `Jira error ${resp.status}`);
        store.updateSettings({ jiraEmail: email, jiraToken: token });
        renderJiraCard();
        if (statusEl) {
          statusEl.style.color = 'var(--green)';
          statusEl.textContent = `✓ Connected as ${data.displayName || data.emailAddress || 'unknown'}`;
        }
      } catch (err) {
        console.error('[setup] jira test — error:', err.message);
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = err.message; }
      } finally {
        jiraTestBtn.disabled = false;
        jiraTestBtn.textContent = 'Test Connection';
      }
    };
  }
}

function nextSixQuarters() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const result = [];
  for (let i = 0; i < 6; i++) {
    let qn = q + i, yn = year;
    while (qn > 4) { qn -= 4; yn++; }
    result.push(`Q${qn} ${yn}`);
  }
  return result;
}
