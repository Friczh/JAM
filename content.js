(function () {
  'use strict';

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('engine.js');
  script.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.origin !== 'jam_bridge') return;

    const msg = event.data;

    chrome.runtime.sendMessage(msg, (response) => {
      window.postMessage({
        origin: 'jam_content',
        requestId: msg.requestId,
        response
      }, '*');
    });
  });

  chrome.storage.local.get('jam_settings', (res) => {
    const settings = res.jam_settings || {};
    const vis = settings.visibility || {};
    const excludes = Array.isArray(vis.excludes) ? vis.excludes : [];
    const hostname = location.hostname;

    const visEnabled = settings.master !== false && !!vis.enabled &&
      !excludes.some(d => hostname === d || hostname.endsWith('.' + d));

    window.postMessage({
      origin: 'jam_content',
      type: 'INIT_VISIBILITY',
      enabled: visEnabled
    }, '*');
  });
})();