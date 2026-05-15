const DEVIN_KEY_STORAGE = 'devin_api_key'

export function getDevinApiKey(): string {
  return localStorage.getItem(DEVIN_KEY_STORAGE) || ''
}

export function hasDevinApiKey(): boolean {
  return getDevinApiKey().trim().length > 0
}

export function setDevinApiKey(key: string): void {
  localStorage.setItem(DEVIN_KEY_STORAGE, key.trim())
}

export function removeDevinApiKey(): void {
  localStorage.removeItem(DEVIN_KEY_STORAGE)
}

export function isValidDevinKey(key: string): boolean {
  return key.trim().startsWith('apk_user')
}

/** Dispatch this event from anywhere to open the settings sidebar */
export function openSettings(): void {
  window.dispatchEvent(new CustomEvent('openSettings'))
}
