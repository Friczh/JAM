(function () {
  'use strict';

  let _requestId = 0;
  const _pending = {};

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
    window.document.hasFocus = () => true;
  }

  window.scriptengine = {
    session: {
      getId() {
        for (const s of document.querySelectorAll('script[src]')) {
          const m = s.src.match(/\/([a-zA-Z0-9_-]{6,})\.js(?:\?|$)/);
          if (m) return m[1];
        }
        return null;
      },
      match(id) {
        return this.getId() === id;
      }
    },

    storage: {
      set(key, value) {
        return _send({ type: 'STORAGE_SET', key: 'jam_' + key, value });
      },
      get(key) {
        return _send({ type: 'STORAGE_GET', key: 'jam_' + key }).then(r => r.value);
      }
    },

    clipboard: {
      async write(text) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          const el = document.createElement('textarea');
          el.value = text;
          el.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          el.remove();
          return true;
        }
      }
    },

    paste(code, selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, code);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },

    submit(selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    },

    referrer: {
      set(domain) {
        return _send({ type: 'STORAGE_SET', key: 'jam_referrer_override', value: domain });
      }
    },

    visibility: {
      spoof(enabled) {
        if (enabled) _initVisibility();
      }
    }
  };
})();