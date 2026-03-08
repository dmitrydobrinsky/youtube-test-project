// drive-picker.js — Import from Google Drive via shared link
// Works with any Google Sheet or file shared as "Anyone with the link can view"

// Convert a shared URL into a direct CSV/file download URL
function buildExportUrl(url) {
  // Google Sheets: https://docs.google.com/spreadsheets/d/FILE_ID/...
  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/gviz/tq?tqx=out:csv`;
  }
  // Google Drive file: https://drive.google.com/file/d/FILE_ID/...
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  // drive.google.com/open?id=FILE_ID  or  ?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  }
  return null;
}

export async function fetchFromSharedUrl(url) {
  const exportUrl = buildExportUrl(url.trim());
  if (!exportUrl) {
    throw new Error('Unrecognised Google Drive / Sheets URL. Paste the share link directly from Google.');
  }

  const resp = await fetch(exportUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch (${resp.status}). Make sure the file is shared as "Anyone with the link can view".`);
  }

  const blob = await resp.blob();
  const isSheet = url.includes('spreadsheets');
  return new File([blob], isSheet ? 'sheet.csv' : 'drive-file.csv', { type: 'text/csv' });
}
