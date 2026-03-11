# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
python3 server.py
```

Serves the app at `http://localhost:8080`. No build step — ES Modules are served as-is. If port 8080 is in use:

```bash
lsof -ti :8080 | xargs kill -9
```

There are no tests, no linter, and no package.json.

## Architecture

**Vanilla JS ES Modules, no framework, no bundler.** The entire app is a single `index.html` with 7 `<section id="step-N">` panels. The wizard shows/hides panels and dispatches a `stepchange` CustomEvent that each step module listens to.

### Data Flow

`store.js` is the single source of truth. All state lives in one object persisted to LocalStorage under `qp_state_v1`. Steps read from and write to the store directly — there is no reactive system. After a store mutation, the step calls its own `render()` to reflect changes.

### Step Registration Pattern

Every step module exports one `init()` function called once at startup from `app.js`. Steps register themselves for their step number:

```js
wizard.registerGuard(N, () => boolean);  // blocks Next if false
document.addEventListener('stepchange', e => { if (e.detail.step === N) render(); });
```

### Step Numbers (current)

| UI Step | File | Step # |
|---------|------|--------|
| Setup | `step-start.js` | 1 |
| Team Setup | `step2-team.js` | 2 |
| Wish List | `step1-wishlist.js` | 3 |
| Initiative Breakdown | `step3-breakdown.js` | 4 |
| Prioritization | `step4-priority.js` | 5 |
| Timeline | `step5-timeline.js` | 6 |
| Export | `step6-export.js` | 7 |

Note: file names don't match step numbers — they reflect historical order. The step number passed to `registerGuard` and `stepchange` is what matters.

### CORS Proxies (server.py)

All external API calls go through the local Python server to bypass CORS:

| Route | Target |
|-------|--------|
| `POST /api/shapes` | Shapes.co GraphQL |
| `POST /api/jira-proxy` | Jira Cloud REST API — accepts `{ url, auth, body }` and forwards as GET or POST |
| `GET /api/shapes-asset/{id}` | Shapes.co protected assets |

### Jira Integration

Credentials (email + API token) are stored in `store.settings.jiraEmail` / `.jiraToken`. All Jira calls use `Authorization: Basic btoa(email:token)`. The adapter in `jira-adapter.js` POSTs to `/rest/api/3/search/jql` (the v2 GET endpoint was removed by Atlassian).

### Key Store Shape

```
state.meta.quarterLabel       — selected quarter string e.g. "Q2 2026"
state.missions[]              — id, title, description, ownerId, priority
state.initiatives[]           — id, missionId, title, roleEfforts{}, effortDays, target, isStretch
state.team[]                  — id, name, role, capacityPct, personDays, weekDays, ...
state.scores[]                — initiativeId, weightedScore, manualRank, isCut
state.timeline[]              — initiativeId, startWeek, endWeek, milestones[]
state.settings                — shapesRefreshToken, shapesAccessToken, jiraEmail, jiraToken, jiraJql, missionColors
```

### Adding a New Step

1. Add `<section id="step-N">` in `index.html` and a tab in `.wiz-tabs`
2. Update `TOTAL_STEPS` and `STEP_NAMES` in `wizard.js`
3. Create the step module, export `init()`, register with correct step number
4. Import and call `init()` in `app.js`
5. Bump all subsequent step numbers in their respective files
