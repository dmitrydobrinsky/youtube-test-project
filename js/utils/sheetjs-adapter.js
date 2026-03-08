// sheetjs-adapter.js — SheetJS read/write helpers

// XLSX is loaded globally from CDN

export function parseFile(file, hasHeader = true) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        if (hasHeader) {
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          resolve({ rows, headers: rows.length ? Object.keys(rows[0]) : [] });
        } else {
          // No header row: read all rows as arrays, generate column names
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          // filter out completely blank rows
          const nonEmpty = raw.filter(r => r.some(c => String(c).trim() !== ''));
          if (!nonEmpty.length) { resolve({ rows: [], headers: [] }); return; }
          const colCount = Math.max(...nonEmpty.map(r => r.length));
          const headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
          const rows = nonEmpty.map(r =>
            Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '')]))
          );
          resolve({ rows, headers });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function buildWorkbook(sheets) {
  // sheets: [{ name, rows }]
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  return wb;
}

export function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}
