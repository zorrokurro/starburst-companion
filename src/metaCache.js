/**
 * Meta Cache — Pure TTL-based in-memory cache
 *
 * No domain logic. No DB dependency.
 * Can be reused by any module that needs keyed caching.
 *
 * Phase 2: Meta System
 */

// ── TTL Constants (ms) ──

export const TTL = {
  ARCHETYPE: 10 * 60 * 1000,     // 10 min — changes rarely
  ARCHETYPE_DIST: 10 * 60 * 1000,
  MATCHUP: 5 * 60 * 1000,        // 5 min — medium frequency
  TOP_META: 5 * 60 * 1000,
  TREND: 5 * 60 * 1000,
  FULL_META: 3 * 60 * 1000,      // 3 min — expensive
};

// ── Cache Store ──

const store = new Map();

/**
 * Get cached value by key. Returns undefined if missing or expired.
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Set a value with TTL in ms.
 */
export function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate all keys matching a prefix.
 */
export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear entire cache.
 */
export function clear() {
  store.clear();
}

/**
 * Get cache size (for diagnostics).
 */
export function size() {
  return store.size;
}

export default { get, set, invalidate, clear, size, TTL };
