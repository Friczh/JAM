(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    master: true,
    referrer: { enabled: true, default: 'https://www.google.com', custom: '', excludes: [] },
    visibility: { enabled: false, excludes: [] },
    scripts: {}
  };

  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  function loadSettings() {
    chrome.storage.local.get('jam_settings', (res) => {
      if (res.jam_settings) settings = res.jam_settings;
      applyToUI();
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ jam_settings: settings });
  }

  function applyToUI() {
    document.getElementById('ref-enabled').checked = settings.referrer.enabled ?? true;
    document.getElementById('ref-default').value = settings.referrer.default ?? 'https://www.google.com';
    document.getElementById('ref-custom').value = settings.referrer.custom ?? '';
    document.getElementById('vis-enabled').checked = settings.visibility.enabled ?? false;
    renderExcludes('ref', settings.referrer.excludes || []);
    renderExcludes('vis', settings.visibility.excludes || []);
    renderScripts(settings.scripts || {});
  }

  function renderExcludes(prefix, excludes) {
    const list = document.getElementById(prefix + '-exclude-list');
    list.innerHTML = '';
    excludes.forEach((domain, i) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `${domain} <span class="tag-remove" data-i="${i}" data-prefix="${prefix}">✕</span>`;
      list.appendChild(tag);
    });
  }

  function renderScripts(scripts) {
    const list = document.getElementById('script-list');
    list.innerHTML = '';
    const keys = Object.keys(scripts);
    if (!keys.length) {
      list.innerHTML = '<div class="card-row"><div class="row-label" style="color:#666">No scripts installed.</div></div>';
      return;
    }
    keys.forEach((key) => {
      const s = scripts[key];
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <div>
          <div class="row-label">${s.name || key}</div>
          <div class="row-sub">${s.match || ''} · v${s.version || '1.0'}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" data-key="${key}" ${s.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>`;
      list.appendChild(row);
    });
  }

  function addExclude(prefix) {
    const input = document.getElementById(prefix + '-exclude-input');
    const val = input.value.trim();
    if (!val) return;
    const key = prefix === 'ref' ? 'referrer' : 'visibility';
    if (!settings[key].excludes.includes(val)) {
      settings[key].excludes.push(val);
      saveSettings();
      renderExcludes(prefix, settings[key].excludes);
    }
    input.value = '';
  }

  function removeExclude(prefix, index) {
    const key = prefix === 'ref' ? 'referrer' : 'visibility';
    settings[key].excludes.splice(index, 1);
    saveSettings();
    renderExcludes(prefix, settings[key].excludes);
  }

  function showPage(name, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    el.classList.add('active');
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const collapsed = sidebar.classList.toggle('collapsed');
    document.getElementById('toggle-path').setAttribute('d',
      collapsed
        ? 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'
        : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'
    );
  }

  // Event bindings (CSP-safe — no inline handlers)
  document.getElementById('ref-enabled').addEventListener('change', (e) => {
    settings.referrer.enabled = e.target.checked;
    saveSettings();
  });

  document.getElementById('ref-default').addEventListener('change', (e) => {
    settings.referrer.default = e.target.value.trim();
    saveSettings();
  });

  document.getElementById('ref-custom').addEventListener('change', (e) => {
    settings.referrer.custom = e.target.value.trim();
    saveSettings();
  });

  document.getElementById('vis-enabled').addEventListener('change', (e) => {
    settings.visibility.enabled = e.target.checked;
    saveSettings();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-remove')) {
      removeExclude(e.target.dataset.prefix, parseInt(e.target.dataset.i));
    }
    if (e.target.closest('#script-list input[type="checkbox"]')) {
      const key = e.target.dataset.key;
      if (key && settings.scripts[key]) {
        settings.scripts[key].enabled = e.target.checked;
        saveSettings();
      }
    }
  });

  document.getElementById('ref-exclude-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addExclude('ref');
  });

  document.getElementById('vis-exclude-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addExclude('vis');
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => showPage(el.dataset.page, el));
  });

  document.getElementById('toggle-sidebar-btn').addEventListener('click', toggleSidebar);

  document.querySelectorAll('.btn-add').forEach(el => {
    el.addEventListener('click', () => addExclude(el.dataset.prefix));
  });

  loadSettings();
})();