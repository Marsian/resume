import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GAME } from './game/constants'
import { type GameUiState, FruitNinjaGame } from './fruitNinjaGame'

const initialUi: GameUiState = {
  score: 0,
  combo: 0,
  paused: false,
  lives: GAME.livesStart,
  gameOver: false,
}

const shellBtn =
  'border-amber-900/40 bg-black/40 text-amber-50 backdrop-blur-sm hover:bg-black/55 dark:border-amber-800/50 dark:bg-black/50 dark:hover:bg-black/60'

export default function FruitNinjaView() {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<FruitNinjaGame | null>(null)
  const [ui, setUi] = useState<GameUiState>(initialUi)

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  }, [])

  const onUi = useCallback((s: GameUiState) => {
    setUi(s)
  }, [])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const game = new FruitNinjaGame(el, { onUi, reducedMotion })
    gameRef.current = game
    game.bootstrap()
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [onUi, reducedMotion])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'KeyP') {
        e.preventDefault()
        if (!ui.gameOver) gameRef.current?.setPaused(!ui.paused)
      }
      if (e.code === 'KeyR') {
        e.preventDefault()
        gameRef.current?.restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui.paused, ui.gameOver])

  const { score, combo, paused, lives, gameOver, error } = ui

  return (
    <main
      className={cn(
        'fruit-ninja-page relative min-h-[100dvh] w-full text-foreground',
        'bg-gradient-to-b from-[#1a0f0a] via-[#120a08] to-[#0a0604]',
        'px-4 py-8 pb-28 sm:px-6 sm:pb-12 sm:pl-24',
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-amber-600/35 to-transparent"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold uppercase tracking-[0.12em] text-amber-100/95 sm:text-3xl">
              Fruit Ninja
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-amber-200/40 sm:text-xs">
              P pause · R restart · drag to slice
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gameOver}
                className={shellBtn}
                onClick={() => gameRef.current?.setPaused(!paused)}
              >
                {paused && !gameOver ? 'Resume' : 'Pause'}
              </Button>
              <Button type="button" variant="outline" size="sm" className={shellBtn} onClick={() => gameRef.current?.restart()}>
                Restart
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/games')}
            className={cn(shellBtn, 'shrink-0')}
            aria-label="Back to game center"
          >
            Back
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-xl border border-amber-900/45 bg-black/50 px-3 py-2 shadow-lg backdrop-blur-md',
              'ring-1 ring-amber-800/25',
            )}
            aria-label={`Lives remaining: ${lives}`}
          >
            {Array.from({ length: GAME.livesStart }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-3 w-3 rounded-full border-2 shadow-inner',
                  i < lives
                    ? 'border-red-700 bg-gradient-to-br from-red-400 to-red-700 shadow-red-900/50'
                    : 'border-white/15 bg-white/5 opacity-40',
                )}
              />
            ))}
          </div>

          <div
            className={cn(
              'min-w-[7rem] rounded-xl border border-amber-900/45 bg-black/50 px-4 py-2 text-right shadow-lg backdrop-blur-md',
              'ring-1 ring-amber-800/25',
            )}
            data-testid="fruit-ninja-score"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-amber-200/55">Score</div>
            <div className="font-mono text-3xl font-bold tabular-nums leading-tight text-amber-50">{score}</div>
            {combo > 1 ? (
              <div
                className={cn(
                  'mt-1 text-center text-sm font-bold tabular-nums text-amber-300',
                  !reducedMotion && 'animate-pulse',
                )}
              >
                Combo ×{combo}
              </div>
            ) : null}
          </div>
        </div>

        <p
          className={cn(
            'mt-4 max-w-xl rounded-lg border border-amber-900/35 bg-black/30 px-3 py-2 text-xs leading-relaxed',
            'text-amber-100/75 backdrop-blur-sm',
          )}
        >
          Slice fruit — avoid <span className="font-semibold text-orange-300">bombs</span>. Miss too many drops and you lose a
          life. Drag inside the frame below.
        </p>

        {/* Game panel: border is flush with WebGL + 2D trail — no inner padding */}
        <div
          className={cn(
            'relative mt-6 w-full overflow-hidden rounded-xl border border-amber-900/50',
            'bg-[#0d0806] shadow-xl ring-1 ring-black/55',
            'dark:border-amber-800/45',
          )}
        >
          <div className="relative aspect-[16/10] w-full min-h-[200px]">
            <div ref={hostRef} className="absolute inset-0" aria-label="Fruit Ninja playfield" />
            {paused && !gameOver ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                <div
                  className={cn(
                    'pointer-events-auto rounded-2xl border border-amber-800/40 bg-black/75 px-10 py-6 text-center shadow-2xl',
                    'backdrop-blur-md ring-1 ring-amber-700/20',
                  )}
                >
                  <div className="font-serif text-xl font-semibold tracking-wide text-amber-100">Paused</div>
                  <div className="mt-2 text-sm text-amber-200/65">Press P or tap Resume</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {gameOver ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 sm:pl-24">
          <div
            className={cn(
              'max-w-sm rounded-2xl border border-amber-800/50 bg-gradient-to-b from-amber-950/90 to-black/90 p-8 text-center shadow-2xl',
              'ring-2 ring-red-900/30',
            )}
          >
            <div className="font-serif text-2xl font-bold uppercase tracking-[0.15em] text-amber-100">Game Over</div>
            <p className="mt-3 text-sm text-amber-200/75">Final score</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-amber-50">{score}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" onClick={() => gameRef.current?.restart()}>
                Play again
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/games')}>
                Game Center
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6 sm:pl-24">
          <div className="max-w-md rounded-xl border border-red-500/30 bg-card p-6 text-center shadow-xl">
            <div className="text-lg font-semibold text-red-200">Could not start Fruit Ninja</div>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button type="button" className="mt-4" variant="secondary" onClick={() => navigate('/games')}>
              Return to Game Center
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
