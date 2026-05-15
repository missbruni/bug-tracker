import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useActiveBugCount(initialCount = 3): number {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    if (!supabase) return
    const sb = supabase

    const fetchCount = async () => {
      const { count: c } = await sb
        .from('bugs')
        .select('*', { count: 'exact', head: true })
        .eq('reviewed', false)
      if (c !== null) setCount(c)
    }

    fetchCount()

    const channel = sb
      .channel('layout-bugs-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bugs' },
        () => fetchCount(),
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  return count
}
