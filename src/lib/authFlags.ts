function readBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

export function isMicrosoftLoginEnabled(): boolean {
  return readBooleanFlag(import.meta.env.VITE_MS_LOGIN_ENABLED as string | undefined)
}
