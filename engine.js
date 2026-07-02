(function () {
  'use strict';

  let _requestId = 0;
  const _pending = {};
  const _idCache = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.origin !== 'jam_content') return;

    const { requestId, response, type, enabled } = event.data;

    if (type === 'INIT_VISIBILITY') {
      if (enabled) _initVisibility();
      return;
    }

    if (_pending[requestId]) {
      _pending[requestId](response);
      delete _pending[requestId];
    }
  });

  function _send(msg) {
    return new Promise((resolve) => {
      const requestId = ++_requestId;
      _pending[requestId] = resolve;
      window.postMessage({ ...msg, origin: 'jam_bridge', requestId }, '*');
    });
  }

  function _initVisibility() {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });

    document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('focus', (e) => e.stopImmediatePropagation(), true);

    Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true });
  }

  function _resolveId(domain) {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      let url;
      try { url = new URL(s.src, location.href); } catch { continue; }

      if (domain) {
        if (url.hostname !== domain && !url.hostname.endsWith('.' + domain)) continue;
      } else {
        if (url.hostname !== location.hostname) continue;
      }

      const m = url.pathname.match(/\/([a-zA-Z0-9_-]{6,})\.js(?:\?|$)/);
      if (m) return m[1];
    }
    return null;
  }

  window.scriptengine = {
    session: {
      getId(domain) {
        const cacheKey = domain || '__self__';
        if (_idCache.has(cacheKey)) return _idCache.get(cacheKey);
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
    },

    storage: {
      set(key, value) {
        return _send({ type: 'STORAGE_SET', key: 'jam_' + key, value: { value, timestamp: Date.now() } })
          .then(() => true);
      },
      get(key) {
        return _send({ type: 'STORAGE_GET', key: 'jam_' + key })
          .then(r => (r.value ? r.value.value : null));
      },
      remove(key) {
        return _send({ type: 'STORAGE_REMOVE', key: 'jam_' + key })
          .then(() => true);
      }
    },

    clipboard: {
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
    },

    paste: {
      code(code, selector) {
        const el = document.querySelector(selector);
        if (!el) return false;

        if (el.isContentEditable) {
          el.textContent = code;
        } else if (el.tagName === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(el, code);
        } else if (el.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, code);
        } else {
          return false;
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      async fromSession(sessionId, selector) {
        const code = await scriptengine.clipboard.read(sessionId);
        if (!code) return false;
        return this.code(code, selector);
      }
    },

    submit(selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    },

    referrer: {
      set(domain) {
        const value = domain.startsWith('http') ? domain : 'https://' + domain;
        return scriptengine.storage.set('referrer_override', value);
      },
      reset() {
        return scriptengine.storage.remove('referrer_override');
      }
    },

    visibility: {
      spoof(enabled) {
        if (enabled) _initVisibility();
      }
    }
  };
})();