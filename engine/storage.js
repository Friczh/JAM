(function () {
  'use strict';

  window.scriptengine.storage = {
    set(key, value) {
      return new Promise((resolve) => {
        const payload = { value, timestamp: Date.now() };
        window.postMessage({
          origin: 'jam_bridge',
          requestId: ++window._jam_rid,
          type: 'STORAGE_SET',
          key: 'jam_' + key,
          value: payload
        }, '*');
        resolve(true);
      });
    },

    get(key) {
      return new Promise((resolve) => {
        const requestId = ++window._jam_rid;
        window._jam_pending[requestId] = (res) => resolve(res.value ? res.value.value : null);
        window.postMessage({
          origin: 'jam_bridge',
          requestId,
          type: 'STORAGE_GET',
          key: 'jam_' + key
        }, '*');
      });
    },

    remove(key) {
      return new Promise((resolve) => {
        window.postMessage({
          origin: 'jam_bridge',
          requestId: ++window._jam_rid,
          type: 'STORAGE_REMOVE',
          key: 'jam_' + key
        }, '*');
        resolve(true);
      });
    }
  };
})();