// step-start.js — Planning Setup: quarter, Shapes.co & Jira configuration

import * as store from '../store.js';

const JIRA_DOMAIN = 'onebeat.atlassian.net';

export function init() {
  document.addEventListener('stepchange', e => { if (e.detail.step === 1) render(); });
}

function render() {
  renderQuarterCards();
  renderShapesCard();
  renderJiraCard();
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

function bindEvents() {
  // Quarter card selection
  document.querySelectorAll('.quarter-card').forEach(btn => {
    btn.addEventListener('click', () => {
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
      store.updateSettings({ shapesRefreshToken: r, shapesAccessToken: a });
      renderShapesCard();
      shapesBtn.textContent = '✓ Saved';
      setTimeout(() => { shapesBtn.textContent = 'Save'; }, 1500);
    };
  }

  // Jira save
  const jiraSaveBtn = document.getElementById('start-jira-save');
  if (jiraSaveBtn) {
    jiraSaveBtn.onclick = () => {
      const email = document.getElementById('start-jira-email').value.trim();
      const token = document.getElementById('start-jira-token').value.trim();
      store.updateSettings({ jiraEmail: email, jiraToken: token });
      renderJiraCard();
      jiraSaveBtn.textContent = '✓ Saved';
      setTimeout(() => { jiraSaveBtn.textContent = 'Save'; }, 1500);
    };
  }

  // Jira test
  const jiraTestBtn = document.getElementById('start-jira-test');
  if (jiraTestBtn) {
    jiraTestBtn.onclick = async () => {
      const email = document.getElementById('start-jira-email').value.trim();
      const token = document.getElementById('start-jira-token').value.trim();
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
        if (!resp.ok) throw new Error((data.errorMessages || []).join(' ') || data.message || `Jira error ${resp.status}`);
        store.updateSettings({ jiraEmail: email, jiraToken: token });
        renderJiraCard();
        if (statusEl) {
          statusEl.style.color = 'var(--green)';
          statusEl.textContent = `✓ Connected as ${data.displayName || data.emailAddress || 'unknown'}`;
        }
      } catch (err) {
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
