// url-state.js — compress/decompress plan state to/from URL hash

export function encodeState(stateObj) {
  const json = JSON.stringify(stateObj);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return compressed;
}

export function decodeState(hash) {
  try {
    const raw = hash.startsWith('#state=') ? hash.slice(7) : hash;
    const json = LZString.decompressFromEncodedURIComponent(raw);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveToUrl(stateObj) {
  const encoded = encodeState(stateObj);
  history.replaceState(null, '', '#state=' + encoded);
}

export function loadFromUrl() {
  if (location.hash.startsWith('#state=')) {
    return decodeState(location.hash);
  }
  return null;
}

export function getShareableUrl(stateObj) {
  const encoded = encodeState(stateObj);
  const url = new URL(location.href);
  url.hash = 'state=' + encoded;
  return url.toString();
}
