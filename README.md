# Quarter Planner

A multi-step web application for planning a quarter — from collecting a wish list to exporting a full roadmap.

## How to Run

```bash
python3 server.py
```

Opens at **http://localhost:8080**

> The server also proxies API calls to Shapes.co to bypass CORS.

---

## Application Plan — 6 Steps

### Step 1 · Wish List
Collect missions from the Product Manager.
- Upload from **CSV / Excel** (drag-drop or file picker)
- Import from **Google Drive** (requires OAuth Client ID)
- Toggle **"First row is header"** for headerless files
- Add, edit, delete, and reorder rows manually
- Set a **Quarter Label** (e.g. Q3 2026)

### Step 2 · Team Setup
Define who is working this quarter.
- **Import from Shapes.co** via GraphQL API (auto-refreshes token)
  - Filter by **name**, **team**, or **manager**
  - Manager filter includes the **full org tree** (not just direct reports)
  - Preview and select employees before importing
- Add members manually
- Set **capacity %** and **available weeks** per person → auto-calculates person-days
- **Clear All** button to reset the team
- Live capacity gauge

### Step 3 · Initiative Breakdown
Break each mission into concrete initiatives.
- Add initiatives per mission with **owner**, **effort (days)**, and **target** (H1 / H2 / Full / Stretch)
- Mark initiatives as **Stretch** (excluded from capacity)
- Live capacity gauge showing committed vs available days

### Step 4 · Prioritization
Score and rank all initiatives.
- Score on 4 dimensions: **Business Impact**, **Strategic Alignment**, **Confidence**, **Effort** (inverted)
- Star-rating UI (1–5) per dimension
- Auto-sorts by weighted score
- Drag to override rank manually
- **Cut line** (✂) to separate committed items from stretch/deferred

### Step 5 · Timeline
Visualize the quarter on a Gantt chart.
- **Click and drag** cells to set start/end weeks (W1–W13)
- Add **milestone markers** per initiative
- Group by **Mission** or **Owner**
- **Capacity heatmap** row showing load per week

### Step 6 · Export & Share
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
| Server | Python 3 `http.server` + proxy for Shapes.co API |
| File parsing | SheetJS (CDN) |
| Drag & drop | SortableJS (CDN) |
| URL compression | LZ-String (CDN) |
| People API | Shapes.co GraphQL (`https://api.shapes.co/v1`) |
| Storage | LocalStorage (no backend) |

## File Structure

```
├── index.html              # App shell — all 6 step panels
├── server.py               # Static file server + Shapes.co API proxy
├── css/
│   ├── main.css            # Layout, wizard, components
│   ├── gantt.css           # Timeline/Gantt styles
│   └── print.css           # Print/PDF layout
└── js/
    ├── app.js              # Entry point
    ├── store.js            # State management + LocalStorage
    ├── wizard.js           # Step navigation
    ├── steps/
    │   ├── step1-wishlist.js
    │   ├── step2-team.js
    │   ├── step3-breakdown.js
    │   ├── step4-priority.js
    │   ├── step5-timeline.js
    │   └── step6-export.js
    ├── components/
    │   ├── modal.js
    │   ├── column-mapper.js
    │   └── capacity-gauge.js
    └── utils/
        ├── shapes-adapter.js   # Shapes.co GraphQL client
        ├── sheetjs-adapter.js  # CSV/Excel parse + write
        ├── drive-picker.js     # Google Drive Picker
        └── url-state.js        # Shareable URL encoding
```
