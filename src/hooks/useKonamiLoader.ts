import React from 'react'

const SECRET = 'mushi'

export function useKonamiLoader(duration = 5000) {
  const [active, setActive] = React.useState(false)
  const bufferRef = React.useRef('')

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      bufferRef.current = (bufferRef.current + e.key).slice(-SECRET.length)
      if (bufferRef.current === SECRET) {
        bufferRef.current = ''
        setActive(true)
        setTimeout(() => setActive(false), duration)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [duration])

  return active
}
