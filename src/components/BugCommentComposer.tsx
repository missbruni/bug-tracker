import React from 'react'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'

interface TeamMentionUser {
  id: string
  email: string
  display_name: string
}

interface TeamMemberRow {
  user_id: string
}

interface BugCommentComposerProps {
  onAddComment: (text: string, mentionedUserIds: string[]) => Promise<void>
  onCancel: () => void
}

function getMentionToken(text: string, cursorPosition: number): { query: string; start: number; end: number } | null {
  const beforeCursor = text.slice(0, cursorPosition)
  const match = beforeCursor.match(/(^|\s)@([^@\n]*)$/)
  if (!match) return null
  return {
    query: match[2].trim().toLowerCase(),
    start: beforeCursor.length - match[2].length - 1,
    end: cursorPosition,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesMention(text: string, displayName: string): boolean {
  return new RegExp(`(^|\\s)@${escapeRegExp(displayName)}(?=\\s|$|[.,!?;:])`, 'i').test(text)
}

export default function BugCommentComposer({ onAddComment, onCancel }: BugCommentComposerProps) {
  const { activeTeamId } = useTeamAccess()
  const [commentText, setCommentText] = React.useState('')
  const [teamUsers, setTeamUsers] = React.useState<TeamMentionUser[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(0)
  const [adding, setAdding] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const fetchTeamUsers = async () => {
      if (!supabase || !activeTeamId) return
      const [membersRes, orgUsersRes] = await Promise.all([
        supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', activeTeamId)
          .eq('status', 'active'),
        supabase.rpc('get_org_users'),
      ])
      if (cancelled || membersRes.error || orgUsersRes.error) return
      const memberIds = new Set(((membersRes.data || []) as TeamMemberRow[]).map((member) => member.user_id))
      const users = ((orgUsersRes.data || []) as TeamMentionUser[])
        .filter((user) => memberIds.has(user.id))
        .sort((firstUser, secondUser) => firstUser.display_name.localeCompare(secondUser.display_name))
      setTeamUsers(users)
    }

    void fetchTeamUsers()
    return () => { cancelled = true }
  }, [activeTeamId])

  const cursorPosition = inputRef.current?.selectionStart ?? commentText.length
  const mentionToken = getMentionToken(commentText, cursorPosition)
  const suggestions = mentionToken
    ? teamUsers
      .filter((user) => {
        if (!mentionToken.query) return true
        return user.display_name.toLowerCase().includes(mentionToken.query) || user.email.toLowerCase().includes(mentionToken.query)
      })
      .slice(0, 6)
    : []

  React.useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [mentionToken?.query])

  const selectSuggestion = (user: TeamMentionUser) => {
    if (!mentionToken) return
    const nextText = `${commentText.slice(0, mentionToken.start)}@${user.display_name} ${commentText.slice(mentionToken.end)}`
    setCommentText(nextText)
    requestAnimationFrame(() => {
      const nextPosition = mentionToken.start + user.display_name.length + 2
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextPosition, nextPosition)
    })
  }

  const mentionedUserIds = teamUsers
    .filter((user) => includesMention(commentText, user.display_name))
    .map((user) => user.id)
  const mentionedUsers = teamUsers.filter((user) => mentionedUserIds.includes(user.id))

  const handleAddComment = async () => {
    if (!commentText.trim() || adding) return
    setAdding(true)
    await onAddComment(commentText, Array.from(new Set(mentionedUserIds)))
    if (mountedRef.current) setAdding(false)
  }

  return (
    <div className="relative flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          onKeyDown={(event) => {
            if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
              event.preventDefault()
              setActiveSuggestionIndex((currentIndex) => {
                const direction = event.key === 'ArrowDown' ? 1 : -1
                return (currentIndex + direction + suggestions.length) % suggestions.length
              })
              return
            }
            if (suggestions.length && (event.key === 'Enter' || event.key === 'Tab')) {
              event.preventDefault()
              selectSuggestion(suggestions[activeSuggestionIndex])
              return
            }
            if (event.key === 'Escape') {
              onCancel()
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleAddComment()
            }
          }}
          placeholder="Write a comment... use @ to tag someone"
          className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500"
          autoFocus
        />
        <button
          onClick={() => void handleAddComment()}
          disabled={!commentText.trim() || adding}
          className="rounded-md bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>
      {mentionedUsers.length > 0 && (
        <p className="text-[11px] text-teal-600 dark:text-mushi-primary">
          {mentionedUsers.map((user) => user.display_name).join(', ')} will be notified by email.
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-72 overflow-hidden rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                selectSuggestion(user)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${index === activeSuggestionIndex ? 'bg-teal-50 dark:bg-mushi-primary/10' : 'hover:bg-slate-50 dark:hover:bg-gray-800'}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold uppercase text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                {user.display_name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800 dark:text-gray-100">{user.display_name}</span>
                <span className="block truncate text-[10px] text-slate-400 dark:text-gray-500">{user.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
