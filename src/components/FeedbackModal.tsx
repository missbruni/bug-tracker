import { useState, useEffect } from 'react'
import { X, Star, Send, MessageSquareHeart } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam, withTeamPayload } from '../lib/teamScope'
import type { Feedback } from '../types'

interface Props {
  sessionId: string
  sessionName: string
  onClose: () => void
  inline?: boolean
}

const LENGTH_OPTIONS = [
  { value: 'too_short', label: 'Too short' },
  { value: 'just_right', label: 'Just right' },
  { value: 'too_long', label: 'Too long' },
] as const

const HELP_OPTIONS = [
  { value: 'not_at_all', label: 'Not really' },
  { value: 'somewhat', label: 'Somewhat' },
  { value: 'very', label: 'Very helpful' },
] as const

const HELP_COLORS: Record<string, string> = {
  not_at_all: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  somewhat: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  very: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
}

const LENGTH_COLORS: Record<string, string> = {
  too_short: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  just_right: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  too_long: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
}

const HELP_BAR_COLORS: Record<string, string> = {
  not_at_all: 'bg-red-400 dark:bg-red-500',
  somewhat: 'bg-yellow-400 dark:bg-yellow-500',
  very: 'bg-green-500 dark:bg-green-400',
}

const LENGTH_BAR_COLORS: Record<string, string> = {
  too_short: 'bg-red-400 dark:bg-red-500',
  just_right: 'bg-green-500 dark:bg-green-400',
  too_long: 'bg-red-400 dark:bg-red-500',
}

export default function FeedbackModal({ sessionId, sessionName, onClose, inline }: Props) {
  const { activeTeamId } = useTeamAccess()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(() => {
    const done = JSON.parse(localStorage.getItem('feedback_submitted') || '[]') as string[]
    return done.includes(sessionId)
  })
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [lengthFeel, setLengthFeel] = useState('')
  const [clarity, setClarity] = useState(0)
  const [hoverClarity, setHoverClarity] = useState(0)
  const [helpfulness, setHelpfulness] = useState('')
  const [workedWell, setWorkedWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    scopeToTeam(
      supabase.from('session_feedback').select('*').eq('session_id', sessionId).order('created_at'),
      activeTeamId,
    ).then(({ data }) => {
      setFeedbacks((data || []) as Feedback[])
      setLoading(false)
    })
  }, [sessionId, activeTeamId])

  const canSubmit = rating > 0 && lengthFeel && clarity > 0 && helpfulness

  const submit = async () => {
    if (!supabase || !canSubmit || submitting) return
    setSubmitting(true)
    const { error } = await supabase.from('session_feedback').insert(withTeamPayload({
      session_id: sessionId,
      name: name.trim() || null,
      rating,
      length_feel: lengthFeel,
      clarity,
      helpfulness,
      worked_well: workedWell.trim() || null,
      to_improve: toImprove.trim() || null,
    }, activeTeamId))
    if (!error) {
      setSubmitted(true)
      const done = JSON.parse(localStorage.getItem('feedback_submitted') || '[]') as string[]
      if (!done.includes(sessionId)) localStorage.setItem('feedback_submitted', JSON.stringify([...done, sessionId]))
      // Reload feedbacks
      const { data } = await scopeToTeam(
        supabase.from('session_feedback').select('*').eq('session_id', sessionId).order('created_at'),
        activeTeamId,
      )
      setFeedbacks((data || []) as Feedback[])
    }
    setSubmitting(false)
  }

  // Aggregated stats
  const count = feedbacks.length
  const avgRating = count ? feedbacks.reduce((s, f) => s + f.rating, 0) / count : 0
  const avgClarity = count ? feedbacks.reduce((s, f) => s + f.clarity, 0) / count : 0
  const lengthCounts = { too_short: 0, just_right: 0, too_long: 0 }
  const helpCounts = { not_at_all: 0, somewhat: 0, very: 0 }
  feedbacks.forEach(f => { lengthCounts[f.length_feel]++; helpCounts[f.helpfulness]++ })

  const renderStars = (value: number, hover: number, set: (n: number) => void, setHover: (n: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => set(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          className="cursor-pointer transition-transform hover:scale-110">
          <Star size={22} className={`transition-colors ${n <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-gray-600'}`} />
        </button>
      ))}
    </div>
  )

  const renderStatStars = (avg: number) => (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={16} className={`${n <= Math.round(avg) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-gray-600'}`} />
      ))}
      <span className="ml-1.5 text-xs font-bold text-slate-700 dark:text-gray-300">{avg.toFixed(1)}</span>
    </div>
  )

  const renderBar = (counts: Record<string, number>, labels: Record<string, string>, barColors: Record<string, string>) => (
    <div className="space-y-1">
      {Object.entries(counts).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-gray-500 w-20 text-right">{labels[key]}</span>
          <div className="flex-1 h-4 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColors[key] || 'bg-blue-400'}`}
              style={{ width: count ? `${(val / count) * 100}%` : '0%' }} />
          </div>
          <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400 w-6">{val}</span>
        </div>
      ))}
    </div>
  )

  const content = (

        <div className={`${inline ? 'py-0' : 'px-6 py-4'} space-y-5`}>
          {/* Results summary */}
          {loading ? (
            <p className="text-xs text-slate-400 text-center">Loading feedback...</p>
          ) : count > 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300">{count} response{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Overall rating</p>
                  {renderStatStars(avgRating)}
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Scenario clarity</p>
                  {renderStatStars(avgClarity)}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Session length</p>
                {renderBar(lengthCounts, { too_short: 'Too short', just_right: 'Just right', too_long: 'Too long' }, LENGTH_BAR_COLORS)}
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Helpfulness</p>
                {renderBar(helpCounts, { not_at_all: 'Not really', somewhat: 'Somewhat', very: 'Very helpful' }, HELP_BAR_COLORS)}
              </div>
              {/* Written feedback highlights */}
              {feedbacks.some(f => f.worked_well) && (
                <div>
                  <p className="text-[11px] font-bold text-green-600 dark:text-green-400 mb-1">What worked well</p>
                  <div className="space-y-1">
                    {feedbacks.filter(f => f.worked_well).map(f => (
                      <p key={f.id} className="text-xs text-slate-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 rounded-md px-2.5 py-1.5">&ldquo;{f.worked_well}&rdquo;{f.name ? <span className="ml-1 text-slate-400 dark:text-gray-500">— {f.name}</span> : null}</p>
                    ))}
                  </div>
                </div>
              )}
              {feedbacks.some(f => f.to_improve) && (
                <div>
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">What could improve</p>
                  <div className="space-y-1">
                    {feedbacks.filter(f => f.to_improve).map(f => (
                      <p key={f.id} className="text-xs text-slate-600 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-2.5 py-1.5">&ldquo;{f.to_improve}&rdquo;{f.name ? <span className="ml-1 text-slate-400 dark:text-gray-500">— {f.name}</span> : null}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !submitted ? (
            <p className="text-xs text-slate-400 dark:text-gray-600 text-center py-2">No feedback yet. Be the first!</p>
          ) : null}

          {/* Form */}
          {inline ? null : submitted ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Thanks for your feedback!</p>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">Your response has been recorded anonymously.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Your name <span className="font-normal text-slate-400 dark:text-gray-500">(optional — leave blank to stay anonymous)</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Anonymous"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Overall, how was this session? *</label>
                {renderStars(rating, hoverRating, setRating, setHoverRating)}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Session length *</label>
                <div className="flex gap-2">
                  {LENGTH_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setLengthFeel(o.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        lengthFeel === o.value
                          ? LENGTH_COLORS[o.value]
                          : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500 hover:bg-slate-200 dark:hover:bg-gray-700'
                      }`}>{o.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">How clear were the scenarios? *</label>
                {renderStars(clarity, hoverClarity, setClarity, setHoverClarity)}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Was this session helpful? *</label>
                <div className="flex gap-2">
                  {HELP_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setHelpfulness(o.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        helpfulness === o.value
                          ? HELP_COLORS[o.value]
                          : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500 hover:bg-slate-200 dark:hover:bg-gray-700'
                      }`}>{o.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">What worked well?</label>
                <textarea value={workedWell} onChange={e => setWorkedWell(e.target.value)} rows={2} placeholder="Optional"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y focus:border-blue-400 dark:focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">What could we improve?</label>
                <textarea value={toImprove} onChange={e => setToImprove(e.target.value)} rows={2} placeholder="Optional"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y focus:border-blue-400 dark:focus:border-blue-500" />
              </div>

              <button onClick={submit} disabled={!canSubmit || submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-gray-600 transition-colors cursor-pointer disabled:cursor-default">
                <Send size={14} />
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          )}
        </div>
  )

  if (inline) return content

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <MessageSquareHeart size={18} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Session Feedback</h2>
            <span className="text-xs text-slate-400 dark:text-gray-500">{sessionName}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"><X size={18} /></button>
        </div>
        {content}
      </div>
    </div>
  )
}
