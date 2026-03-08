// shapes-adapter.js — Shapes.co GraphQL API integration
// Endpoint: https://api.shapes.co/v1

// Requests go through the local proxy server (server.py) to avoid CORS
const API = '/api/shapes';

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Refresh-Token': refreshToken
    },
    body: JSON.stringify({
      query: `mutation { refreshToken { accessToken refreshToken } }`
    })
  });

  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  const { accessToken, refreshToken: newRefresh } = json.data.refreshToken;
  return { accessToken, refreshToken: newRefresh };
}

// ── Fetch all employees ───────────────────────────────────────────────────────

export async function fetchEmployees(accessToken) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      query: `
        query GetEmployees {
          employees {
            id
            firstName
            lastName
            email
            workStatus
            employeeFieldValues {
              textValue
              fieldValue
              employeeFieldType {
                context
                fieldType
                fieldName
              }
            }
          }
        }
      `
    })
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));

  const raw = json.data.employees;

  // Build an id→name lookup for resolving reports_to
  const idToName = {};
  raw.forEach(emp => {
    idToName[emp.id] = `${emp.firstName} ${emp.lastName}`.trim();
  });

  return raw.map(emp => normaliseEmployee(emp, idToName));
}

// ── Normalise employee → team member ─────────────────────────────────────────

function normaliseEmployee(emp, idToName = {}) {
  const fields = emp.employeeFieldValues || [];

  const getRaw = (context) => {
    return fields.find(fv => fv.employeeFieldType?.context === context) || null;
  };

  const getText = (context) => {
    const f = getRaw(context);
    if (!f) return '';
    if (f.textValue) return f.textValue;
    const v = f.fieldValue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0] || '';
    if (typeof v === 'object' && v !== null) return Object.values(v)[0] || '';
    return String(v ?? '');
  };

  // reports_to fieldValue is typically an employee ID (number or string)
  const reportsToRaw = getRaw('reports_to');
  let managerId   = '';
  let managerName = '';
  if (reportsToRaw) {
    const v = reportsToRaw.fieldValue;
    // Can be a single id, array, or object
    const id = Array.isArray(v) ? String(v[0]) : typeof v === 'object' && v !== null ? String(Object.values(v)[0]) : String(v ?? '');
    if (id && id !== 'null' && id !== 'undefined') {
      managerId   = id;
      managerName = idToName[id] || reportsToRaw.textValue || id;
    }
  }

  const jobTitle = getText('job');
  const team     = getText('team');
  const country  = getText('country');

  return {
    name:        `${emp.firstName} ${emp.lastName}`.trim(),
    email:       emp.email || '',
    jobTitle,
    team,
    country,
    role:        inferRole(jobTitle, team),
    workStatus:  emp.workStatus || 'active',
    shapesId:    emp.id,
    managerId,
    managerName
  };
}

function inferRole(jobTitle, team) {
  const s = `${jobTitle} ${team}`.toLowerCase();
  if (s.includes('algo') || s.includes('algorithm') || s.includes('ml') || s.includes('machine learning') || s.includes('ai')) return 'Algo';
  if (s.includes(' bi') || s.includes('bi ') || s.includes('business intel') || s.includes('analytics'))                       return 'BI';
  if (s.includes('data'))                                                                                                       return 'Data';
  if (s.includes('devops') || s.includes('infra') || s.includes('platform') || s.includes('sre') || s.includes('cloud'))       return 'DevOps';
  if (s.includes('full') || s.includes('frontend') || s.includes('backend') || s.includes('eng') || s.includes('dev') || s.includes('software')) return 'Fullstack';
  return 'Fullstack';
}
