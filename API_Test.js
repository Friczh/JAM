(async () => {
  console.clear();
  console.log('JAM Test Suite — started', new Date().toISOString(), '| page:', location.href);

  if (!window.scriptengine) {
    console.error('window.scriptengine not found. JAM is not active on this page (content script may not have injected, or extension is disabled).');
    return;
  }

  const results = [];

  async function runTest(name, fn) {
    try {
      const result = await fn();
      console.log(`[PASS] ${name}`, result !== undefined ? result : '');
      results.push({ name, status: 'PASS', detail: result });
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message || err);
      results.push({ name, status: 'FAIL', detail: err.message || String(err) });
    }
  }

  function skip(name, reason) {
    console.warn(`[SKIP] ${name} — ${reason}`);
    results.push({ name, status: 'SKIP', detail: reason });
  }

  // ---------------- SESSION ----------------
  console.group('Session');
  let sessionId = null;
  const se = window.scriptengine;

  if (se.session?.getId) {
    await runTest('session.getId() [default scan]', () => {
      sessionId = se.session.getId();
      return sessionId;
    });
    await runTest('session.getId(domain) [scoped scan]', () =>
      se.session.getId(location.hostname)
    );
  } else {
    skip('session.getId', 'not implemented');
  }

  if (se.session?.match) {
    await runTest('session.match(id)', () => se.session.match(sessionId));
  } else {
    skip('session.match', 'not implemented');
  }

  if (se.session?.store) {
    await runTest('session.store(id)', () => se.session.store(sessionId || 'qa-fallback-id'));
  } else {
    skip('session.store', 'not implemented');
  }

  if (se.session?.restore) {
    await runTest('session.restore()', () => se.session.restore());
  } else {
    skip('session.restore', 'not implemented');
  }
  console.groupEnd();

  // ---------------- STORAGE ----------------
  console.group('Storage');
  const testKey = 'qa_test_' + Date.now();
  const testValue = 'jam-qa-' + Math.random().toString(36).slice(2);

  if (se.storage?.set && se.storage?.get) {
    await runTest('storage.set()', () => se.storage.set(testKey, testValue));

    await runTest('storage.get() after set (value matches)', async () => {
      const v = await se.storage.get(testKey);
      if (v !== testValue) throw new Error(`expected "${testValue}", got "${v}"`);
      return v;
    });

    if (se.storage.remove) {
      await runTest('storage.remove()', () => se.storage.remove(testKey));
      await runTest('storage.get() after remove (should be null)', async () => {
        const v = await se.storage.get(testKey);
        if (v !== null && v !== undefined) {
          throw new Error(`expected null, got "${v}" — remove() may not be wired up in background.js`);
        }
        return 'confirmed null';
      });
    } else {
      skip('storage.remove', 'not implemented');
    }
  } else {
    skip('storage.*', 'scriptengine.storage not implemented');
  }
  console.groupEnd();

  // ---------------- CLIPBOARD ----------------
  console.group('Clipboard');
  const clipSessionId = sessionId || 'qa-fallback-session';
  const clipText = 'jam-clip-qa-' + Math.random().toString(36).slice(2);

  if (se.clipboard?.write) {
    await runTest('clipboard.write(sessionId, text)', () => se.clipboard.write(clipSessionId, clipText));

    if (se.clipboard.read) {
      await runTest('clipboard.read(sessionId) matches write', async () => {
        const v = await se.clipboard.read(clipSessionId);
        if (v !== clipText) throw new Error(`expected "${clipText}", got "${v}"`);
        return v;
      });
    } else {
      skip('clipboard.read', 'not implemented');
    }

    if (se.clipboard.clear) {
      await runTest('clipboard.clear(sessionId)', () => se.clipboard.clear(clipSessionId));
      await runTest('clipboard.read() after clear (should be empty)', async () => {
        const v = se.clipboard.read ? await se.clipboard.read(clipSessionId) : null;
        if (v) throw new Error(`expected empty, got "${v}" — clear() may not be wired up`);
        return 'confirmed cleared';
      });
    } else {
      skip('clipboard.clear', 'not implemented');
    }
  } else {
    skip('clipboard.*', 'scriptengine.clipboard not implemented');
  }
  console.groupEnd();

  // ---------------- PASTE ----------------
  console.group('Paste / DOM injection');
  const testInput = document.createElement('input');
  testInput.type = 'text';
  testInput.id = '__jam_qa_test_input__';
  testInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(testInput);

  if (se.paste?.code) {
    await runTest('paste.code(code, selector)', () => {
      const ok = se.paste.code('jam-paste-qa', '#__jam_qa_test_input__');
      if (testInput.value !== 'jam-paste-qa') throw new Error(`input value not set, got "${testInput.value}"`);
      return ok;
    });
  } else if (typeof se.paste === 'function') {
    await runTest('paste(code, selector) [legacy signature]', () => {
      const ok = se.paste('jam-paste-qa', '#__jam_qa_test_input__');
      if (testInput.value !== 'jam-paste-qa') throw new Error(`input value not set, got "${testInput.value}"`);
      return ok;
    });
  } else {
    skip('paste.code', 'not implemented');
  }

  if (se.paste?.fromSession) {
    await runTest('paste.fromSession(sessionId, selector)', async () => {
      if (se.clipboard?.write) await se.clipboard.write(clipSessionId, 'jam-paste-from-session-qa');
      testInput.value = '';
      return se.paste.fromSession(clipSessionId, '#__jam_qa_test_input__');
    });
  } else {
    skip('paste.fromSession', 'not implemented');
  }
  testInput.remove();
  console.groupEnd();

  // ---------------- SUBMIT ----------------
  console.group('Submit');
  const testBtn = document.createElement('button');
  testBtn.id = '__jam_qa_test_btn__';
  testBtn.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  let clicked = false;
  testBtn.addEventListener('click', () => { clicked = true; });
  document.body.appendChild(testBtn);

  if (se.submit) {
    await runTest('submit(selector)', () => {
      const ok = se.submit('#__jam_qa_test_btn__');
      if (!clicked) throw new Error('click event did not fire');
      return ok;
    });
  } else {
    skip('submit', 'not implemented');
  }
  testBtn.remove();
  console.groupEnd();

  // ---------------- REFERRER ----------------
  console.group('Referrer spoof');
  if (se.referrer?.set) {
    await runTest('referrer.set(domain)', () => se.referrer.set('qa-test-referrer.example'));
  } else {
    skip('referrer.set', 'not implemented');
  }
  if (se.referrer?.reset) {
    await runTest('referrer.reset()', () => se.referrer.reset());
  } else {
    skip('referrer.reset', 'not implemented');
  }

  await runTest('LIVE CHECK: actual outgoing Referer header', async () => {
    const res = await fetch('https://postman-echo.com/headers', { cache: 'no-store' });
    const data = await res.json();
    const seenReferer = data?.headers?.referer || data?.headers?.referrer || '(none sent)';
    console.log('  -> Server observed Referer:', seenReferer);
    console.log('  -> Compare against the "default" value currently set in JAM options.');
    return seenReferer;
  });
  console.groupEnd();

  // ---------------- VISIBILITY ----------------
  console.group('Visibility spoof');
  if (se.visibility?.spoof) {
    await runTest('visibility.spoof(true) — state check', () => {
      se.visibility.spoof(true);
      const state = {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        hasFocus: document.hasFocus()
      };
      if (state.visibilityState !== 'visible') throw new Error(`visibilityState = "${state.visibilityState}"`);
      if (state.hidden !== false) throw new Error(`hidden = ${state.hidden}`);
      if (state.hasFocus !== true) throw new Error(`hasFocus() = ${state.hasFocus}`);
      return state;
    });

    await runTest('visibilitychange event suppression', () => new Promise((resolve) => {
      let fired = false;
      const handler = () => { fired = true; };
      document.addEventListener('visibilitychange', handler);
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      document.removeEventListener('visibilitychange', handler);
      setTimeout(() => {
        resolve(fired
          ? 'WARNING: handler fired — suppression listener may be registered after this one, or not active'
          : 'confirmed: visibilitychange suppressed');
      }, 0);
    }));
  } else {
    skip('visibility.spoof', 'not implemented');
  }
  console.groupEnd();

  // ---------------- SETTINGS QUERY (proposed read-only API) ----------------
  console.group('Settings query (read-only)');
  if (se.settings?.isReferrerSpoofed) {
    await runTest('settings.isReferrerSpoofed()', () => se.settings.isReferrerSpoofed());
  } else {
    skip('settings.isReferrerSpoofed', 'not implemented yet');
  }
  if (se.settings?.isVisibilitySpoofed) {
    await runTest('settings.isVisibilitySpoofed()', () => se.settings.isVisibilitySpoofed());
  } else {
    skip('settings.isVisibilitySpoofed', 'not implemented yet');
  }
  console.groupEnd();

  // ---------------- SUMMARY ----------------
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`\nPASS: ${pass}  FAIL: ${fail}  SKIP: ${skipped}  TOTAL: ${results.length}`);
  console.table(results);

  window.__jamTestResults = results;
})();