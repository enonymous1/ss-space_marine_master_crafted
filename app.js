/* Browser UI for the Servo Skull Tracker.
 * Data lives in data.js, pure state logic in state.js; this file only
 * renders the DOM, wires controls, and persists to localStorage.
 * Progress keys are stable skull ids (see state.js) — the original
 * position-based keys are migrated on load, so existing players keep
 * their checkmarks.
 */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const globalProgress = document.getElementById('global-progress');
  const globalCount = document.getElementById('global-count');
  const resetButton = document.getElementById('reset-button');
  const expandButton = document.getElementById('expand-button');
  const collapseButton = document.getElementById('collapse-button');
  const exportButton = document.getElementById('export-button');
  const importButton = document.getElementById('import-button');
  const importFile = document.getElementById('import-file');
  const searchInput = document.getElementById('search-input');
  const missingOnlyCheckbox = document.getElementById('missing-only');
  const statusEl = document.getElementById('status');
  const noResultsEl = document.getElementById('no-results');

  const data = SERVO_SKULL_DATA;
  const totalItems = allSkullIds(data).length;
  let found = new Set();
  // chapterIndex -> { countSpan, details, items: [{ div, label, checkbox, itemData }] }
  const chapters = [];

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('error', !!isError);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, serializeState([...found]));
    } catch (error) {
      setStatus('Could not save progress (browser storage unavailable).', true);
    }
  }

  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    const migrated = migrateStoredState(raw, data);
    found = new Set(migrated.found);
    if (migrated.migrated) saveState();
  }

  function updateCounts() {
    globalCount.textContent = `${found.size} / ${totalItems} Found`;
    globalProgress.value = found.size;
    for (const chapter of chapters) {
      const chapterFound = chapter.items.filter((entry) => found.has(entry.itemData.id)).length;
      chapter.countSpan.textContent = `${chapterFound} / ${chapter.items.length}`;
    }
  }

  function applyFilters() {
    const query = searchInput.value;
    const missingOnly = missingOnlyCheckbox.checked;
    let anyVisibleChapter = false;
    for (const chapter of chapters) {
      let visibleItems = 0;
      for (const entry of chapter.items) {
        const matches = itemMatchesQuery(entry.itemData, chapter.name, query);
        const visible = matches && (!missingOnly || !found.has(entry.itemData.id));
        entry.div.hidden = !visible;
        if (visible) visibleItems += 1;
      }
      chapter.details.hidden = visibleItems === 0;
      if (visibleItems > 0) anyVisibleChapter = true;
    }
    noResultsEl.hidden = anyVisibleChapter;
  }

  function render() {
    data.forEach((chapterData) => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chapterData.chapter;
      const countSpan = document.createElement('span');
      countSpan.textContent = `0 / ${chapterData.items.length}`;
      summary.appendChild(titleSpan);
      summary.appendChild(countSpan);
      details.appendChild(summary);

      const chapter = { name: chapterData.chapter, details, countSpan, items: [] };

      chapterData.items.forEach((itemData) => {
        const div = document.createElement('div');
        div.className = 'item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `skull-${itemData.id}`;
        checkbox.checked = found.has(itemData.id);

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;

        const itemTitle = document.createElement('div');
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = `#${itemData.id} - ${itemData.audio_log}`;
        itemTitle.appendChild(titleStrong);

        const itemLocation = document.createElement('div');
        itemLocation.textContent = itemData.location;
        itemLocation.className = 'item-location';

        label.appendChild(itemTitle);
        label.appendChild(itemLocation);
        if (checkbox.checked) label.classList.add('completed');

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            found.add(itemData.id);
            label.classList.add('completed');
          } else {
            found.delete(itemData.id);
            label.classList.remove('completed');
          }
          updateCounts();
          applyFilters();
          saveState();
        });

        div.appendChild(checkbox);
        div.appendChild(label);
        details.appendChild(div);
        chapter.items.push({ div, label, checkbox, itemData });
      });

      chapters.push(chapter);
      app.appendChild(details);
    });
  }

  function syncCheckboxes() {
    for (const chapter of chapters) {
      for (const entry of chapter.items) {
        entry.checkbox.checked = found.has(entry.itemData.id);
        entry.label.classList.toggle('completed', entry.checkbox.checked);
      }
    }
  }

  expandButton.addEventListener('click', () => {
    document.querySelectorAll('#app details').forEach((el) => { el.open = true; });
  });

  collapseButton.addEventListener('click', () => {
    document.querySelectorAll('#app details').forEach((el) => { el.open = false; });
  });

  searchInput.addEventListener('input', applyFilters);
  missingOnlyCheckbox.addEventListener('change', applyFilters);

  exportButton.addEventListener('click', () => {
    const blob = new Blob([buildExport([...found])], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'servo-skull-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${found.size} of ${totalItems} skulls.`);
  });

  importButton.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    importFile.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      setStatus('Could not read that file.', true);
      return;
    }
    let imported;
    try {
      imported = parseExport(text, data);
    } catch (error) {
      setStatus(error.message, true);
      return;
    }
    if (!window.confirm(`Replace your current progress with ${imported.length} imported skulls?`)) {
      return;
    }
    found = new Set(imported);
    syncCheckboxes();
    updateCounts();
    applyFilters();
    saveState();
    setStatus(`Imported ${imported.length} of ${totalItems} skulls.`);
  });

  resetButton.addEventListener('click', () => {
    if (!window.confirm('Clear saved progress and reset all checklist items?')) return;
    found = new Set();
    syncCheckboxes();
    updateCounts();
    applyFilters();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage already unavailable; in-memory state is cleared */
    }
    setStatus('Progress reset.');
  });

  loadState();
  render();
  globalProgress.max = totalItems;
  updateCounts();
  applyFilters();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    });
  }
})();
