(async function () {
  'use strict';

  const STATE = {
    LIVE: 'Live',
    LIVE_ERR: 'Live with error',
    NOT_WORKING: 'Not Working',
    NOT_IMPL: 'Not Implemented'
  };

  const results = [];

  function record(name, state, detail) {
    results.push({ name, state, detail });
    const color = {
      [STATE.LIVE]: 'color:#30d158;font-weight:bold',
      [STATE.LIVE_ERR]: 'color:#ffd60a;font-weight:bold',
      [STATE.NOT_WORKING]: 'color:#ff453a;font-weight:bold',
      [STATE.NOT_IMPL]: 'color:#888;font-weight:bold'
    }[state];
    console.log(`%c[${state}]%c ${name} — ${detail}`, color, 'color:inherit');
  }

  function exists(fn) {
    return typeof fn === 'function';
  }

  async function safe(name, checkExists, fn) {
    if (!checkExists()) {
      record(name, STATE.NOT_IMPL, 'function not found on scriptengine');
      return;
    }
    try {
      const result = await fn();
      if (result === false) {
        record(name, STATE.NOT_WORKING, 'assertion failed, see console above');
      } else if (result === 'warn') {
        record(name, STATE.LIVE_ERR, 'completed but partial/unexpected result');
      } else {
        record(name, STATE.LIVE, typeof result === 'string' ? result : 'passed all assertions');
      }
    } catch (e) {
      record(name, STATE.NOT_WORKING, 'threw: ' + e.message);
    }
  }

  window.runAllTests = async function () {
    results.length = 0;
    console.clear();
    console.log('%cJAM scriptengine — Functional Test Suite', 'font-size:14px;font-weight:bold;color:#0078d4');

    if (!window.scriptengine) {
      console.log('%cwindow.scriptengine not found at all. Aborting.', 'color:#ff453a;font-weight:bold');
      return;
    }

    const se = window.scriptengine;
    const rand = () => Math.random().toString(36).slice(2, 10);

    // --- session.getId / match ---
    await safe('session.getId(domain)', () => exists(se.session?.getId), async () => {
      const testDomain = 'jam-test-' + rand() + '.internal';
      const hash = rand() + rand();
      const script = document.createElement('script');
      script.src = `https://${testDomain}/widget/${hash}.js`;
      document.head.appendChild(script);

      const id = se.session.getId(testDomain);
      script.remove();

      if (id !== hash) {
        console.warn('Expected', hash, 'got', id);
        return false;
      }

      // Cache check: script removed from DOM, second call must still return cached value
      const cachedId = se.session.getId(testDomain);
      if (cachedId !== hash) {
        console.warn('Cache failed to persist after DOM removal');
        return 'warn';
      }
      return `resolved and cached "${hash}" correctly`;
    });

    await safe('session.match(id, domain)', () => exists(se.session?.match), async () => {
      const testDomain = 'jam-test-' + rand() + '.internal';
      const hash = rand() + rand();
      const script = document.createElement('script');
      script.src = `https://${testDomain}/widget/${hash}.js`;
      document.head.appendChild(script);
      se.session.getId(testDomain); // populate cache
      script.remove();

      const matchTrue = se.session.match(hash, testDomain);
      const matchFalse = se.session.match('wrong-id', testDomain);
      if (!matchTrue || matchFalse) return false;
      return 'correctly matched valid ID and rejected invalid ID';
    });

    await safe('session.store(id) / restore()', () => exists(se.session?.store) && exists(se.session?.restore), async () => {
      const testId = 'session-' + rand();
      await se.session.store(testId);
      const restored = await se.session.restore();
      if (restored !== testId) {
        console.warn('Expected', testId, 'got', restored);
        return false;
      }
      return `stored and restored "${testId}"`;
    });

    // --- storage ---
    await safe('storage.set / get', () => exists(se.storage?.set) && exists(se.storage?.get), async () => {
      const key = 'test-' + rand();
      const value = { foo: rand(), n: Math.random() };
      await se.storage.set(key, value);
      const got = await se.storage.get(key);
      if (JSON.stringify(got) !== JSON.stringify(value)) {
        console.warn('Round trip mismatch', value, '!==', got);
        return false;
      }
      return 'round-tripped complex object correctly';
    });

    await safe('storage.remove', () => exists(se.storage?.remove), async () => {
      const key = 'test-' + rand();
      await se.storage.set(key, 'temp-value');
      await se.storage.remove(key);
      const got = await se.storage.get(key);
      if (got !== null && got !== undefined) {
        console.warn('Expected null after remove, got', got);
        return false;
      }
      return 'value correctly nulled after remove';
    });

    // --- clipboard (session-scoped) ---
    await safe('clipboard.write / read (session-scoped)', () => exists(se.clipboard?.write) && exists(se.clipboard?.read), async () => {
      const sessionId = 'sess-' + rand();
      const code = 'CODE-' + rand().toUpperCase();
      await se.clipboard.write(sessionId, code);
      const got = await se.clipboard.read(sessionId);
      if (got !== code) {
        console.warn('Expected', code, 'got', got);
        return false;
      }

      // Cross-session isolation check
      const otherSessionRead = await se.clipboard.read('sess-' + rand());
      if (otherSessionRead === code) {
        console.warn('Clipboard leaked across different sessionId');
        return 'warn';
      }
      return `wrote/read "${code}" scoped to session, isolated from other sessions`;
    });

    await safe('clipboard.clear', () => exists(se.clipboard?.clear), async () => {
      const sessionId = 'sess-' + rand();
      await se.clipboard.write(sessionId, 'to-be-cleared');
      await se.clipboard.clear(sessionId);
      const got = await se.clipboard.read(sessionId);
      if (got !== null && got !== undefined) {
        console.warn('Expected null after clear, got', got);
        return false;
      }
      return 'cleared correctly';
    });

    // --- paste ---
    await safe('paste.code(code, selector)', () => exists(se.paste?.code), async () => {
      const input = document.createElement('input');
      input.id = 'jam-test-input-' + rand();
      document.body.appendChild(input);

      let inputEventFired = false;
      let changeEventFired = false;
      input.addEventListener('input', () => inputEventFired = true);
      input.addEventListener('change', () => changeEventFired = true);

      const testCode = 'PASTE-' + rand().toUpperCase();
      const ok = se.paste.code(testCode, '#' + input.id);
      const valueMatches = input.value === testCode;
      input.remove();

      if (!ok || !valueMatches) {
        console.warn('paste failed, value:', input.value, 'expected:', testCode);
        return false;
      }
      if (!inputEventFired || !changeEventFired) {
        return 'warn'; // value set but events didn't fire — breaks React/Vue-controlled inputs
      }
      return `pasted "${testCode}" and fired input+change events`;
    });

    await safe('paste.fromSession(sessionId, selector)', () => exists(se.paste?.fromSession), async () => {
      const sessionId = 'sess-' + rand();
      const code = 'FROMSESH-' + rand().toUpperCase();
      await se.clipboard.write(sessionId, code);

      const input = document.createElement('input');
      input.id = 'jam-test-input-' + rand();
      document.body.appendChild(input);

      const ok = await se.paste.fromSession(sessionId, '#' + input.id);
      const matches = input.value === code;
      input.remove();

      if (!ok || !matches) {
        console.warn('Expected', code, 'got', input.value);
        return false;
      }
      return `pulled "${code}" from session clipboard and pasted`;
    });

    // --- submit ---
    await safe('submit(selector)', () => exists(se.submit), async () => {
      const btn = document.createElement('button');
      btn.id = 'jam-test-btn-' + rand();
      let clicked = false;
      btn.addEventListener('click', () => clicked = true);
      document.body.appendChild(btn);

      const ok = se.submit('#' + btn.id);
      btn.remove();

      if (!ok || !clicked) return false;
      return 'dispatched real click event, handler fired';
    });

    // --- referrer ---
    await safe('referrer.set / actual outgoing Referer header', () => exists(se.referrer?.set), async () => {
      const testReferrer = 'https://test-referrer-' + rand() + '.example.com';
      await se.referrer.set(testReferrer);

      const stored = await se.storage.get('referrer_override');
      if (stored !== testReferrer) {
        console.warn('Storage round trip failed. Expected', testReferrer, 'got', stored);
        await se.referrer.reset();
        return false;
      }

      try {
        const res = await fetch('https://httpbin.org/headers', { cache: 'no-store' });
        const json = await res.json();
        const sentReferer = json.headers && json.headers.Referer;
        await se.referrer.reset();

        if (sentReferer !== testReferrer) {
          console.warn('background.js did not apply override. Expected Referer', testReferrer, 'got', sentReferer);
          return false;
        }
        return `storage AND actual outgoing Referer header both confirmed as "${testReferrer}"`;
      } catch (e) {
        await se.referrer.reset();
        console.warn('Network check unavailable (' + e.message + '); storage round trip confirmed only');
        return 'warn';
      }
    });

    await safe('referrer.reset', () => exists(se.referrer?.reset), async () => {
      await se.referrer.set('https://temp.example.com');
      await se.referrer.reset();
      const stored = await se.storage.get('referrer_override');
      if (stored !== null && stored !== undefined) {
        console.warn('Expected null after reset, got', stored);
        return false;
      }
      return 'cleared override correctly';
    });

    // --- visibility ---
    await safe('visibility.spoof(true) — state + event suppression', () => exists(se.visibility?.spoof), async () => {
      se.visibility.spoof(true);

      const stateOk = document.hidden === false &&
        document.visibilityState === 'visible' &&
        document.hasFocus() === true;

      if (!stateOk) {
        console.warn('State spoof failed', {
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus()
        });
        return false;
      }

      // Real suppression test: listeners added AFTER spoof must not fire
      let blurFired = false, focusFired = false, visChangeFired = false;
      window.addEventListener('blur', () => blurFired = true);
      window.addEventListener('focus', () => focusFired = true);
      document.addEventListener('visibilitychange', () => visChangeFired = true);

      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));

      if (blurFired || focusFired || visChangeFired) {
        console.warn('Suppression leaked:', { blurFired, focusFired, visChangeFired });
        return 'warn';
      }

      return 'state spoofed AND blur/focus/visibilitychange fully suppressed';
    });

    // --- summary ---
    console.log('%c\n--- SUMMARY ---', 'font-weight:bold;font-size:13px');
    console.table(results);

    const counts = results.reduce((acc, r) => {
      acc[r.state] = (acc[r.state] || 0) + 1;
      return acc;
    }, {});
    console.log(counts);

    return results;
  };

  console.log('%cTest suite loaded. Run: runAllTests()', 'color:#0078d4;font-weight:bold');
})();
