const OPEN_PBI_ON_SUCCESS_STORAGE_KEY = 'azure_open_pbi_on_success'

export function shouldOpenPbiOnPublishSuccess(): boolean {
  const stored = localStorage.getItem(OPEN_PBI_ON_SUCCESS_STORAGE_KEY)
  if (stored === null) return true
  return stored === 'true'
}

export function setOpenPbiOnPublishSuccess(enabled: boolean): void {
  localStorage.setItem(OPEN_PBI_ON_SUCCESS_STORAGE_KEY, String(enabled))
}
