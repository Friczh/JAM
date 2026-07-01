const DEFAULT_REFERRER = 'https://www.google.com';

let settings = {
  referrer: { enabled: true, default: DEFAULT_REFERRER, custom: '', excludes: [] },
  visibility: { enabled: false, excludes: [] }
};

let referrerOverride = null; // set via scriptengine.referrer.set() -> jam_referrer_override

chrome.storage.local.get(['jam_settings', 'jam_referrer_override'], (res) => {
  if (res.jam_settings) settings = res.jam_settings;
  if (res.jam_referrer_override) referrerOverride = res.jam_referrer_override.value || null;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.jam_settings) settings = changes.jam_settings.newValue;
  if (changes.jam_referrer_override) {
    referrerOverride = changes.jam_referrer_override.newValue
      ? changes.jam_referrer_override.newValue.value
      : null;
  }
});

function matchesExclude(hostname, excludes) {
  return excludes.some(d => hostname === d || hostname.endsWith('.' + d));
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!settings.referrer.enabled) return { requestHeaders: details.requestHeaders };

    const url = new URL(details.url);
    if (matchesExclude(url.hostname, settings.referrer.excludes)) {
      return { requestHeaders: details.requestHeaders };
    }

    // Priority: script-driven referrer.set() > Options-page custom > default
    const newReferrer = referrerOverride
      || (settings.referrer.custom && settings.referrer.custom.trim())
      || settings.referrer.default;

    const headers = details.requestHeaders.filter(h => h.name.toLowerCase() !== 'referer');
    headers.push({ name: 'Referer', value: newReferrer });
    return { requestHeaders: headers };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'STORAGE_SET') {
    chrome.storage.local.set({ [msg.key]: msg.value }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'STORAGE_GET') {
    chrome.storage.local.get(msg.key, (res) => sendResponse({ value: res[msg.key] ?? null }));
    return true;
  }
  if (msg.type === 'STORAGE_REMOVE') {
    chrome.storage.local.remove(msg.key, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'GET_SETTINGS') {
    sendResponse(settings);
    return true;
  }
});