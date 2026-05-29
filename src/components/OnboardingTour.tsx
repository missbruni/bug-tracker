import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface TourStep {
  id: string
  title: string
  body: string
  targetSelector?: string
  requireRoute?: string
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to mushi 👋',
    body: "A quick 60-second tour so you know where everything lives. You can skip any time.",
  },
  {
    id: 'bugs',
    title: 'Bugs live here',
    body: 'Every reported issue, filterable by severity, tester, and session.',
    targetSelector: '[data-tour-id="nav-bugs"]',
    requireRoute: '/',
  },
  {
    id: 'new-bug',
    title: 'Log a bug',
    body: 'Use this button (or press ⌘J) to log a new bug. Paste images, attach video, and assign to a tester.',
    targetSelector: '[data-tour-id="new-bug"]',
    requireRoute: '/',
  },
  {
    id: 'ai',
    title: 'AI assistant',
    body: 'Use the assistant for triage, summaries, and bulk actions across bugs.',
    targetSelector: '[data-tour-id="ai-button"]',
  },
  {
    id: 'profile',
    title: 'Your profile',
    body: 'Edit your display name, switch teams, and sign out from your avatar.',
    targetSelector: '[data-tour-id="profile-button"]',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const POPOVER_WIDTH = 320
const POPOVER_MARGIN = 12
const VIEWPORT_PADDING = 16

function useTargetRect(selector: string | undefined, stepIndex: number): Rect | null {
  const [rect, setRect] = React.useState<Rect | null>(null)

  React.useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }

    const measure = () => {
      const element = document.querySelector(selector) as HTMLElement | null
      if (!element) {
        setRect(null)
        return
      }
      const bounding = element.getBoundingClientRect()
      setRect({
        top: bounding.top,
        left: bounding.left,
        width: bounding.width,
        height: bounding.height,
      })
    }

    measure()
    const interval = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector, stepIndex])

  return rect
}

function computePopoverPosition(rect: Rect | null): { top: number; left: number; centered: boolean } {
  if (typeof window === 'undefined') return { top: 0, left: 0, centered: true }
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (!rect) {
    return {
      top: Math.max(VIEWPORT_PADDING, viewportHeight / 2 - 120),
      left: Math.max(VIEWPORT_PADDING, viewportWidth / 2 - POPOVER_WIDTH / 2),
      centered: true,
    }
  }

  const spaceBelow = viewportHeight - (rect.top + rect.height)
  const spaceAbove = rect.top
  const placeBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove

  const top = placeBelow
    ? Math.min(viewportHeight - 200 - VIEWPORT_PADDING, rect.top + rect.height + POPOVER_MARGIN)
    : Math.max(VIEWPORT_PADDING, rect.top - 200 - POPOVER_MARGIN)

  const targetCenter = rect.left + rect.width / 2
  let left = targetCenter - POPOVER_WIDTH / 2
  left = Math.max(VIEWPORT_PADDING, Math.min(viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING, left))

  return { top, left, centered: false }
}

interface OnboardingTourProps {
  onComplete: () => void
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const step = STEPS[stepIndex]
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (step.requireRoute && location.pathname !== step.requireRoute) {
      navigate(step.requireRoute)
    }
  }, [step.requireRoute, location.pathname, navigate])

  const rect = useTargetRect(step.targetSelector, stepIndex)
  const popoverPosition = computePopoverPosition(rect)

  const isLast = stepIndex === STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      onComplete()
      return
    }
    setStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))
  }

  const handlePrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1))
  }

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onComplete()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-100 pointer-events-none" aria-live="polite" role="dialog" aria-label="Product tour">
      {/* Backdrop with target cutout via giant box-shadow */}
      {rect ? (
        <div
          className="fixed pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.65)',
            outline: '2px solid rgb(59, 130, 246)',
            outlineOffset: 2,
            transition: 'top 0.2s, left 0.2s, width 0.2s, height 0.2s',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/65 pointer-events-none" />
      )}

      {/* Popover */}
      <div
        className="fixed pointer-events-auto rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 shadow-2xl"
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
          width: POPOVER_WIDTH,
          transition: 'top 0.2s, left 0.2s',
        }}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 truncate">{step.title}</h3>
          </div>
          <button
            onClick={onComplete}
            aria-label="Skip tour"
            className="rounded-md p-1 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <p className="px-4 pt-2 pb-3 text-xs text-slate-600 dark:text-gray-400 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-gray-800">
          <div className="flex gap-1.5">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? 'w-4 bg-blue-500' : 'w-1.5 bg-slate-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {stepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="rounded-md p-1.5 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Previous step"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-md bg-blue-500 hover:bg-blue-600 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg transition-colors cursor-pointer"
            >
              {isLast ? 'Got it' : 'Next'}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
