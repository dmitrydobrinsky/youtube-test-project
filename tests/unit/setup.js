// Provide a working in-memory localStorage for all unit tests
const store = new Map();
global.localStorage = {
  getItem:    key       => store.get(key) ?? null,
  setItem:    (key, val) => store.set(key, String(val)),
  removeItem: key       => store.delete(key),
  clear:      ()        => store.clear(),
  get length()          { return store.size; },
  key:        i         => [...store.keys()][i] ?? null,
};
