(function () {
  'use strict';

  window.scriptengine.session = {
    getId() {
      for (const s of document.querySelectorAll('script[src]')) {
        const m = s.src.match(/\/([a-zA-Z0-9_-]{6,})\.js(?:\?|$)/);
        if (m) return m[1];
      }
      return null;
    },

    match(id) {
      return this.getId() === id;
    },

    async store(id) {
      return scriptengine.storage.set('session_current', id);
    },

    async restore() {
      return scriptengine.storage.get('session_current');
    }
  };
})();
