const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { SERVO_SKULL_DATA } = require('../data.js');
const state = require('../state.js');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('data: 48 skulls with sequential unique ids 1-48', () => {
  const ids = SERVO_SKULL_DATA.flatMap((c) => c.items.map((i) => i.id));
  assert.equal(ids.length, 48);
  assert.deepEqual(ids, Array.from({ length: 48 }, (_, i) => i + 1));
});

test('data: every chapter and item has non-empty fields', () => {
  assert.ok(SERVO_SKULL_DATA.length >= 10);
  for (const chapter of SERVO_SKULL_DATA) {
    assert.ok(chapter.chapter.trim().length > 0);
    assert.ok(chapter.items.length > 0);
    for (const item of chapter.items) {
      assert.equal(typeof item.id, 'number');
      assert.ok(item.audio_log.trim().length > 0);
      assert.ok(item.location.trim().length > 0);
    }
  }
});

test('state: legacy position keys migrate to stable skull ids', () => {
  // Chapter 2 is index 0 (ids 1-5); Chapter 3 is index 1 (ids 6-7).
  const raw = JSON.stringify({ 'ch0-item0': true, 'ch1-item1': true, 'ch0-item0': true });
  const { found } = state.migrateStoredState(raw, SERVO_SKULL_DATA);
  assert.deepEqual(found, [1, 7]);
});

test('state: current format, stable-key map, stale ids and corrupt input', () => {
  assert.deepEqual(
    state.migrateStoredState(JSON.stringify({ version: 2, found: [3, 1, 3] }), SERVO_SKULL_DATA).found,
    [1, 3],
  );
  assert.deepEqual(
    state.migrateStoredState(JSON.stringify({ 'skull-48': true, 'skull-2': true }), SERVO_SKULL_DATA).found,
    [2, 48],
  );
  // Id 99 is not a real skull and must not inflate the total.
  assert.deepEqual(
    state.migrateStoredState(JSON.stringify({ version: 2, found: [99, 5] }), SERVO_SKULL_DATA).found,
    [5],
  );
  assert.deepEqual(state.migrateStoredState('not json{', SERVO_SKULL_DATA).found, []);
  assert.deepEqual(state.migrateStoredState(null, SERVO_SKULL_DATA).found, []);
});

test('state: export round-trips and import rejects bad files', () => {
  const exported = state.buildExport([10, 2]);
  assert.deepEqual(state.parseExport(exported, SERVO_SKULL_DATA), [2, 10]);
  assert.deepEqual(state.parseExport('[4, 1]', SERVO_SKULL_DATA), [1, 4]);
  assert.throws(() => state.parseExport('nope', SERVO_SKULL_DATA), /not valid JSON/);
  assert.throws(() => state.parseExport('{"version":2,"found":[1,99]}', SERVO_SKULL_DATA), /unknown skull ids/);
  assert.throws(() => state.parseExport('{"version":2}', SERVO_SKULL_DATA), /does not contain/);
});

test('state: search matches log, location, chapter and id, case-insensitively', () => {
  const item = SERVO_SKULL_DATA[0].items[0];
  assert.equal(state.itemMatchesQuery(item, 'Chapter 2', ''), true);
  assert.equal(state.itemMatchesQuery(item, 'Chapter 2', 'workshift'), true);
  assert.equal(state.itemMatchesQuery(item, 'Chapter 2', 'GRETCHINS'), true);
  assert.equal(state.itemMatchesQuery(item, 'Chapter 2', '#1'), true);
  assert.equal(state.itemMatchesQuery(item, 'Chapter 2', 'lascannon'), false);
});

test('app shell: index references split files and all controls, with no inline data', () => {
  const html = read('index.html');
  for (const ref of ['styles.css', 'data.js', 'state.js', 'app.js']) {
    assert.ok(html.includes(ref), `missing reference to ${ref}`);
  }
  for (const id of [
    'search-input', 'missing-only', 'expand-button', 'collapse-button',
    'export-button', 'import-button', 'import-file', 'status', 'no-results',
    'global-progress',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing element ${id}`);
  }
  assert.ok(!html.includes('<style>'), 'CSS must live in styles.css');
  assert.ok(!html.includes('const data = ['), 'data must live in data.js');
  assert.ok(html.includes('aria-label="Global Servo Skull progress"'));
  const appJs = read('app.js');
  assert.ok(!appJs.includes('innerHTML'), 'app.js must use textContent, not innerHTML');
});

test('manifest: parses, theme matches the page, and every icon file exists', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.theme_color, '#121212');
  assert.ok(read('index.html').includes('content="#121212"'));
  const bySize = new Map(manifest.icons.map((i) => [i.sizes, i]));
  assert.ok(bySize.has('192x192'));
  assert.ok(bySize.has('512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    if (icon.type === 'image/png') {
      assert.ok(fs.existsSync(path.join(root, icon.src)), `missing icon ${icon.src}`);
    }
  }
});

test('service worker: cache list matches files on disk, worker itself excluded', () => {
  const sw = read('service-worker.js');
  assert.ok(sw.includes('skipWaiting'));
  assert.ok(sw.includes('clients.claim'));
  assert.ok(!sw.includes('servo-skull-cache-v1'));
  const match = sw.match(/const urlsToCache = \[([\s\S]*?)\];/);
  assert.ok(match, 'urlsToCache not found');
  const urls = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(urls.length >= 10, `expected >=10 cached urls, got ${urls.length}`);
  for (const url of urls) {
    const file = url === './' ? 'index.html' : url.replace(/^\.\//, '');
    assert.ok(!file.endsWith('service-worker.js'), 'worker must not cache itself');
    assert.ok(fs.existsSync(path.join(root, file)), `cached file missing: ${file}`);
  }
});
