import { useUIStore } from './store'

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

/** Open the settings sidebar from anywhere */
export function openSettings(): void {
  useUIStore.getState().openSettings()
}
