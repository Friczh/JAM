(function () {
  'use strict';

  // Inject bridge.js into page window scope
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge.js');
  script.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(script);

  // Relay messages from page (bridge.js) to background
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

  // Relay visibility spoof setting to page
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
    if (!settings) return;

    const hostname = location.hostname;
    const visEnabled = settings.visibility.enabled &&
      !settings.visibility.excludes.some(d => hostname.includes(d));

    window.postMessage({
      origin: 'jam_content',
      type: 'INIT_VISIBILITY',
      enabled: visEnabled
    }, '*');
  });
})();