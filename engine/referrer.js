(function () {
  'use strict';

  window.scriptengine.referrer = {
    set(domain) {
      const value = domain.startsWith('http') ? domain : 'https://' + domain;
      return scriptengine.storage.set('referrer_override', value);
    },

    reset() {
      return scriptengine.storage.remove('referrer_override');
    }
  };
})();