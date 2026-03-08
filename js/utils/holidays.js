// holidays.js — fetch public holidays from Nager.Date (free, no auth, CORS-enabled)

// Country name → ISO 3166-1 alpha-2 code
const COUNTRY_CODES = {
  'israel': 'IL', 'united states': 'US', 'usa': 'US', 'us': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT',
  'netherlands': 'NL', 'belgium': 'BE', 'poland': 'PL', 'ukraine': 'UA',
  'canada': 'CA', 'australia': 'AU', 'india': 'IN', 'brazil': 'BR',
  'mexico': 'MX', 'argentina': 'AR', 'portugal': 'PT', 'sweden': 'SE',
  'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'switzerland': 'CH',
  'austria': 'AT', 'czech republic': 'CZ', 'romania': 'RO', 'hungary': 'HU',
  'bulgaria': 'BG', 'greece': 'GR', 'turkey': 'TR', 'russia': 'RU',
  'china': 'CN', 'japan': 'JP', 'south korea': 'KR', 'singapore': 'SG',
  'new zealand': 'NZ', 'ireland': 'IE', 'slovakia': 'SK', 'croatia': 'HR',
  'serbia': 'RS', 'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
};

export function countryToCode(name) {
  return COUNTRY_CODES[(name || '').toLowerCase().trim()] || null;
}

// Returns Set of 'YYYY-MM-DD' holiday strings falling on working days within [start, end]
export async function fetchHolidays(countryCode, year) {
  if (!countryCode) return new Set();
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
    );
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set(
      data
        .filter(h => {
          const d = new Date(h.date);
          const dow = d.getUTCDay();
          return dow !== 0 && dow !== 6; // skip weekends
        })
        .map(h => h.date)
    );
  } catch {
    return new Set();
  }
}

// Count working days between two 'YYYY-MM-DD' strings or Date objects (inclusive)
// workDays: Set of day-of-week numbers to count (0=Sun … 6=Sat), default Mon–Fri
export function countWorkingDays(start, end, workDays = new Set([1,2,3,4,5]), holidayDates = new Set()) {
  const startStr = typeof start === 'string' ? start : start.toISOString().slice(0, 10);
  const endStr   = typeof end   === 'string' ? end   : end.toISOString().slice(0, 10);

  let count = 0;
  const cur  = new Date(startStr + 'T00:00:00Z');
  const last = new Date(endStr   + 'T00:00:00Z');

  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (workDays.has(dow)) {
      const iso = cur.toISOString().slice(0, 10);
      if (!holidayDates.has(iso)) count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// Clamp a date string to [rangeStart, rangeEnd]
export function clampDate(dateStr, rangeStart, rangeEnd) {
  if (dateStr < rangeStart) return rangeStart;
  if (dateStr > rangeEnd)   return rangeEnd;
  return dateStr;
}

// Parse quarter label "Q2 2026" → { start: Date, end: Date }
export function quarterToDateRange(label) {
  const m = String(label).match(/Q(\d)\s+(\d{4})/i);
  if (!m) return null;
  const q = parseInt(m[1]);
  const y = parseInt(m[2]);
  const startMonth = (q - 1) * 3; // 0-based month
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end   = new Date(Date.UTC(y, startMonth + 3, 0)); // last day of quarter
  return { start, end };
}
