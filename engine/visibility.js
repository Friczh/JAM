(function () {
  'use strict';

  window.scriptengine.visibility = {
    spoof(enabled) {
      if (!enabled) return;

      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
      });

      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true
      });

      document.addEventListener('visibilitychange', (e) => {
        e.stopImmediatePropagation();
      }, true);

      window.document.hasFocus = () => true;

      Object.defineProperty(document, 'hasFocus', {
        value: () => true,
        configurable: true
      });
    }
  };
})();