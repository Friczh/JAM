const DEFAULT_REFERRER = 'https://www.google.com';

let settings = {
  referrer: { enabled: true, default: DEFAULT_REFERRER, excludes: [] },
  visibility: { enabled: true, excludes: [] }
};

chrome.storage.local.get('jam_settings', (res) => {
  if (res.jam_settings) settings = res.jam_settings;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.jam_settings) settings = changes.jam_settings.newValue;
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!settings.referrer.enabled) return { requestHeaders: details.requestHeaders };

    const url = new URL(details.url);
    if (settings.referrer.excludes.some(d => url.hostname.includes(d))) {
      return { requestHeaders: details.requestHeaders };
    }

    const headers = details.requestHeaders.filter(h => h.name.toLowerCase() !== 'referer');
    headers.push({ name: 'Referer', value: settings.referrer.default });
    return { requestHeaders: headers };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']
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
  if (msg.type === 'GET_SETTINGS') {
    sendResponse(settings);
    return true;
  }
}};