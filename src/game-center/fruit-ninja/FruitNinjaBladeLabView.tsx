import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { BladeTrailOverlay2d } from './fx/trailOverlay2d'

const backBtnClass =
  'border-emerald-900/35 bg-white/50 text-[#14221a] hover:bg-white/75 dark:border-emerald-400/25 dark:bg-white/10 dark:text-[#d8ebe0] dark:hover:bg-white/15'

export default function FruitNinjaBladeLabView() {
  const navigate = useNavigate()
  const playfieldRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<BladeTrailOverlay2d | null>(null)
  const pointerDownRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const modeRef = useRef<'game' | 'persist'>('game')
  const [mode, setMode] = useState<'game' | 'persist'>('game')

  useEffect(() => {
    const host = hostRef.current
    const playfield = playfieldRef.current
    if (!host || !playfield) return

    const trail = new BladeTrailOverlay2d(host)
    trailRef.current = trail
    trail.setPersistTrail(modeRef.current === 'persist')

    const syncLayout = () => {
      const r = playfield.getBoundingClientRect()
      trail.setLayoutRect(r)
      trail.resize(r.width, r.height)
    }
    syncLayout()

    const ro = new ResizeObserver(syncLayout)
    ro.observe(playfield)

    const tick = () => {
      trail.tick(performance.now())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const onPointerDown = (e: PointerEvent) => {
      pointerDownRef.current = true
      playfield.setPointerCapture(e.pointerId)
      trail.beginStroke()
      trail.pushScreenPoint(e.clientX, e.clientY)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
      for (const ev of coalesced) {
        trail.pushScreenPoint(ev.clientX, ev.clientY)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      pointerDownRef.current = false
      if (modeRef.current === 'game') trail.fade()
      try {
        playfield.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    const onPointerLeave = () => {
      if (!pointerDownRef.current && modeRef.current === 'game') trail.fade()
    }

    playfield.addEventListener('pointerdown', onPointerDown)
    playfield.addEventListener('pointermove', onPointerMove)
    playfield.addEventListener('pointerup', onPointerUp)
    playfield.addEventListener('pointercancel', onPointerUp)
    playfield.addEventListener('pointerleave', onPointerLeave)

    return () => {
      playfield.removeEventListener('pointerdown', onPointerDown)
      playfield.removeEventListener('pointermove', onPointerMove)
      playfield.removeEventListener('pointerup', onPointerUp)
      playfield.removeEventListener('pointercancel', onPointerUp)
      playfield.removeEventListener('pointerleave', onPointerLeave)
      ro.disconnect()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      trail.dispose()
      trailRef.current = null
    }
  }, [])

  useEffect(() => {
    modeRef.current = mode
    trailRef.current?.setPersistTrail(mode === 'persist')
  }, [mode])

  return (
    <main
      className={cn(
        'relative min-h-[100dvh] w-full',
        'bg-gradient-to-b from-[#e8f2ec] via-[#d4e4dc] to-[#c5d8ce]',
        'text-[#14221a]',
        'dark:from-[#0a1210] dark:via-[#060d0a] dark:to-[#050a08]',
        'dark:text-[#d8ebe0]',
        'px-4 py-8 pb-28 sm:px-6 sm:pb-12 sm:pl-24',
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r from-transparent via-emerald-600/45 to-transparent dark:via-teal-500/35"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto max-w-4xl">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode('game')}
            className={cn(
              backBtnClass,
              'shrink-0',
              mode === 'game' ? 'border-emerald-700/70 bg-emerald-200/65 dark:bg-emerald-900/40' : null,
            )}
          >
            游戏模式
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode('persist')}
            className={cn(
              backBtnClass,
              'shrink-0',
              mode === 'persist' ? 'border-emerald-700/70 bg-emerald-200/65 dark:bg-emerald-900/40' : null,
            )}
          >
            观测模式
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => trailRef.current?.clear()}
            className={cn(backBtnClass, 'shrink-0')}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/games/fruit-ninja')}
            className={cn(backBtnClass, 'shrink-0')}
            aria-label="Back to Fruit Ninja"
          >
            Back
          </Button>
        </div>

        <div
          className={cn(
            'relative mt-6 w-full overflow-hidden rounded-xl border border-emerald-900/40',
            'bg-[#090909] shadow-xl ring-1 ring-black/40',
            'dark:border-emerald-800/35',
          )}
        >
          <div
            ref={playfieldRef}
            className="relative aspect-[16/10] w-full min-h-[200px] touch-none cursor-crosshair"
            style={{
              background:
                'radial-gradient(75% 62% at 50% 45%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 38%, rgba(0,0,0,0.86) 100%)',
            }}
          >
            <div ref={hostRef} className="absolute inset-0" />
          </div>
        </div>
      </div>
    </main>
  )
}
