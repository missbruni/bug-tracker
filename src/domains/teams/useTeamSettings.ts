import React from 'react'
import { supabase } from '../../supabaseClient'
import type { TeamRecord } from '../../lib/teamScope'
import type { TeamSettingsUpdate } from './model'

function getSupportedTimezones(): string[] {
  type IntlWithSupportedValues = typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const intl = Intl as IntlWithSupportedValues
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone')
    } catch {
      // fall through
    }
  }
  return [
    'UTC',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Madrid',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
  ]
}

export function useTeamSettings(team: TeamRecord) {
  const initialTimezone = team.timezone ?? ''
  const initialProductId = team.default_product_id ?? ''
  const initialBacklogKey = team.backlog_key ?? ''
  const initialBacklogProvider = team.default_backlog_provider ?? 'azure'

  const [timezone, setTimezone] = React.useState(initialTimezone)
  const [defaultProductId, setDefaultProductId] = React.useState(initialProductId)
  const [backlogKey, setBacklogKey] = React.useState(initialBacklogKey)
  const [backlogProvider, setBacklogProvider] = React.useState<'mushi' | 'azure'>(initialBacklogProvider)
  const [saving, setSaving] = React.useState(false)

  const timezones = React.useMemo(() => getSupportedTimezones(), [])
  const browserTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return ''
    }
  }, [])

  const normalizedBacklogKey = backlogKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  const isDirty = timezone !== initialTimezone || defaultProductId !== initialProductId || normalizedBacklogKey !== initialBacklogKey || backlogProvider !== initialBacklogProvider
  const canSave = Boolean(supabase && isDirty && !saving)

  const saveSettings = async (): Promise<{ error: string | null; updates: TeamSettingsUpdate | null }> => {
    if (!supabase || !canSave) return { error: null, updates: null }
    setSaving(true)
    const nextTimezone = timezone.trim() || null
    const nextProductId = defaultProductId || null
    const nextBacklogKey = normalizedBacklogKey || 'TEAM'
    const updates = {
      timezone: nextTimezone,
      default_product_id: nextProductId,
      backlog_key: nextBacklogKey,
      default_backlog_provider: backlogProvider,
    }
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', team.id)
    setSaving(false)
    return error ? { error: error.message, updates: null } : { error: null, updates }
  }

  return {
    timezone,
    setTimezone,
    defaultProductId,
    setDefaultProductId,
    backlogKey,
    setBacklogKey,
    backlogProvider,
    setBacklogProvider,
    saving,
    timezones,
    browserTimezone,
    normalizedBacklogKey,
    canSave,
    saveSettings,
  }
}
