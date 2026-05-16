/** Short tactile click sound for theme toggle — like a physical switch */
export function playToggleSound(_isDark: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const t = ctx.currentTime

    // Noise burst — the core of a "click"
    const bufferSize = Math.floor(ctx.sampleRate * 0.015) // 15ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) // decaying noise
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    // Bandpass to shape the click tone
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3000
    filter.Q.value = 1.5

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start(t)
    noise.stop(t + 0.03)
  } catch { /* ignore audio errors */ }
}

/** Short sparkly chime for AI assistant toggle */
export function playAiSound(opening: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const t = ctx.currentTime

    // Two-note sparkle — ascending when opening, descending when closing
    const freqs = opening ? [880, 1320] : [1320, 880]
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.12, t)
    masterGain.connect(ctx.destination)

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.12, t + i * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15)
      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(t + i * 0.08)
      osc.stop(t + i * 0.08 + 0.15)
    })
  } catch { /* ignore audio errors */ }
}

export function playTickSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1800, ctx.currentTime)
    osc.frequency.setValueAtTime(2400, ctx.currentTime + 0.04)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* ignore audio errors */ }
}
