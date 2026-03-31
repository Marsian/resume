export type Tank90Sfx = 'fire' | 'destroyed' | 'powerup'
export type Tank90Music = 'entry'

const BASE_URL = import.meta.env.BASE_URL

const SFX_URL: Record<Tank90Sfx, string> = {
  fire: `${BASE_URL}sounds/fire.mp3`,
  destroyed: `${BASE_URL}sounds/destroyed.mp3`,
  powerup: `${BASE_URL}sounds/powerup.mp3`,
}

const MUSIC_URL: Record<Tank90Music, string> = {
  entry: `${BASE_URL}sounds/entry-theme.mp3`,
}

function tryPlay(a: HTMLAudioElement) {
  // Autoplay policies can reject play() until a user gesture; ignore failures.
  void a.play().catch(() => {})
}

class Tank90Audio {
  private music: Partial<Record<Tank90Music, HTMLAudioElement>> = {}
  private sfxBase: Partial<Record<Tank90Sfx, HTMLAudioElement>> = {}

  preload() {
    // Preload a base element per sound; SFX playback clones to allow overlap.
    for (const k of Object.keys(SFX_URL) as Tank90Sfx[]) {
      if (this.sfxBase[k]) continue
      const a = new Audio(SFX_URL[k])
      a.preload = 'auto'
      this.sfxBase[k] = a
    }
    for (const k of Object.keys(MUSIC_URL) as Tank90Music[]) {
      if (this.music[k]) continue
      const a = new Audio(MUSIC_URL[k])
      a.preload = 'auto'
      a.loop = false
      this.music[k] = a
    }
  }

  playSfx(type: Tank90Sfx, volume = 0.8) {
    const base = this.sfxBase[type] ?? new Audio(SFX_URL[type])
    const a = base.cloneNode(true) as HTMLAudioElement
    a.volume = Math.max(0, Math.min(1, volume))
    tryPlay(a)
  }

  playMusic(type: Tank90Music, opts?: { volume?: number; restart?: boolean }) {
    const a = this.music[type] ?? new Audio(MUSIC_URL[type])
    this.music[type] = a
    const volume = opts?.volume ?? 0.6
    const restart = opts?.restart ?? true
    a.volume = Math.max(0, Math.min(1, volume))
    if (restart) a.currentTime = 0
    tryPlay(a)
  }

  stopMusic(type: Tank90Music) {
    const a = this.music[type]
    if (!a) return
    a.pause()
    a.currentTime = 0
  }
}

export const tank90Audio = new Tank90Audio()

