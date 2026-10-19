// localStorage can be missing or throw (private windows, blocked site data), so every access is
// guarded and the site works the same without it.

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not persisted, that's fine */
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const DISCOVERED = 'bydev.discovered';
const CELEBRATED = 'bydev.celebrated';

export const progress = {
  discovered: new Set(load(DISCOVERED, [])),
  get celebrated() {
    return load(CELEBRATED, false);
  },
  set celebrated(v) {
    save(CELEBRATED, v);
  },
  add(id) {
    this.discovered.add(id);
    save(DISCOVERED, [...this.discovered]);
  },
  reset() {
    this.discovered.clear();
    remove(DISCOVERED);
    remove(CELEBRATED);
  },
};
