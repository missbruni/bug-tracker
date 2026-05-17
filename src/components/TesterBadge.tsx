import type { ReactNode } from 'react'

interface TesterBadgeProps {
  children: ReactNode
}

export function TesterBadge({ children }: TesterBadgeProps) {
  return (
    <span className="badge badge-slate">
      {children}
    </span>
  )
}
