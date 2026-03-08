// step5-timeline.js — Gantt Timeline step

import * as store from '../store.js';
import * as wizard from '../wizard.js';
import * as modal from '../components/modal.js';

const WEEKS = 13;

export function init() {
  document.addEventListener('stepchange', e => { if (e.detail.step === 5) render(); });
}

function getSortedInitiatives() {
  const scores = store.getScores();
  return store.getInitiatives()
    .filter(i => !i.isStretch || store.getScore(i.id)?.isCut === false)
    .sort((a, b) => {
      const sa = scores.find(s => s.initiativeId === a.id);
      const sb = scores.find(s => s.initiativeId === b.id);
      const ra = sa?.manualRank ?? 999;
      const rb = sb?.manualRank ?? 999;
      if (ra !== rb) return ra - rb;
      return (sb?.weightedScore || 0) - (sa?.weightedScore || 0);
    });
}

function render() {
  const initiatives = getSortedInitiatives();
  const missions = store.getMissions();
  const colors = store.getState().settings.missionColors;
  const container = document.getElementById('timeline-container');
  if (!container) return;

  // Ensure timeline entries exist
  initiatives.forEach(i => store.ensureTimelineEntry(i.id));
  const timeline = store.getTimeline();

  // Group toggle
  const groupBy = document.getElementById('tl-groupby')?.value || 'mission';

  let rows;
  if (groupBy === 'owner') {
    const team = store.getTeam();
    const groups = {};
    initiatives.forEach(i => {
      const owner = team.find(t => t.id === i.ownerId);
      const key = owner?.name || 'Unassigned';
      (groups[key] = groups[key] || []).push(i);
    });
    rows = Object.entries(groups).flatMap(([label, inits]) => [
      { type: 'group', label },
      ...inits.map(i => ({ type: 'row', init: i }))
    ]);
  } else {
    rows = missions.flatMap(m => {
      const inits = initiatives.filter(i => i.missionId === m.id);
      if (!inits.length) return [];
      return [
        { type: 'group', label: m.title, color: colors[m.id] },
        ...inits.map(i => ({ type: 'row', init: i }))
      ];
    });
    // unassigned
    const withMission = new Set(missions.map(m => m.id));
    const orphans = initiatives.filter(i => !withMission.has(i.missionId));
    if (orphans.length) {
      rows.push({ type: 'group', label: 'Other' });
      orphans.forEach(i => rows.push({ type: 'row', init: i }));
    }
  }

  // Build header
  const weekHeaders = Array.from({ length: WEEKS }, (_, i) =>
    `<th class="tl-week-hdr">W${i + 1}</th>`
  ).join('');

  // Build body
  const bodyRows = rows.map(r => {
    if (r.type === 'group') {
      const dot = r.color ? `<span class="dot" style="background:${r.color}"></span>` : '';
      return `<tr class="tl-group-row"><td colspan="${WEEKS + 2}" class="tl-group-label">${dot}${esc(r.label)}</td></tr>`;
    }

    const { init } = r;
    const t = timeline.find(x => x.initiativeId === init.id) || { startWeek: 1, endWeek: 4 };
    const color = t.colorOverride || colors[init.missionId] || '#6366f1';
    const score = store.getScore(init.id);
    const cut = score?.isCut ? ' (Stretch)' : '';

    const cells = Array.from({ length: WEEKS }, (_, i) => {
      const w = i + 1;
      const active = w >= t.startWeek && w <= t.endWeek;
      const isStart = w === t.startWeek;
      const isEnd = w === t.endWeek;
      const milestone = t.milestones?.find(ml => ml.week === w);
      return `<td class="tl-cell ${active ? 'tl-active' : ''} ${isStart ? 'tl-start' : ''} ${isEnd ? 'tl-end' : ''}"
        data-init="${init.id}" data-week="${w}"
        style="${active ? `background:${color}22;border-color:${color}` : ''}">
        ${active && isStart ? `<div class="tl-bar-left" data-init="${init.id}" data-edge="start" style="background:${color}"></div>` : ''}
        ${active && isEnd ? `<div class="tl-bar-right" data-init="${init.id}" data-edge="end" style="background:${color}"></div>` : ''}
        ${milestone ? `<div class="milestone-dot" title="${esc(milestone.label)}">◆</div>` : ''}
      </td>`;
    }).join('');

    return `
      <tr class="tl-row" data-init-id="${init.id}">
        <td class="tl-label">${esc(init.title)}${cut ? `<span class="cut-badge">Stretch</span>` : ''}</td>
        ${cells}
        <td class="tl-actions">
          <button class="icon-btn" title="Add milestone" data-init="${init.id}">◆</button>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="tl-scroll">
      <table class="tl-table">
        <thead>
          <tr>
            <th class="tl-label-hdr">Initiative</th>
            ${weekHeaders}
            <th></th>
          </tr>
        </thead>
        <tbody id="tl-tbody">${bodyRows}</tbody>
      </table>
    </div>`;

  renderHeatmap(initiatives, timeline);
  bindTimelineEvents();
}

function renderHeatmap(initiatives, timeline) {
  const el = document.getElementById('tl-heatmap');
  if (!el) return;

  const weekLoad = Array(WEEKS).fill(0);
  initiatives.forEach(init => {
    if (init.isStretch) return;
    const t = timeline.find(x => x.initiativeId === init.id);
    if (!t) return;
    const weeks = t.endWeek - t.startWeek + 1;
    const perWeek = weeks > 0 ? init.effortDays / weeks : 0;
    for (let w = t.startWeek; w <= t.endWeek; w++) {
      weekLoad[w - 1] += perWeek;
    }
  });

  const max = Math.max(...weekLoad, 1);
  el.innerHTML = `
    <div class="heatmap-row">
      <span class="heatmap-label">Load</span>
      ${weekLoad.map((v, i) => {
        const pct = Math.round(v / max * 100);
        const color = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)';
        return `<div class="heatmap-cell" title="W${i+1}: ${v.toFixed(1)} days" style="--pct:${pct}%;background:${color}22">
          <div class="heatmap-fill" style="height:${pct}%;background:${color}"></div>
        </div>`;
      }).join('')}
      <span></span>
    </div>`;
}

function bindTimelineEvents() {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  // Click on cell to expand/shrink range
  let dragState = null;

  container.addEventListener('mousedown', e => {
    const cell = e.target.closest('.tl-cell');
    if (!cell) return;
    const initId = cell.dataset.init;
    const week = parseInt(cell.dataset.week);
    dragState = { initId, startWeek: week, mode: null };
  });

  container.addEventListener('mouseover', e => {
    if (!dragState) return;
    const cell = e.target.closest('.tl-cell[data-init="' + dragState.initId + '"]');
    if (!cell) return;
    const week = parseInt(cell.dataset.week);
    const t = store.getTimeline().find(x => x.initiativeId === dragState.initId);
    if (!t) return;

    if (!dragState.mode) {
      dragState.mode = week < t.startWeek ? 'start' : 'end';
    }

    if (dragState.mode === 'start' && week < t.endWeek) {
      store.updateTimeline(dragState.initId, { startWeek: week });
    } else if (dragState.mode === 'end' && week > t.startWeek) {
      store.updateTimeline(dragState.initId, { endWeek: week });
    }
    render();
  });

  document.addEventListener('mouseup', () => { dragState = null; });

  // Milestone button
  container.querySelectorAll('[data-init].icon-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const initId = e.target.dataset.init;
      const label = await modal.prompt('Add Milestone', 'Label');
      if (!label) return;
      const weekStr = await modal.prompt('Add Milestone', 'Week (1–13)', '1');
      const week = Math.max(1, Math.min(13, parseInt(weekStr) || 1));
      store.addMilestone(initId, week, label);
      render();
    });
  });

  // Groupby toggle
  const groupby = document.getElementById('tl-groupby');
  if (groupby) {
    groupby.addEventListener('change', render);
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
