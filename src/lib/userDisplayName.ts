import type { User } from '@supabase/supabase-js'

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Unknown'
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const name = typeof metadata?.name === 'string' ? metadata.name.trim() : ''
  if (name && !name.includes('@')) return name
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  if (fullName && !fullName.includes('@')) return fullName
  const email = user.email?.trim()
  if (email) {
    const alias = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || ''
    return alias
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || email
  }
  return 'Unknown'
}
