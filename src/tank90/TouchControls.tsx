import { useRef } from 'react'
import { cn } from '@/lib/utils'

type DirectionInput = { up: boolean; down: boolean; left: boolean; right: boolean }

interface TouchControlsProps {
  onMoveChange: (next: DirectionInput) => void
  onFireChange: (firing: boolean) => void
  onPauseToggle?: () => void
  className?: string
}

const JOY_SIZE = 120
const KNOB_SIZE = 46

export function TouchControls({
  onMoveChange,
  onFireChange,
  onPauseToggle,
  className,
}: TouchControlsProps) {
  const dragIdRef = useRef<number | null>(null)

  function resetMovement() {
    onMoveChange({ up: false, down: false, left: false, right: false })
  }

  function computeDirection(host: HTMLDivElement, clientX: number, clientY: number) {
    const rect = host.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const mag = Math.hypot(dx, dy)
    const deadZone = 10

    if (mag <= deadZone) {
      resetMovement()
      return
    }

    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    onMoveChange({
      up: ay > ax && dy < -deadZone,
      down: ay > ax && dy > deadZone,
      left: ax >= ay && dx < -deadZone,
      right: ax >= ay && dx > deadZone,
    })
  }

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3 pt-3 pb-2 shadow-sm sm:px-4',
        'border-amber-900/20 bg-black/[0.12] shadow-inner backdrop-blur-sm',
        'dark:border-amber-400/20 dark:bg-black/35',
        className,
      )}
      style={{ touchAction: 'none', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      aria-label="Touch controls"
    >
      <div className="flex items-end justify-between gap-4">
        <div
          className="relative shrink-0 rounded-full border border-amber-900/25 bg-white/30 dark:border-amber-400/25 dark:bg-white/5"
          style={{ width: JOY_SIZE, height: JOY_SIZE, touchAction: 'none' }}
          onPointerDown={(event) => {
            const el = event.currentTarget
            dragIdRef.current = event.pointerId
            el.setPointerCapture(event.pointerId)
            computeDirection(el, event.clientX, event.clientY)
          }}
          onPointerMove={(event) => {
            if (dragIdRef.current !== event.pointerId) return
            computeDirection(event.currentTarget, event.clientX, event.clientY)
          }}
          onPointerUp={(event) => {
            if (dragIdRef.current !== event.pointerId) return
            event.currentTarget.releasePointerCapture(event.pointerId)
            dragIdRef.current = null
            resetMovement()
          }}
          onPointerCancel={(event) => {
            if (dragIdRef.current !== event.pointerId) return
            event.currentTarget.releasePointerCapture(event.pointerId)
            dragIdRef.current = null
            resetMovement()
          }}
          role="application"
          aria-label="Virtual joystick"
        >
          <div
            className="absolute rounded-full border border-amber-900/20 bg-white/60 dark:border-white/15 dark:bg-white/10"
            style={{
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              left: (JOY_SIZE - KNOB_SIZE) / 2,
              top: (JOY_SIZE - KNOB_SIZE) / 2,
            }}
          />
        </div>
        <div className="ml-auto flex min-w-[124px] flex-col items-end justify-end gap-2">
          {onPauseToggle ? (
            <button
              type="button"
              className="h-11 min-w-20 rounded-full border border-amber-900/30 bg-white/40 px-4 font-mono text-[11px] tracking-[0.06em] text-[#2a2018] dark:border-amber-400/30 dark:bg-white/10 dark:text-[#f0e6d8]"
              onClick={onPauseToggle}
              aria-label="Pause game"
            >
              PAUSE
            </button>
          ) : null}
          <button
            type="button"
            className="h-20 min-w-20 rounded-full border border-amber-700/50 bg-gradient-to-b from-amber-500 to-amber-700 px-4 font-mono text-xs tracking-[0.08em] text-amber-950 shadow-md dark:from-amber-400 dark:to-amber-600 dark:text-amber-950"
            onPointerDown={(event) => {
              onFireChange(true)
            }}
            onPointerUp={(event) => {
              void event
              onFireChange(false)
            }}
            onPointerCancel={(event) => {
              void event
              onFireChange(false)
            }}
            aria-label="Touch fire"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  )
}
