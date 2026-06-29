(function () {
  'use strict';

  window.scriptengine.paste = {
    code(code, selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, code);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },

    async fromSession(sessionId, selector) {
      const code = await scriptengine.clipboard.read(sessionId);
      if (!code) return false;
      return this.code(code, selector);
    }
  };
})();