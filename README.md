# Quarter Planner

A multi-step web application for planning a quarter — from connecting your tools to exporting a full roadmap.

## How to Run

```bash
python3 server.py
```

Opens at **http://localhost:8080**

The server also proxies API calls to Shapes.co and Jira to bypass CORS.

---

## 7-Step Workflow

### Step 1 · Setup
Configure the quarter and connect your data sources before starting.
- Select the **quarter** you are planning (current + 5 upcoming quarters shown as cards)
- **Shapes.co** — save your Refresh Token and Access Token to enable team import
- **Jira** — enter email and API token, test the connection; credentials are saved for all subsequent Jira imports

### Step 2 · Team Setup
Define who is working this quarter and their available capacity.
- **Import from Shapes.co** — fetches all employees via GraphQL; filter by name, team, or manager (full org tree); preview and select before importing
- Add members manually
- Set **capacity %** and **available weeks** per person → auto-calculates person-days
- **Sync Holidays & Vacations** — pulls public holidays and time-off bookings from Shapes.co
- Per-member **working days** modal: country, weekday pills (Sun–Sat), national holidays, out-of-office and reserve days
- Live capacity gauge

### Step 3 · Wish List
Collect missions from the Product Manager.
- **Import from Jira** — fetch Epics using a JQL query; credentials pre-filled from Setup
- Upload from **CSV / Excel** (drag-drop or file picker)
- Import from **Google Drive** (shared-link flow)
- Add, edit, delete, and reorder rows manually

### Step 4 · Initiative Breakdown
Break each mission into concrete tasks with effort estimates.
- **Import from Jira** — fetch issues via JQL, preview with assignee and components, assign each to a mission
- Add tasks manually per mission with **+ Add Task**
- Effort split by role (Algo / Data / BI / DevOps / Fullstack)
- Set **target** (H1 / H2 / Full / Stretch) and mark tasks as **Stretch** (excluded from capacity)
- Collapse / expand missions
- Live per-role capacity gauge showing committed vs available days

### Step 5 · Prioritization
Score and rank all initiatives.
- Score on 4 dimensions: **Business Impact**, **Strategic Alignment**, **Confidence**, **Effort** (inverted)
- Star-rating UI (1–5) per dimension with configurable weights
- Auto-sorts by weighted score
- Drag to override rank manually
- **Cut line** (✂) to separate committed items from stretch/deferred

### Step 6 · Timeline
Visualize the quarter on a Gantt chart.
- **Click and drag** cells to set start/end weeks (W1–W13)
- Add **milestone markers** per initiative
- Group by **Mission** or **Owner**
- **Capacity heatmap** row showing load per week

### Step 7 · Export & Share
Generate deliverables from the plan.
- Download as **Excel (.xlsx)** — Summary, Missions, and Team sheets
- Download as **CSV**
- **Print / Save as PDF** (print-optimized layout)
- **Copy shareable link** — full plan encoded in URL hash (no backend needed)
- **New Quarter** — reset everything and start fresh

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JS (ES Modules) |
| Server | Python 3 `http.server` + CORS proxies |
| File parsing | SheetJS (CDN) |
| Drag & drop | SortableJS (CDN) |
| URL compression | LZ-String (CDN) |
| People API | Shapes.co GraphQL |
| Issue tracking | Jira Cloud REST API v3 |
| Storage | LocalStorage (no backend) |

---

## File Structure

```
├── index.html                  # App shell — all 7 step panels
├── server.py                   # Static file server + Shapes.co & Jira CORS proxies
├── css/
│   ├── main.css                # Layout, wizard, components, start screen styles
│   ├── gantt.css               # Timeline/Gantt styles
│   └── print.css               # Print/PDF layout
└── js/
    ├── app.js                  # Entry point — bootstraps all steps
    ├── store.js                # Centralised state + LocalStorage persistence
    ├── wizard.js               # Step navigation, guards, tab rendering
    ├── steps/
    │   ├── step-start.js       # Step 1: Setup (quarter, Shapes, Jira config)
    │   ├── step2-team.js       # Step 2: Team Setup
    │   ├── step1-wishlist.js   # Step 3: Wish List
    │   ├── step3-breakdown.js  # Step 4: Initiative Breakdown
    │   ├── step4-priority.js   # Step 5: Prioritization
    │   ├── step5-timeline.js   # Step 6: Timeline
    │   └── step6-export.js     # Step 7: Export & Share
    ├── components/
    │   ├── modal.js            # Reusable modal (open, close, confirm)
    │   ├── column-mapper.js    # CSV/Excel column mapping UI
    │   └── capacity-gauge.js   # Capacity bar (total and per-role)
    └── utils/
        ├── jira-adapter.js     # Jira Cloud REST API client (Basic Auth)
        ├── shapes-adapter.js   # Shapes.co GraphQL client
        ├── sheetjs-adapter.js  # CSV/Excel parse + write
        ├── holidays.js         # Working days calculation, quarter date ranges
        ├── drive-picker.js     # Google Drive shared-link import
        └── url-state.js        # Shareable URL encoding (LZ-String)
```

---

## Proxied API Endpoints

| Path | Forwards to | Purpose |
|------|------------|---------|
| `POST /api/shapes` | `https://api.shapes.co/v1` | Shapes.co GraphQL (CORS bypass) |
| `POST /api/jira-proxy` | Jira Cloud REST API | Jira search & auth (CORS bypass) |
| `GET /api/shapes-asset/{id}` | Shapes.co protected assets | Employee profile pictures |

---

## Jira Setup

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and create a personal API token
2. On the **Setup** screen (step 1), enter your Atlassian email and the token
3. Click **Test Connection** to verify — your display name will appear on success
4. Credentials are saved in LocalStorage and reused across all Jira import flows
