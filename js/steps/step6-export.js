// step6-export.js — Export & Share step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';
import { buildWorkbook, downloadWorkbook } from '../utils/sheetjs-adapter.js';
import { getShareableUrl } from '../utils/url-state.js';

export function init() {
  document.addEventListener('stepchange', e => { if (e.detail.step === 6) render(); });
}

function render() {
  renderSummary();
  bindEvents();
}

function renderSummary() {
  const missions = store.getMissions();
  const initiatives = store.getInitiatives();
  const team = store.getTeam();
  const scores = store.getScores();
  const timeline = store.getTimeline();
  const colors = store.getState().settings.missionColors;
  const ql = store.getState().meta.quarterLabel;

  const el = document.getElementById('export-summary');
  if (!el) return;

  const sorted = initiatives
    .map(i => ({ i, s: scores.find(s => s.initiativeId === i.id) || {} }))
    .sort((a, b) => {
      if (a.s.manualRank != null && b.s.manualRank != null) return a.s.manualRank - b.s.manualRank;
      return (b.s.weightedScore || 0) - (a.s.weightedScore || 0);
    });

  const total = store.totalCapacity();
  const committed = store.committedEffort();

  el.innerHTML = `
    <div class="export-header">
      <h2>Quarter Plan${ql ? ` — ${esc(ql)}` : ''}</h2>
      <p class="export-meta">
        ${missions.length} missions · ${initiatives.length} initiatives ·
        ${team.length} team members · ${committed}/${total} days committed
      </p>
    </div>

    ${missions.map(m => {
      const color = colors[m.id] || '#6366f1';
      const inits = sorted.filter(({i}) => i.missionId === m.id);
      if (!inits.length) return '';
      return `
        <div class="export-mission" style="border-left:4px solid ${color}">
          <h3 style="color:${color}">${esc(m.title)}</h3>
          ${m.description ? `<p class="export-desc">${esc(m.description)}</p>` : ''}
          <table class="export-table">
            <thead><tr><th>Initiative</th><th>Owner</th><th>Effort</th><th>Target</th><th>Score</th><th>Weeks</th><th>Status</th></tr></thead>
            <tbody>
              ${inits.map(({ i, s }) => {
                const owner = team.find(t => t.id === i.ownerId);
                const t = timeline.find(x => x.initiativeId === i.id);
                const weeks = t ? `W${t.startWeek}–W${t.endWeek}` : '—';
                return `<tr class="${s.isCut ? 'cut-row' : ''}">
                  <td>${esc(i.title)}${i.isStretch ? ' <span class="cut-badge">Stretch</span>' : ''}</td>
                  <td>${esc(owner?.name || '—')}</td>
                  <td>${i.effortDays}d</td>
                  <td>${i.target}</td>
                  <td>${(s.weightedScore || 0).toFixed(2)}</td>
                  <td>${weeks}</td>
                  <td>${s.isCut ? '✂ Cut' : '✓ In'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('')}`;
}

function bindEvents() {
  // XLSX export
  const xlsBtn = document.getElementById('export-xlsx');
  if (xlsBtn) xlsBtn.onclick = exportXLSX;

  // CSV export
  const csvBtn = document.getElementById('export-csv');
  if (csvBtn) csvBtn.onclick = exportCSV;

  // Print
  const printBtn = document.getElementById('export-print');
  if (printBtn) printBtn.onclick = () => window.print();

  // Share URL
  const shareBtn = document.getElementById('export-share');
  if (shareBtn) shareBtn.onclick = shareUrl;

  // New Quarter
  const newBtn = document.getElementById('export-new-quarter');
  if (newBtn) newBtn.onclick = newQuarter;
}

function exportXLSX() {
  const missions = store.getMissions();
  const initiatives = store.getInitiatives();
  const team = store.getTeam();
  const scores = store.getScores();
  const timeline = store.getTimeline();

  const missionRows = missions.map(m => ({
    Title: m.title, Description: m.description, Owner: m.owner, Priority: m.priority
  }));

  const teamRows = team.map(t => ({
    Name: t.name, Role: t.role, 'Capacity %': t.capacityPct,
    'Available Weeks': t.availableWeeks, 'Person Days': t.personDays
  }));

  const missionMap = Object.fromEntries(missions.map(m => [m.id, m.title]));
  const teamMap = Object.fromEntries(team.map(t => [t.id, t.name]));

  const initiativeRows = initiatives.map(i => {
    const s = scores.find(x => x.initiativeId === i.id) || {};
    const t = timeline.find(x => x.initiativeId === i.id) || {};
    return {
      Mission: missionMap[i.missionId] || '',
      Initiative: i.title,
      Owner: teamMap[i.ownerId] || '',
      'Effort Days': i.effortDays,
      Target: i.target,
      Stretch: i.isStretch ? 'Yes' : 'No',
      'Business Impact': s.businessImpact || '',
      'Strategic Alignment': s.strategicAlignment || '',
      Confidence: s.confidence || '',
      'Effort Complexity': s.effortComplexity || '',
      Score: s.weightedScore || '',
      Cut: s.isCut ? 'Yes' : 'No',
      'Start Week': t.startWeek || '',
      'End Week': t.endWeek || '',
      Notes: i.notes
    };
  });

  const wb = buildWorkbook([
    { name: 'Summary', rows: initiativeRows },
    { name: 'Missions', rows: missionRows },
    { name: 'Team', rows: teamRows }
  ]);
  const ql = store.getState().meta.quarterLabel || 'Quarter';
  downloadWorkbook(wb, `${ql}-plan.xlsx`);
}

function exportCSV() {
  const initiatives = store.getInitiatives();
  const missions = store.getMissions();
  const team = store.getTeam();
  const scores = store.getScores();
  const missionMap = Object.fromEntries(missions.map(m => [m.id, m.title]));
  const teamMap = Object.fromEntries(team.map(t => [t.id, t.name]));

  const headers = ['Mission','Initiative','Owner','Effort Days','Target','Score','Cut'];
  const rows = initiatives.map(i => {
    const s = scores.find(x => x.initiativeId === i.id) || {};
    return [
      missionMap[i.missionId] || '', i.title, teamMap[i.ownerId] || '',
      i.effortDays, i.target, (s.weightedScore || 0).toFixed(2), s.isCut ? 'Yes' : 'No'
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${store.getState().meta.quarterLabel || 'Quarter'}-plan.csv`;
  a.click();
}

async function shareUrl() {
  const url = getShareableUrl(store.getState());
  try {
    await navigator.clipboard.writeText(url);
    modal.open({
      title: 'Share Link Copied!',
      html: `
        <p style="margin-bottom:1rem">The plan URL has been copied to your clipboard.</p>
        <input class="form-input" value="${esc(url)}" style="width:100%;font-size:.75rem" readonly onclick="this.select()">
        <div style="text-align:right;margin-top:1rem">
          <button class="btn btn-primary" id="share-ok">Done</button>
        </div>`
    });
    document.getElementById('share-ok').addEventListener('click', () => modal.close());
  } catch {
    modal.open({
      title: 'Share Link',
      html: `
        <p style="margin-bottom:1rem">Copy this URL to share your plan:</p>
        <textarea class="form-input" rows="4" style="width:100%;font-size:.75rem" readonly>${esc(url)}</textarea>
        <div style="text-align:right;margin-top:1rem">
          <button class="btn btn-primary" id="share-ok">Done</button>
        </div>`
    });
    document.getElementById('share-ok').addEventListener('click', () => modal.close());
  }
}

async function newQuarter() {
  const ok = await modal.confirm('Start a new quarter? This will clear all current plan data.');
  if (!ok) return;
  store.resetAll();
  location.hash = '';
  wizard.goTo(1);
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
