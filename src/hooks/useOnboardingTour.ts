import React from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/useAuth'

const METADATA_KEY = 'onboarded_at'

export function useOnboardingTour() {
  const { user } = useAuth()
  const metadata = React.useMemo(
    () => (user?.user_metadata as Record<string, unknown> | undefined) ?? {},
    [user?.user_metadata],
  )
  const onboardedAt = typeof metadata[METADATA_KEY] === 'string' ? (metadata[METADATA_KEY] as string) : ''

  const [dismissed, setDismissed] = React.useState(false)
  const shouldShow = Boolean(user) && !onboardedAt && !dismissed

  const markComplete = React.useCallback(async () => {
    setDismissed(true)
    if (!supabase || !user) return
    const { error } = await supabase.auth.updateUser({
      data: { ...metadata, [METADATA_KEY]: new Date().toISOString() },
    })
    if (error) console.error('Failed to mark onboarding complete:', error)
  }, [metadata, user])

  return { shouldShow, markComplete }
}
