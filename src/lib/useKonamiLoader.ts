import React from 'react'

const SECRET = 'mushi'

export function useKonamiLoader(duration = 5000) {
  const [active, setActive] = React.useState(false)
  const bufferRef = React.useRef('')

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      bufferRef.current = (bufferRef.current + event.key).slice(-SECRET.length)
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
