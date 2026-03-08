// store.js — centralised state with LocalStorage persistence

const STORAGE_KEY = 'qp_state_v1';

const DEFAULT_STATE = {
  meta: {
    version: '1.0',
    createdAt: null,
    updatedAt: null,
    currentStep: 1,
    quarterLabel: ''
  },
  missions: [],
  team: [],
  initiatives: [],
  scores: [],
  timeline: [],
  settings: {
    scoreWeights: {
      businessImpact: 0.35,
      strategicAlignment: 0.30,
      confidence: 0.20,
      effortComplexity: 0.15
    },
    missionColors: {},
    googleClientId: ''
  }
};

const MISSION_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6',
  '#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'
];

let state = null;

function shortId() {
  return Math.random().toString(36).slice(2, 9);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    } else {
      state = deepClone(DEFAULT_STATE);
      state.meta.createdAt = new Date().toISOString();
    }
  } catch (e) {
    state = deepClone(DEFAULT_STATE);
  }
}

function save() {
  state.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getState() { return state; }

function setQuarterLabel(label) {
  state.meta.quarterLabel = label;
  save();
}

function setCurrentStep(n) {
  state.meta.currentStep = n;
  save();
}

// ── Missions ────────────────────────────────────────────────────────────────

function getMissions() { return state.missions; }

function setMissions(rows) {
  state.missions = rows;
  _assignMissionColors();
  save();
}

function addMission(data = {}) {
  const m = {
    id: shortId(),
    title: data.title || '',
    description: data.description || '',
    owner: data.owner || '',
    ownerId: data.ownerId || '',
    priority: data.priority || ''
  };
  state.missions.push(m);
  _assignMissionColors();
  save();
  return m;
}

function updateMission(id, patch) {
  const m = state.missions.find(x => x.id === id);
  if (m) Object.assign(m, patch);
  save();
}

function deleteMission(id) {
  state.missions = state.missions.filter(x => x.id !== id);
  // cascade
  const childIds = state.initiatives.filter(i => i.missionId === id).map(i => i.id);
  state.initiatives = state.initiatives.filter(i => i.missionId !== id);
  state.scores = state.scores.filter(s => !childIds.includes(s.initiativeId));
  state.timeline = state.timeline.filter(t => !childIds.includes(t.initiativeId));
  delete state.settings.missionColors[id];
  save();
}

function _assignMissionColors() {
  state.missions.forEach((m, i) => {
    if (!state.settings.missionColors[m.id]) {
      state.settings.missionColors[m.id] = MISSION_COLORS[i % MISSION_COLORS.length];
    }
  });
}

// ── Team ────────────────────────────────────────────────────────────────────

function getTeam() { return state.team; }

function addTeamMember(data = {}) {
  const cap = Number(data.capacityPct ?? 100);
  const weeks = Number(data.availableWeeks ?? 13);
  const m = {
    id: shortId(),
    name: data.name || '',
    role: data.role || '',
    jobTitle: data.jobTitle || '',
    team: data.team || '',
    email: data.email || '',
    country: data.country || '',
    shapesId: data.shapesId || null,
    profilePicture: data.profilePicture || null,
    capacityPct: cap,
    availableWeeks: weeks,
    personDays: Math.round(cap / 100 * weeks * 5),
    workingDays: data.workingDays ?? null,    // total working days in quarter
    holidayDays: data.holidayDays ?? null,    // public holidays
    vacationDays: data.vacationDays ?? null,  // planned time away
    reserveDays: data.reserveDays ?? null,    // military reserve duty
    daysOff: data.daysOff ?? []              // manually unchecked dates ['YYYY-MM-DD',...]
  };
  state.team.push(m);
  save();
  return m;
}

function updateTeamMember(id, patch) {
  const m = state.team.find(x => x.id === id);
  if (!m) return;
  Object.assign(m, patch);
  // Only auto-recalculate personDays if not explicitly provided in patch
  if (patch.personDays === undefined) {
    m.personDays = Math.round((m.capacityPct / 100) * m.availableWeeks * 5);
  }
  save();
}

function deleteTeamMember(id) {
  state.team = state.team.filter(x => x.id !== id);
  save();
}

function totalCapacity() {
  return state.team.reduce((s, m) => s + m.personDays, 0);
}

// ── Initiatives ─────────────────────────────────────────────────────────────

function getInitiatives() { return state.initiatives; }
function getInitiativesByMission(missionId) {
  return state.initiatives.filter(i => i.missionId === missionId);
}

const ROLES = ['Algo', 'Data', 'BI', 'Fullstack', 'DevOps'];

function _sumRoleEfforts(roleEfforts) {
  return ROLES.reduce((s, r) => s + (Number(roleEfforts?.[r]) || 0), 0);
}

function addInitiative(data = {}) {
  const roleEfforts = data.roleEfforts || { Algo: 0, Data: 0, BI: 0, Fullstack: 0, DevOps: 0 };
  const init = {
    id: shortId(),
    missionId: data.missionId || '',
    title: data.title || '',
    ownerId: data.ownerId || '',
    roleEfforts,
    effortDays: _sumRoleEfforts(roleEfforts) || Number(data.effortDays) || 0,
    target: data.target || 'Full',
    notes: data.notes || '',
    isStretch: data.isStretch || false
  };
  state.initiatives.push(init);
  // create default score entry
  state.scores.push({
    initiativeId: init.id,
    businessImpact: 3,
    strategicAlignment: 3,
    confidence: 3,
    effortComplexity: 3,
    weightedScore: 0,
    manualRank: null,
    isCut: false
  });
  _recalcScores();
  save();
  return init;
}

function updateInitiative(id, patch) {
  const init = state.initiatives.find(x => x.id === id);
  if (!init) return;
  Object.assign(init, patch);
  // Auto-recalculate effortDays from roleEfforts unless explicitly patched
  if (patch.roleEfforts !== undefined && patch.effortDays === undefined) {
    init.effortDays = _sumRoleEfforts(init.roleEfforts);
  }
  save();
}

function deleteInitiative(id) {
  state.initiatives = state.initiatives.filter(x => x.id !== id);
  state.scores = state.scores.filter(s => s.initiativeId !== id);
  state.timeline = state.timeline.filter(t => t.initiativeId !== id);
  save();
}

function committedEffort() {
  return state.initiatives
    .filter(i => !i.isStretch)
    .reduce((s, i) => s + i.effortDays, 0);
}

function capacityByRole() {
  const out = {};
  ROLES.forEach(r => { out[r] = 0; });
  state.team.forEach(m => {
    const r = m.role;
    if (out[r] !== undefined) out[r] += m.personDays;
  });
  return out;
}

function committedEffortByRole() {
  const out = {};
  ROLES.forEach(r => { out[r] = 0; });
  state.initiatives.filter(i => !i.isStretch).forEach(i => {
    ROLES.forEach(r => { out[r] += Number(i.roleEfforts?.[r] || 0); });
  });
  return out;
}

// ── Scores ──────────────────────────────────────────────────────────────────

function getScores() { return state.scores; }
function getScore(initiativeId) {
  return state.scores.find(s => s.initiativeId === initiativeId);
}

function updateScore(initiativeId, patch) {
  const s = state.scores.find(x => x.initiativeId === initiativeId);
  if (s) {
    Object.assign(s, patch);
    _recalcScores();
    save();
  }
}

function _recalcScores() {
  const w = state.settings.scoreWeights;
  state.scores.forEach(s => {
    s.weightedScore = parseFloat((
      s.businessImpact     * w.businessImpact +
      s.strategicAlignment * w.strategicAlignment +
      s.confidence         * w.confidence +
      (6 - s.effortComplexity) * w.effortComplexity
    ).toFixed(2));
  });
}

function reorderScores(orderedIds) {
  orderedIds.forEach((id, i) => {
    const s = state.scores.find(x => x.initiativeId === id);
    if (s) s.manualRank = i;
  });
  save();
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function getTimeline() { return state.timeline; }

function ensureTimelineEntry(initiativeId) {
  if (!state.timeline.find(t => t.initiativeId === initiativeId)) {
    state.timeline.push({
      initiativeId,
      startWeek: 1,
      endWeek: 4,
      colorOverride: null,
      milestones: []
    });
    save();
  }
}

function updateTimeline(initiativeId, patch) {
  const t = state.timeline.find(x => x.initiativeId === initiativeId);
  if (t) {
    Object.assign(t, patch);
    save();
  }
}

function addMilestone(initiativeId, week, label) {
  const t = state.timeline.find(x => x.initiativeId === initiativeId);
  if (t) {
    t.milestones.push({ week, label });
    save();
  }
}

function removeMilestone(initiativeId, idx) {
  const t = state.timeline.find(x => x.initiativeId === initiativeId);
  if (t) {
    t.milestones.splice(idx, 1);
    save();
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

function getSettings() { return state.settings; }

function updateSettings(patch) {
  Object.assign(state.settings, patch);
  save();
}

// ── Full reset ────────────────────────────────────────────────────────────────

function resetAll() {
  state = deepClone(DEFAULT_STATE);
  state.meta.createdAt = new Date().toISOString();
  save();
}

// ── Restore from serialised state (shareable URL) ─────────────────────────────

function restoreFromObject(obj) {
  state = obj;
  save();
}

export {
  load, save, getState,
  setQuarterLabel, setCurrentStep,
  getMissions, setMissions, addMission, updateMission, deleteMission,
  getTeam, addTeamMember, updateTeamMember, deleteTeamMember, totalCapacity, capacityByRole,
  getInitiatives, getInitiativesByMission, addInitiative, updateInitiative, deleteInitiative, committedEffort, committedEffortByRole,
  getScores, getScore, updateScore, reorderScores,
  getTimeline, ensureTimelineEntry, updateTimeline, addMilestone, removeMilestone,
  getSettings, updateSettings,
  resetAll, restoreFromObject, deepClone, shortId
};
