import React from 'react'
import { Megaphone, X } from 'lucide-react'

interface AnnouncementAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
}

interface AnnouncementBannerProps {
  title: React.ReactNode
  children: React.ReactNode
  actions?: AnnouncementAction[]
  onDismiss?: () => void
  className?: string
  contentClassName?: string
  titleClassName?: string
  titleStyle?: React.CSSProperties
}

export default function AnnouncementBanner({
  title,
  children,
  actions = [],
  onDismiss,
  className = 'border-b',
  contentClassName = 'max-w-screen-2xl mx-auto px-7 py-2.5',
  titleClassName,
  titleStyle,
}: AnnouncementBannerProps) {
  return (
    <div className={`relative overflow-hidden border-blue-200 dark:border-mushi-primary/30 bg-blue-50/80 dark:bg-mushi-primary/5 ${className}`}>
      {/* Animated shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/40 dark:via-mushi-primary/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      <div className={`relative flex items-center gap-3 ${contentClassName}`}>
        <Megaphone size={16} className="text-blue-500 dark:text-mushi-primary shrink-0 animate-[announce_2s_ease-in-out_infinite]" />
        <p className="flex-1 text-xs text-blue-800 dark:text-mushi-primary/80">
          <span className={titleClassName ?? 'font-bold'} style={titleStyle}>{title}</span> {children}
        </p>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={action.variant === 'secondary'
              ? 'inline-flex items-center gap-1.5 rounded-md border border-blue-300 dark:border-mushi-primary/40 bg-white/80 dark:bg-gray-900/80 px-3 py-1 text-xs font-bold text-blue-700 dark:text-mushi-primary hover:bg-blue-100 dark:hover:bg-mushi-primary/15 transition-colors cursor-pointer whitespace-nowrap'
              : 'inline-flex items-center gap-1.5 rounded-md bg-blue-500 dark:bg-mushi-primary hover:bg-blue-600 dark:hover:bg-mushi-primary/80 px-3 py-1 text-xs font-bold text-white dark:text-mushi-bg transition-colors cursor-pointer whitespace-nowrap animate-[bounce-subtle_1.5s_ease-in-out_infinite]'}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-blue-300 dark:text-mushi-accent hover:text-blue-600 dark:hover:text-mushi-accent/80 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
