// column-mapper.js — maps uploaded file headers to app schema fields

import * as modal from './modal.js';

const APP_FIELDS = [
  { key: 'title',       label: 'Mission Title', required: true },
  { key: 'description', label: 'Description',   required: false },
  { key: 'owner',       label: 'Owner',         required: false },
  { key: 'priority',    label: 'Priority',      required: false }
];

export function autoMap(headers) {
  const lower = headers.map(h => h.toLowerCase().trim());
  const map = {};
  APP_FIELDS.forEach(f => {
    const aliases = {
      title:       ['title','mission','name','task','item','feature'],
      description: ['description','desc','details','notes','summary'],
      owner:       ['owner','assignee','assigned to','pm','responsible'],
      priority:    ['priority','prio','importance','rank','level']
    };
    const found = aliases[f.key].find(a => lower.includes(a));
    if (found) map[f.key] = headers[lower.indexOf(found)];
  });
  return map;
}

export function openMapper(headers) {
  return new Promise(resolve => {
    const initialMap = autoMap(headers);

    const options = ['-- skip --', ...headers].map(h =>
      `<option value="${h}">${h}</option>`
    ).join('');

    const rows = APP_FIELDS.map(f => {
      const sel = initialMap[f.key] || '';
      const opts = (f.required ? headers : ['-- skip --', ...headers])
        .map(h => `<option value="${h}" ${h === sel ? 'selected' : ''}>${h}</option>`)
        .join('');
      return `
        <tr>
          <td style="padding:.5rem .75rem;font-weight:500">${f.label}${f.required ? ' *' : ''}</td>
          <td style="padding:.5rem .75rem">
            <select class="form-input" data-field="${f.key}" style="width:100%">${opts}</select>
          </td>
        </tr>`;
    }).join('');

    modal.open({
      title: 'Map Columns',
      html: `
        <p style="margin-bottom:1rem;color:var(--text-muted)">Match your file's columns to the app fields.</p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:.5rem .75rem">App Field</th>
              <th style="text-align:left;padding:.5rem .75rem">Your Column</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem">
          <button class="btn btn-ghost" id="mapper-cancel">Cancel</button>
          <button class="btn btn-primary" id="mapper-ok">Apply Mapping</button>
        </div>`,
      onClose: resolve
    });

    document.getElementById('mapper-ok').addEventListener('click', () => {
      const result = {};
      document.querySelectorAll('[data-field]').forEach(sel => {
        if (sel.value && sel.value !== '-- skip --') {
          result[sel.dataset.field] = sel.value;
        }
      });
      modal.close(result);
    });
    document.getElementById('mapper-cancel').addEventListener('click', () => modal.close(null));
  });
}

export function applyMapping(rows, mapping) {
  return rows.map(row => {
    const out = {};
    Object.entries(mapping).forEach(([field, col]) => {
      out[field] = String(row[col] ?? '').trim();
    });
    return out;
  }).filter(r => Object.values(r).some(v => v.trim() !== '')); // drop fully blank rows
}
