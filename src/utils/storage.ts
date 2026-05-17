const isExtension = typeof chrome !== 'undefined' && chrome.storage?.local;

export async function getStorageItem(key: string): Promise<string | null> {
  if (isExtension) {
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    return typeof value === 'string' ? value : null;
  }
  return localStorage.getItem(key);
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  if (!isExtension) return;
  for (const key of keys) {
    const existing = await chrome.storage.local.get(key);
    if (typeof existing[key] === 'string') continue;
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      await chrome.storage.local.set({ [key]: legacy });
    }
  }
}
