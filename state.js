/* Pure progress-state helpers for the Servo Skull Tracker.
 *
 * These functions have no DOM or localStorage dependency, so they can be
 * unit-tested under Node (see tests/) and reused by app.js in the browser.
 * Progress is stored as a sorted array of stable skull ids, never as
 * chapter/item positions.
 */

const STORAGE_KEY = 'servoSkullTrackerState';
const STATE_VERSION = 2;

function allSkullIds(data) {
  const ids = [];
  for (const chapter of data) {
    for (const item of chapter.items) {
      ids.push(item.id);
    }
  }
  return ids;
}

function sanitizeFound(found, validIds) {
  const valid = new Set(validIds);
  const seen = new Set();
  const out = [];
  for (const id of found) {
    const n = Number(id);
    if (Number.isInteger(n) && valid.has(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

/* Migrate a stored value to the current format.
 * Accepts:
 *   - { version: 2, found: [ids] }            (current)
 *   - { "skull-12": true, ... }              (stable-key map)
 *   - { "ch0-item3": true, ... }             (original v1 position map)
 *   - [ids]                                  (bare export array)
 * Anything else, or unparseable JSON, yields an empty list. Unknown or
 * stale ids are dropped, so a future data change cannot inflate the total.
 */
function migrateStoredState(raw, data) {
  if (raw === null || raw === undefined || raw === '') {
    return { found: [], migrated: false };
  }
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { found: [], migrated: false };
  }
  const validIds = allSkullIds(data);
  if (Array.isArray(parsed)) {
    return { found: sanitizeFound(parsed, validIds), migrated: true };
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.found)) {
      return {
        found: sanitizeFound(parsed.found, validIds),
        migrated: parsed.version !== STATE_VERSION,
      };
    }
    const found = [];
    for (const key of Object.keys(parsed)) {
      if (!parsed[key]) continue;
      const stable = key.match(/^skull-(\d+)$/);
      if (stable) {
        found.push(Number(stable[1]));
        continue;
      }
      const legacy = key.match(/^ch(\d+)-item(\d+)$/);
      if (legacy) {
        const chapter = data[Number(legacy[1])];
        const item = chapter && chapter.items[Number(legacy[2])];
        if (item) found.push(item.id);
      }
    }
    return { found: sanitizeFound(found, validIds), migrated: true };
  }
  return { found: [], migrated: false };
}

function serializeState(found) {
  return JSON.stringify({ version: STATE_VERSION, found: [...found].sort((a, b) => a - b) });
}

/* Validate an imported file. Accepts the current export shape
 * { version, found } or a bare array of ids. Throws an Error with a
 * human-readable message for anything else, so app.js can show it.
 */
function parseExport(text, data) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const validIds = new Set(allSkullIds(data));
  const candidate = Array.isArray(parsed) ? parsed : parsed && parsed.found;
  if (!Array.isArray(candidate)) {
    throw new Error('That file does not contain a Servo Skull progress list.');
  }
  const unknown = candidate.filter((id) => !validIds.has(Number(id)));
  if (unknown.length > 0) {
    throw new Error(`That file contains unknown skull ids: ${unknown.join(', ')}.`);
  }
  return sanitizeFound(candidate, validIds);
}

function buildExport(found) {
  return JSON.stringify(
    {
      app: 'servo-skull-tracker',
      version: STATE_VERSION,
      exportedAt: new Date().toISOString(),
      found: [...found].sort((a, b) => a - b),
    },
    null,
    2,
  );
}

function itemMatchesQuery(item, chapterName, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${chapterName} #${item.id} ${item.audio_log} ${item.location}`.toLowerCase();
  return haystack.includes(q);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    STATE_VERSION,
    allSkullIds,
    sanitizeFound,
    migrateStoredState,
    serializeState,
    parseExport,
    buildExport,
    itemMatchesQuery,
  };
}
