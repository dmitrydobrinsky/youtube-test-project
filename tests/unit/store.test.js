import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../../js/store.js';

beforeEach(() => {
  localStorage.clear();
  store.load();
});

// ── Missions ────────────────────────────────────────────────────────────────

describe('missions', () => {
  it('starts empty', () => {
    expect(store.getMissions()).toEqual([]);
  });

  it('adds a mission with defaults', () => {
    const m = store.addMission({ title: 'Test' });
    expect(m.title).toBe('Test');
    expect(m.id).toBeTruthy();
    expect(m.description).toBe('');
    expect(m.priority).toBe('');
    expect(store.getMissions()).toHaveLength(1);
  });

  it('assigns a color on add', () => {
    const m = store.addMission({ title: 'A' });
    expect(store.getState().settings.missionColors[m.id]).toMatch(/^#/);
  });

  it('updates a mission field', () => {
    const m = store.addMission({ title: 'Old' });
    store.updateMission(m.id, { title: 'New' });
    expect(store.getMissions()[0].title).toBe('New');
  });

  it('deletes a mission', () => {
    const m = store.addMission({ title: 'To delete' });
    store.deleteMission(m.id);
    expect(store.getMissions()).toHaveLength(0);
  });

  it('cascade-deletes initiatives when mission is deleted', () => {
    const m = store.addMission({ title: 'M' });
    store.addInitiative({ missionId: m.id, title: 'I' });
    expect(store.getInitiatives()).toHaveLength(1);
    store.deleteMission(m.id);
    expect(store.getInitiatives()).toHaveLength(0);
  });

  it('cascade-deletes scores when mission is deleted', () => {
    const m = store.addMission({ title: 'M' });
    store.addInitiative({ missionId: m.id, title: 'I' });
    expect(store.getScores()).toHaveLength(1);
    store.deleteMission(m.id);
    expect(store.getScores()).toHaveLength(0);
  });

  it('sets missions in bulk', () => {
    store.addMission({ title: 'Old' });
    store.setMissions([{ id: 'x1', title: 'New1' }, { id: 'x2', title: 'New2' }]);
    expect(store.getMissions()).toHaveLength(2);
    expect(store.getMissions()[0].title).toBe('New1');
  });
});

// ── Team ────────────────────────────────────────────────────────────────────

describe('team', () => {
  it('starts empty', () => {
    expect(store.getTeam()).toEqual([]);
  });

  it('adds a member with default person-days (100% × 13 weeks × 5 days)', () => {
    const m = store.addTeamMember({ name: 'Alice', role: 'Algo' });
    expect(m.personDays).toBe(65); // 1.0 * 13 * 5
    expect(m.capacityPct).toBe(100);
    expect(m.availableWeeks).toBe(13);
  });

  it('calculates person-days correctly for partial capacity', () => {
    const m = store.addTeamMember({ name: 'Bob', capacityPct: 50, availableWeeks: 10 });
    expect(m.personDays).toBe(25); // 0.5 * 10 * 5
  });

  it('updates a member and recalculates person-days', () => {
    const m = store.addTeamMember({ name: 'Carol', capacityPct: 100, availableWeeks: 13 });
    store.updateTeamMember(m.id, { capacityPct: 80 });
    const updated = store.getTeam().find(x => x.id === m.id);
    expect(updated.personDays).toBe(52); // 0.8 * 13 * 5
  });

  it('does not recalculate personDays when explicitly patched', () => {
    const m = store.addTeamMember({ name: 'Dave' });
    store.updateTeamMember(m.id, { personDays: 42 });
    expect(store.getTeam()[0].personDays).toBe(42);
  });

  it('deletes a member', () => {
    const m = store.addTeamMember({ name: 'Eve' });
    store.deleteTeamMember(m.id);
    expect(store.getTeam()).toHaveLength(0);
  });

  it('calculates total capacity', () => {
    store.addTeamMember({ name: 'A', personDays: 65 });
    store.addTeamMember({ name: 'B', personDays: 50 });
    expect(store.totalCapacity()).toBe(115);
  });

  it('calculates capacity by role', () => {
    store.addTeamMember({ name: 'A', role: 'Algo', capacityPct: 100, availableWeeks: 13 });
    store.addTeamMember({ name: 'B', role: 'Data', capacityPct: 100, availableWeeks: 13 });
    const cap = store.capacityByRole();
    expect(cap.Algo).toBe(65);
    expect(cap.Data).toBe(65);
    expect(cap.BI).toBe(0);
  });
});

// ── Initiatives ──────────────────────────────────────────────────────────────

describe('initiatives', () => {
  it('adds an initiative with a default score entry', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({ missionId: m.id, title: 'I' });
    expect(store.getInitiatives()).toHaveLength(1);
    expect(store.getScore(i.id)).toBeTruthy();
    expect(store.getScore(i.id).businessImpact).toBe(3);
  });

  it('sums role efforts into effortDays', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({
      missionId: m.id,
      title: 'I',
      roleEfforts: { Algo: 5, Data: 3, BI: 0, Fullstack: 2, DevOps: 0 }
    });
    expect(i.effortDays).toBe(10);
  });

  it('updates effortDays when roleEfforts are patched', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({ missionId: m.id, title: 'I', roleEfforts: { Algo: 5 } });
    store.updateInitiative(i.id, { roleEfforts: { Algo: 10, Data: 5 } });
    expect(store.getInitiatives()[0].effortDays).toBe(15);
  });

  it('filters by mission', () => {
    const m1 = store.addMission({ title: 'M1' });
    const m2 = store.addMission({ title: 'M2' });
    store.addInitiative({ missionId: m1.id, title: 'I1' });
    store.addInitiative({ missionId: m2.id, title: 'I2' });
    expect(store.getInitiativesByMission(m1.id)).toHaveLength(1);
    expect(store.getInitiativesByMission(m2.id)).toHaveLength(1);
  });

  it('deletes an initiative and its score', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({ missionId: m.id, title: 'I' });
    store.deleteInitiative(i.id);
    expect(store.getInitiatives()).toHaveLength(0);
    expect(store.getScore(i.id)).toBeUndefined();
  });

  it('excludes stretch initiatives from committedEffort', () => {
    const m = store.addMission({ title: 'M' });
    store.addInitiative({ missionId: m.id, title: 'Normal', effortDays: 10 });
    store.addInitiative({ missionId: m.id, title: 'Stretch', effortDays: 5, isStretch: true });
    expect(store.committedEffort()).toBe(10);
  });

  it('calculates committed effort by role', () => {
    const m = store.addMission({ title: 'M' });
    store.addInitiative({ missionId: m.id, title: 'I1', roleEfforts: { Algo: 5, Data: 3 } });
    store.addInitiative({ missionId: m.id, title: 'I2', roleEfforts: { Algo: 2, Fullstack: 8 } });
    const byRole = store.committedEffortByRole();
    expect(byRole.Algo).toBe(7);
    expect(byRole.Data).toBe(3);
    expect(byRole.Fullstack).toBe(8);
  });
});

// ── Scores ──────────────────────────────────────────────────────────────────

describe('scores', () => {
  it('calculates weighted score on add (defaults all 3)', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({ missionId: m.id, title: 'I' });
    // 3*0.35 + 3*0.30 + 3*0.20 + (6-3)*0.15 = 1.05+0.90+0.60+0.45 = 3.00
    expect(store.getScore(i.id).weightedScore).toBe(3);
  });

  it('recalculates weighted score after update', () => {
    const m = store.addMission({ title: 'M' });
    const i = store.addInitiative({ missionId: m.id, title: 'I' });
    store.updateScore(i.id, { businessImpact: 5, strategicAlignment: 5, confidence: 5, effortComplexity: 1 });
    // 5*0.35 + 5*0.30 + 5*0.20 + (6-1)*0.15 = 1.75+1.50+1.00+0.75 = 5.00
    expect(store.getScore(i.id).weightedScore).toBe(5);
  });
});

// ── Quarter & meta ───────────────────────────────────────────────────────────

describe('meta', () => {
  it('sets and gets quarter label', () => {
    store.setQuarterLabel('Q3 2026');
    expect(store.getState().meta.quarterLabel).toBe('Q3 2026');
  });

  it('persists to localStorage', () => {
    store.setQuarterLabel('Q2 2026');
    const raw = localStorage.getItem('qp_state_v1');
    expect(JSON.parse(raw).meta.quarterLabel).toBe('Q2 2026');
  });

  it('resets all state', () => {
    store.addMission({ title: 'M' });
    store.addTeamMember({ name: 'A' });
    store.resetAll();
    expect(store.getMissions()).toHaveLength(0);
    expect(store.getTeam()).toHaveLength(0);
  });

  it('loads from corrupted localStorage without crashing', () => {
    localStorage.setItem('qp_state_v1', 'not-json');
    expect(() => store.load()).not.toThrow();
    expect(store.getMissions()).toEqual([]);
  });
});

// ── Settings ─────────────────────────────────────────────────────────────────

describe('settings', () => {
  it('updates settings', () => {
    store.updateSettings({ jiraEmail: 'test@example.com' });
    expect(store.getSettings().jiraEmail).toBe('test@example.com');
  });

  it('merges settings without overwriting unrelated keys', () => {
    store.updateSettings({ jiraEmail: 'a@b.com' });
    store.updateSettings({ jiraToken: 'tok123' });
    expect(store.getSettings().jiraEmail).toBe('a@b.com');
    expect(store.getSettings().jiraToken).toBe('tok123');
  });

  it('stores countryHolidays map', () => {
    store.updateSettings({ countryHolidays: { Israel: 5, USA: 3 } });
    expect(store.getSettings().countryHolidays).toEqual({ Israel: 5, USA: 3 });
  });

  it('merges countryHolidays without losing other settings', () => {
    store.updateSettings({ jiraEmail: 'a@b.com' });
    store.updateSettings({ countryHolidays: { Israel: 5 } });
    expect(store.getSettings().jiraEmail).toBe('a@b.com');
    expect(store.getSettings().countryHolidays).toEqual({ Israel: 5 });
  });
});

// ── Mission why field ─────────────────────────────────────────────────────────

describe('mission why field', () => {
  it('stores why on addMission', () => {
    const m = store.addMission({ title: 'T', why: 'Because reasons' });
    expect(m.why).toBe('Because reasons');
  });

  it('defaults why to empty string', () => {
    const m = store.addMission({ title: 'T' });
    expect(m.why).toBe('');
  });

  it('updates why via updateMission', () => {
    const m = store.addMission({ title: 'T' });
    store.updateMission(m.id, { why: 'New reason' });
    expect(store.getMissions()[0].why).toBe('New reason');
  });

  it('persists why to localStorage', () => {
    store.addMission({ title: 'T', why: 'Saved reason' });
    const raw = JSON.parse(localStorage.getItem('qp_state_v1'));
    expect(raw.missions[0].why).toBe('Saved reason');
  });
});

// ── Country holidays applied to team ─────────────────────────────────────────

describe('countryHolidays applied to team', () => {
  it('updateTeamMember sets holidayDays', () => {
    const m = store.addTeamMember({ name: 'Alice', country: 'Israel' });
    store.updateTeamMember(m.id, { holidayDays: 5 });
    expect(store.getTeam()[0].holidayDays).toBe(5);
  });

  it('applying country holidays updates correct members', () => {
    const alice = store.addTeamMember({ name: 'Alice', country: 'Israel' });
    const bob   = store.addTeamMember({ name: 'Bob',   country: 'USA' });
    const countryHolidays = { Israel: 7, USA: 3 };
    store.getTeam().forEach(member => {
      const key = Object.keys(countryHolidays).find(
        c => c.toLowerCase() === (member.country || '').toLowerCase()
      );
      if (key !== undefined) store.updateTeamMember(member.id, { holidayDays: countryHolidays[key] });
    });
    expect(store.getTeam().find(m => m.id === alice.id).holidayDays).toBe(7);
    expect(store.getTeam().find(m => m.id === bob.id).holidayDays).toBe(3);
  });
});
