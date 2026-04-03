/**
 * Lightweight slice / impact SFX via Web Audio (no asset files).
 * Requires a user gesture — call `resumeFromGesture()` from pointerdown.
 */
export class GameAudio {
  private ctx: AudioContext | null = null

  resumeFromGesture() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain = 0.08, freqEnd?: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noiseBurst(dur: number, gain = 0.06) {
    const ctx = this.ctx
    if (!ctx) return
    const t0 = ctx.currentTime
    const bufferSize = ctx.sampleRate * dur
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(ctx.destination)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  playSlice() {
    this.noiseBurst(0.045, 0.07)
    this.beep(420, 0.06, 'sine', 0.04, 880)
  }

  playBomb() {
    this.beep(90, 0.35, 'sawtooth', 0.12, 40)
    this.noiseBurst(0.2, 0.1)
  }

  playMiss() {
    this.beep(200, 0.12, 'triangle', 0.05, 120)
  }

  playLifeLost() {
    this.beep(160, 0.25, 'square', 0.05, 80)
  }

  playGameOver() {
    this.beep(220, 0.15, 'sine', 0.06, 110)
    setTimeout(() => this.beep(165, 0.35, 'sine', 0.05, 55), 120)
  }
}
