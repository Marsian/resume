import { makeAutoObservable } from 'mobx'

class Tank90DebugStore {
  enabled = false

  // Internal: track rapid "D" presses without persisting anything.
  private dUnlockCount = 0
  private dUnlockWindowStart = 0

  constructor() {
    // Default: make fields observable + methods actions automatically.
    // We only explicitly mark methods below for clarity.
    makeAutoObservable(this, { enable: true, onKeyD: true })
  }

  enable() {
    this.enabled = true
  }

  onKeyD(now: number = Date.now()) {
    const UNLOCK_WINDOW_MS = 1200

    const windowStart = this.dUnlockWindowStart
    const isInWindow = windowStart > 0 && now - windowStart <= UNLOCK_WINDOW_MS

    if (!isInWindow) {
      this.dUnlockWindowStart = now
      this.dUnlockCount = 1
      return
    }

    this.dUnlockCount += 1
    if (this.dUnlockCount >= 3) {
      this.enable()
    }
  }
}

// Singleton: global store shared across mounts of TankBattle90View.
export const tank90DebugStore = new Tank90DebugStore()

