(function () {
  'use strict';

  const _idCache = new Map();

  function _resolveId(domain) {
    const scripts = document.querySelectorAll('script[src]');

    for (const s of scripts) {
      let url;
      try {
        url = new URL(s.src, location.href);
      } catch {
        continue;
      }

      if (domain) {
        const hostname = url.hostname;
        if (hostname !== domain && !hostname.endsWith('.' + domain)) continue;
      } else {
        if (url.hostname !== location.hostname) continue;
      }

      const m = url.pathname.match(/\/([a-zA-Z0-9_-]{6,})\.js(?:\?|$)/);
      if (m) return m[1];
    }

    return null;
  }

  window.scriptengine.session = {
    getId(domain) {
      const cacheKey = domain || '__self__';

      if (_idCache.has(cacheKey)) {
        return _idCache.get(cacheKey);
      }

      const id = _resolveId(domain);
      _idCache.set(cacheKey, id);
      return id;
    },

    match(id, domain) {
      return this.getId(domain) === id;
    },

    async store(id) {
      return scriptengine.storage.set('session_current', id);
    },

    async restore() {
      return scriptengine.storage.get('session_current');
    }
  };
})();