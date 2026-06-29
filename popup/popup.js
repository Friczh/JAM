(function () {
  'use strict';

  const ids = ['toggle-master', 'toggle-referrer', 'toggle-visibility'];

  chrome.storage.local.get('jam_settings', (res) => {
    const settings = res.jam_settings || {
      master: true,
      referrer: { enabled: true },
      visibility: { enabled: false }
    };

    document.getElementById('toggle-master').checked = settings.master ?? true;
    document.getElementById('toggle-referrer').checked = settings.referrer.enabled ?? true;
    document.getElementById('toggle-visibility').checked = settings.visibility.enabled ?? false;
  });

  function save() {
    chrome.storage.local.get('jam_settings', (res) => {
      const settings = res.jam_settings || {};
      settings.master = document.getElementById('toggle-master').checked;
      settings.referrer = { ...settings.referrer, enabled: document.getElementById('toggle-referrer').checked };
      settings.visibility = { ...settings.visibility, enabled: document.getElementById('toggle-visibility').checked };
      chrome.storage.local.set({ jam_settings: settings });
    });
  }

  ids.forEach(id => {
    document.getElementById(id).addEventListener('change', save);
  });

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
