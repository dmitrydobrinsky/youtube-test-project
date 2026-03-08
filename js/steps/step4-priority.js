// step4-priority.js — Prioritization & Scoring step

import * as store from '../store.js';
import * as wizard from '../wizard.js';

const DIMS = [
  { key: 'businessImpact',     label: 'Business Impact',      tip: '1=Low … 5=High' },
  { key: 'strategicAlignment', label: 'Strategic Alignment',  tip: '1=Low … 5=High' },
  { key: 'confidence',         label: 'Confidence',           tip: '1=Low … 5=High' },
  { key: 'effortComplexity',   label: 'Effort (inverted)',    tip: '1=Big effort … 5=Small effort' }
];

export function init() {
  document.addEventListener('stepchange', e => { if (e.detail.step === 4) render(); });
}

function getSorted() {
  const initiatives = store.getInitiatives();
  const scores = store.getScores();

  return initiatives
    .map(init => ({
      init,
      score: scores.find(s => s.initiativeId === init.id) || {}
    }))
    .sort((a, b) => {
      if (a.score.manualRank != null && b.score.manualRank != null)
        return a.score.manualRank - b.score.manualRank;
      return (b.score.weightedScore || 0) - (a.score.weightedScore || 0);
    });
}

function render() {
  const sorted = getSorted();
  const missions = store.getMissions();
  const colors = store.getState().settings.missionColors;
  const tbody = document.getElementById('prio-tbody');
  if (!tbody) return;

  tbody.innerHTML = sorted.map(({ init, score }, idx) => {
    const mission = missions.find(m => m.id === init.missionId);
    const color = colors[init.missionId] || '#6366f1';
    const scoreVal = score.weightedScore || 0;

    const dims = DIMS.map(d => `
      <td class="score-cell">
        <div class="score-stars" data-dim="${d.key}" title="${d.tip}">
          ${[1,2,3,4,5].map(n =>
            `<span class="star ${n <= (score[d.key]||3) ? 'active' : ''}" data-val="${n}">★</span>`
          ).join('')}
        </div>
      </td>`).join('');

    return `
      <tr data-init-id="${init.id}" class="${score.isCut ? 'cut-row' : ''}">
        <td class="drag-handle prio-handle">⠿</td>
        <td style="font-weight:600">${idx + 1}</td>
        <td>
          <span class="dot" style="background:${color}"></span>
          ${esc(init.title)}
          <div class="init-sub">${esc(mission?.title || '')}</div>
        </td>
        ${dims}
        <td style="font-weight:700;color:var(--accent)">${scoreVal.toFixed(2)}</td>
        <td>
          <button class="icon-btn cut-btn" title="${score.isCut ? 'Move above cut' : 'Move below cut'}">
            ${score.isCut ? '↑' : '✂'}
          </button>
        </td>
      </tr>`;
  }).join('');

  // Cut line visual separator
  insertCutLine(sorted);
  bindRowEvents(sorted);

  // Init sortable
  if (window.Sortable) {
    Sortable.create(tbody, {
      handle: '.prio-handle',
      animation: 150,
      onEnd: () => {
        const ids = [...tbody.querySelectorAll('tr[data-init-id]')].map(r => r.dataset.initId);
        store.reorderScores(ids);
        render();
      }
    });
  }
}

function insertCutLine(sorted) {
  const tbody = document.getElementById('prio-tbody');
  const rows = tbody.querySelectorAll('tr[data-init-id]');
  rows.forEach((row, i) => {
    const { score } = sorted[i];
    const prev = sorted[i - 1];
    if (score.isCut && prev && !prev.score.isCut) {
      const cutRow = document.createElement('tr');
      cutRow.className = 'cut-line-row';
      cutRow.innerHTML = `<td colspan="10"><div class="cut-line">── Cut Line ──</div></td>`;
      tbody.insertBefore(cutRow, row);
    }
  });
}

function bindRowEvents(sorted) {
  const tbody = document.getElementById('prio-tbody');

  // Star clicks
  tbody.querySelectorAll('.score-stars').forEach(stars => {
    stars.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', e => {
        const row = e.target.closest('tr[data-init-id]');
        const initId = row.dataset.initId;
        const dim = stars.dataset.dim;
        const val = parseInt(star.dataset.val);
        store.updateScore(initId, { [dim]: val });
        render();
      });
    });
  });

  // Cut button
  tbody.querySelectorAll('.cut-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const row = e.target.closest('tr[data-init-id]');
      const initId = row.dataset.initId;
      const score = store.getScore(initId);
      store.updateScore(initId, { isCut: !score.isCut });
      render();
    });
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
