(function () {
  'use strict';

  window.scriptengine.clipboard = {
    async write(sessionId, text) {
      await scriptengine.storage.set('clip_' + sessionId, text);
      return true;
    },

    async read(sessionId) {
      return scriptengine.storage.get('clip_' + sessionId);
    },

    async clear(sessionId) {
      return scriptengine.storage.remove('clip_' + sessionId);
    }
  };
})();