import React from 'react'

interface TooltipProps {
  title: string
  delay?: number
  children: React.ReactElement
}

export default function Tooltip({ title, delay = 0, children }: TooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setVisible(true), delay)
    } else {
      setVisible(true)
    }
  }

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      <span
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap text-[11px] font-semibold leading-none px-2 py-1 rounded-md bg-slate-900 dark:bg-gray-700 text-white pointer-events-none z-50 transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {title}
      </span>
    </div>
  )
}
