import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Package } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam } from '../lib/teamScope'
import type { Session, Scenario, Tester, Assignment } from '../types'

interface Slide {
  type: 'title' | 'objective' | 'timeline' | 'assignments' | 'scenario' | 'crosscutting' | 'edgecases' | 'bugreporting' | 'tips'
  scenario?: Scenario
  assignedTester?: Tester | null
}

const CROSS_CUTTING = [
  { id: 'X1', title: 'Back/Forward', desc: 'Navigate through the funnel → Press Back → State preserved? Basket still there? URL params intact?' },
  { id: 'X2', title: 'Page Refresh', desc: 'Add rooms to basket → Refresh the page → Basket should survive → Form data restored on summary' },
  { id: 'X3', title: 'Slow Network', desc: 'Throttle to Slow 3G in DevTools → Loading spinners appear? No layout shifts? No broken states?' },
  { id: 'X4', title: 'Console Errors', desc: 'Keep DevTools open the whole time → Any JS errors? Log them as bugs with the page + action that caused them' },
]

const EDGE_CASES = [
  'Rapid double-click "Add to basket" — no duplicates',
  'Max rooms limit — can\'t exceed maximum',
  'Long hotel/room names — truncation works',
  'Bed preference — try rooms with "Both" config',
  '404 page — type a random URL → not-found page',
  'Network error — go offline briefly → error state',
  'Cookie consent — accept / reject / manage all work',
  'Deep link: ?arrival=...&departure=...&adults=2',
  'Keyboard nav — tab through room cards + forms',
  'Form validation — submit empty, bad email, bad phone',
]

const TIPS = [
  'Focus on YOUR scenario first — finish it before doing cross-cutting checks',
  'Complete at least one full booking — PMS testers: check PMS within 2–3 min',
  'If payment fails — note the error and try a non-payment rate instead',
  'Keep DevTools console open — any JS error is worth logging',
  'Record your screen — makes bugs easier to reproduce later',
  'Use realistic data — real-ish names, emails, phone numbers',
  'Don\'t skip special requests — type something in the free text field',
  'Ask questions! — if something is unclear, ask before assuming',
]

export default function PresentationPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activeTeamId } = useTeamAccess()
  const [session, setSession] = useState<Session | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [productName, setProductName] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !sessionId) return
    const [sessRes, scenRes, assignRes, testRes] = await Promise.all([
      scopeToTeam(supabase.from('sessions').select('*').eq('id', sessionId).single(), activeTeamId),
      scopeToTeam(supabase.from('scenarios').select('*').eq('session_id', sessionId).order('sort_order'), activeTeamId),
      scopeToTeam(supabase.from('assignments').select('*').eq('session_id', sessionId), activeTeamId),
      scopeToTeam(supabase.from('testers').select('*'), activeTeamId),
    ])

    const sess = sessRes.data as Session | null
    const scenarios = (scenRes.data || []) as Scenario[]
    const assigns = (assignRes.data || []) as Assignment[]
    const allTesters = (testRes.data || []) as Tester[]

    setSession(sess)

    // Fetch team + product names
    if (supabase && sess?.team_id) {
      supabase.from('teams').select('name').eq('id', sess.team_id).single().then(({ data: t }) => {
        if (t) setTeamName((t as { name: string }).name)
      })
    }
    if (supabase && sess?.product_id) {
      supabase.from('products').select('name').eq('id', sess.product_id).single().then(({ data: p }) => {
        if (p) setProductName((p as { name: string }).name)
      })
    }

    const testerMap = new Map(allTesters.map(t => [t.id, t]))
    const assignMap = new Map(assigns.map(a => [a.scenario_id, testerMap.get(a.tester_id) || null]))

    const builtSlides: Slide[] = [
      { type: 'title' },
      { type: 'objective' },
      { type: 'timeline' },
      { type: 'assignments' },
      ...scenarios.map(sc => ({
        type: 'scenario' as const,
        scenario: sc,
        assignedTester: assignMap.get(sc.id) || null,
      })),
      { type: 'crosscutting' },
      { type: 'edgecases' },
      { type: 'bugreporting' },
      { type: 'tips' },
    ]

    setSlides(builtSlides)
    setLoading(false)
  }, [sessionId, activeTeamId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setCurrent(c => Math.min(c + 1, slides.length - 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrent(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Escape') {
        navigate(`/sessions/${sessionId}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [slides.length, navigate, sessionId])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-500 text-sm">Loading...</div>
  }

  const slide = slides[current]
  if (!slide || !session) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-500 text-sm">Session not found</div>
  }

  const appUrl = `${window.location.origin}/`

  // Get all scenarios+assignments for the assignments slide
  const scenarioSlides = slides.filter(s => s.type === 'scenario')
  const totalTesters = new Set(scenarioSlides.filter(s => s.assignedTester).map(s => s.assignedTester!.id)).size

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans select-none">
      {/* Navigation overlay */}
      <div className="fixed inset-0 z-10 flex">
        <div className="w-1/3 cursor-pointer" onClick={() => setCurrent(c => Math.max(c - 1, 0))} />
        <div className="w-1/3" />
        <div className="w-1/3 cursor-pointer" onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))} />
      </div>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3">
        <button onClick={() => navigate(`/sessions/${sessionId}`)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer z-20">
          <X size={14} /> Exit
        </button>
        <span className="text-xs text-gray-600 font-mono">{current + 1} / {slides.length}</span>
      </div>

      {/* Bottom nav arrows */}
      <div className="fixed bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-4">
        <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}
          className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))} disabled={current === slides.length - 1}
          className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Slide content */}
      <div className="min-h-screen flex items-center justify-center px-12 py-16 relative z-0">
        <div className="w-full max-w-5xl">

          {/* TITLE */}
          {slide.type === 'title' && (
            <div className="text-center">
              {(teamName || productName) && (
                <div className="flex items-center justify-center gap-3 mb-3 text-lg text-gray-500">
                  {teamName && <span className="font-semibold text-blue-400">{teamName}</span>}
                  {teamName && productName && <span className="text-gray-600">·</span>}
                  {productName && (
                    <span className="flex items-center gap-1.5 font-medium text-amber-400">
                      <Package size={16} />
                      {productName}
                    </span>
                  )}
                </div>
              )}
              <h2 className="text-xl text-gray-400 font-medium mb-8">{session.name}</h2>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="inline-block bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 text-sm font-semibold">
                  <span className="text-amber-400">{totalTesters}</span> Testers
                </span>
                <span className="inline-block bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 text-sm font-semibold">
                  <span className="text-amber-400">{scenarioSlides.length}</span> Scenarios
                </span>
                <span className="inline-block bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 text-sm font-semibold">
                  <span className="text-amber-400">1</span> Hour
                </span>
              </div>
              <p className="mt-8 text-sm text-gray-600">Full Feature Coverage · Real Devices · PMS Verification · Pilot Readiness</p>
            </div>
          )}

          {/* OBJECTIVE */}
          {slide.type === 'objective' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-4">What We're Testing</h2>
              <p className="text-base text-gray-400 mb-6">
                Complete the <span className="text-amber-400 font-semibold">full booking flow</span> end-to-end on different devices and confirm each reservation <span className="text-green-400">appears correctly in the PMS</span>.
              </p>
              <div className="flex items-center gap-1 flex-wrap mb-6">
                {['Home', 'Search', 'Availabilities', 'Room Detail', 'Add-ons', 'Summary', 'Payment'].map((step, i) => (
                  <span key={step}>
                    {i > 0 && <span className="text-gray-600 mx-1">→</span>}
                    <span className="inline-block bg-gray-900 border border-gray-700 px-3 py-1.5 rounded text-sm font-medium">{step}</span>
                  </span>
                ))}
                <span className="text-gray-600 mx-1">→</span>
                <span className="inline-block bg-gray-900 border border-green-700 text-green-400 px-3 py-1.5 rounded text-sm font-medium">Confirmation</span>
                <span className="text-gray-600 mx-1">→</span>
                <span className="inline-block bg-gray-900 border border-green-700 text-green-400 px-3 py-1.5 rounded text-sm font-medium">PMS ✓</span>
              </div>
              <p className="text-sm text-gray-600">Each tester gets one focused scenario. After finishing, everyone runs the same cross-cutting checks on their device.</p>
            </div>
          )}

          {/* TIMELINE */}
          {slide.type === 'timeline' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Session Timeline</h2>
              <div className="space-y-3">
                {[
                  { time: '0:00 – 0:05', label: 'Briefing', desc: 'Open your URL, clear browser cache, confirm your scenario', color: 'border-blue-400' },
                  { time: '0:05 – 0:40', label: 'Your Scenario', desc: 'Follow your card step by step. Complete at least 1 full booking.', color: 'border-green-400' },
                  { time: '0:40 – 0:50', label: 'Cross-cutting', desc: 'Everyone runs the same 4 quick checks on their device', color: 'border-purple-400' },
                  { time: '0:50 – 0:55', label: 'Edge Cases', desc: 'Pick 2–3 quick tests from the list', color: 'border-amber-400' },
                  { time: '0:55 – 1:00', label: 'Log Bugs', desc: 'Report everything in Mushi', color: 'border-red-400' },
                ].map(item => (
                  <div key={item.label} className={`flex items-center gap-4 bg-gray-900 rounded-lg p-4 border-l-4 ${item.color}`}>
                    <span className="text-amber-400 font-bold text-sm min-w-[100px]">{item.time}</span>
                    <span><strong className="text-gray-100">{item.label}</strong> — {item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ASSIGNMENTS */}
          {slide.type === 'assignments' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Tester Assignment</h2>
              <div className="grid grid-cols-3 gap-2">
                {scenarioSlides.map(s => (
                  <div key={s.scenario!.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 relative">
                    <div className="text-blue-400 font-bold text-sm mb-0.5">Tester {s.scenario!.letter}</div>
                    <div className="text-gray-500 text-xs mb-1">{s.scenario!.title}</div>
                    {s.scenario!.device_requirement && (
                      <div className="text-amber-400 text-xs font-medium mb-1">{s.scenario!.device_requirement}</div>
                    )}
                    {s.assignedTester ? (
                      <span className="inline-block bg-blue-500 text-gray-950 font-bold px-2 py-0.5 rounded-full text-xs mt-1">
                        {s.assignedTester.name}
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-800 text-gray-500 border border-dashed border-gray-700 px-2 py-0.5 rounded-full text-xs mt-1">
                        Unassigned
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCENARIO */}
          {slide.type === 'scenario' && slide.scenario && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-gray-950 text-lg font-extrabold">
                  {slide.scenario.letter}
                </span>
                <h2 className="text-2xl font-bold text-gray-100">{slide.scenario.title}</h2>
              </div>
              <div className="flex items-center gap-3 mb-6 text-sm">
                {slide.scenario.device_requirement && (
                  <span className="text-amber-400 font-medium">{slide.scenario.device_requirement}</span>
                )}
                {slide.assignedTester && (
                  <span className="inline-block bg-blue-500 text-gray-950 font-bold px-3 py-0.5 rounded-full text-sm">
                    {slide.assignedTester.name}
                  </span>
                )}
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <div className="space-y-2">
                  {(slide.scenario.description || '').split('\n').filter(l => l.trim()).map((line, i) => {
                    const isStep = /^\d+\./.test(line.trim())
                    const isPms = line.startsWith('✓ PMS')
                    if (isPms) {
                      return (
                        <div key={i} className="mt-4 bg-green-900/20 border border-green-700/30 rounded-lg p-3 text-sm">
                          <strong className="text-green-400">✓ PMS:</strong>{' '}
                          <span className="text-gray-400">{line.replace('✓ PMS:', '').trim()}</span>
                        </div>
                      )
                    }
                    if (isStep) {
                      const stepNum = line.trim().match(/^(\d+)\./)?.[1]
                      const stepText = line.trim().replace(/^\d+\.\s*/, '')
                      return (
                        <div key={i} className="flex gap-3 items-start">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-[11px] font-bold shrink-0 mt-0.5">
                            {stepNum}
                          </span>
                          <p className="text-sm text-gray-300 leading-relaxed">{stepText}</p>
                        </div>
                      )
                    }
                    return <p key={i} className="text-sm text-gray-400">{line}</p>
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CROSS-CUTTING */}
          {slide.type === 'crosscutting' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500 text-gray-950 text-lg font-extrabold">X</span>
                <h2 className="text-2xl font-bold text-gray-100">ALL Testers — Cross-Cutting Checks</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">Everyone runs these on their device (0:40 – 0:50)</p>
              <div className="space-y-3">
                {CROSS_CUTTING.map(item => (
                  <div key={item.id}>
                    <p className="text-base"><strong className="text-blue-400">{item.id}. {item.title}</strong></p>
                    <p className="text-sm text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EDGE CASES */}
          {slide.type === 'edgecases' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500 text-gray-950 text-lg font-extrabold">Y</span>
                <h2 className="text-2xl font-bold text-gray-100">Quick Edge Cases <span className="text-gray-500 font-normal text-base">pick 2–3</span></h2>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {EDGE_CASES.map((ec, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="text-gray-600">☐</span> {ec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BUG REPORTING */}
          {slide.type === 'bugreporting' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-4">Bug Reporting</h2>
              <p className="text-sm text-gray-400 mb-6">Log all bugs in Mushi. We will triage them together in a follow-up session.</p>
              <div className="bg-gray-900 border-2 border-blue-500 rounded-xl p-6 text-center mb-6">
                <a href={appUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 font-bold text-lg hover:underline">
                  {appUrl}
                </a>
                <div className="mt-3">
                  <span className="inline-block bg-gray-800 border border-gray-700 px-4 py-1 rounded font-mono text-amber-400 tracking-wider">
                    PIN: jabbajubs!
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">When creating a bug, fill in:</p>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Title', 'Short, clear summary of the issue'],
                      ['Page', 'e.g. Availabilities, Summary, Payment, Confirmation'],
                      ['Device', 'e.g. iPhone 15 Safari, Desktop Chrome, iPad Safari'],
                      ['Severity', 'Critical — blocks booking | High — wrong data/price | Low — cosmetic/minor'],
                      ['Description', 'Steps: 1. Go to... 2. Click... 3. See... • Expected vs Actual'],
                      ['Screenshot', 'Paste or attach directly in Mushi'],
                    ].map(([label, desc]) => (
                      <tr key={label}>
                        <td className="text-amber-400 font-semibold pr-4 py-1.5 whitespace-nowrap align-top">{label}</td>
                        <td className="text-gray-400 py-1.5">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TIPS */}
          {slide.type === 'tips' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Quick Tips</h2>
              <ul className="space-y-2">
                {TIPS.map((tip, i) => {
                  const [bold, ...rest] = tip.split(' — ')
                  return (
                    <li key={i} className="text-base">
                      <strong className="text-gray-100">{bold}</strong>
                      {rest.length > 0 && <span className="text-gray-400"> — {rest.join(' — ')}</span>}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-8 text-lg text-center text-amber-400 font-semibold">Let's find every bug before our users do!</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-gray-800 z-20">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${((current + 1) / slides.length) * 100}%` }} />
      </div>
    </div>
  )
}
