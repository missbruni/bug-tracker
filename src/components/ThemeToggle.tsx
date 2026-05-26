import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { playToggleSound } from '../lib/audio'
import { usePanelStore } from '../stores/panelStore'

const storedTheme = localStorage.getItem('theme')
const initialDark = storedTheme ? storedTheme === 'dark' : true
document.documentElement.classList.toggle('dark', initialDark)

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = React.useState(initialDark)
  const [themeKey, setThemeKey] = React.useState(0)

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    usePanelStore.getState().setDark(darkMode)
  }, [darkMode])

  return (
    <button
      onClick={() => { const next = !darkMode; playToggleSound(next); setDarkMode(next); setThemeKey(k => k + 1) }}
      className="relative rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer overflow-hidden"
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ width: 34, height: 34 }}
    >
      <span key={`enter-${themeKey}`} className="theme-icon-enter block">
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      {themeKey > 0 && (
        <span key={`exit-${themeKey}`} className="theme-icon-exit">
          {darkMode ? <Moon size={18} /> : <Sun size={18} />}
        </span>
      )}
    </button>
  )
}
