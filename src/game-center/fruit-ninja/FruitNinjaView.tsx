import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GAME } from './game/constants'
import { type GameUiState, FruitNinjaGame } from './fruitNinjaGame'

const initialUi: GameUiState = {
  score: 0,
  paused: false,
  misses: 0,
  gameOver: false,
  phase: 'home',
}

const backBtnClass =
  'border-emerald-900/35 bg-white/50 text-[#14221a] hover:bg-white/75 dark:border-emerald-400/25 dark:bg-white/10 dark:text-[#d8ebe0] dark:hover:bg-white/15'

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
        if (!ui.gameOver && ui.phase === 'playing') gameRef.current?.setPaused(!ui.paused)
      }
      if (e.code === 'KeyR') {
        e.preventDefault()
        gameRef.current?.restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui.paused, ui.gameOver, ui.phase])

  const { score, paused, misses, gameOver, phase, error } = ui

  return (
    <main
      className={cn(
        'fruit-ninja-page relative min-h-[100dvh] w-full',
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-serif text-2xl font-bold uppercase tracking-[0.12em] sm:text-3xl">Fruit Ninja</h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/games')}
            className={cn(backBtnClass, 'shrink-0')}
            aria-label="Back to game center"
          >
            Back
          </Button>
        </div>

        <div
          className={cn(
            'relative mt-6 w-full overflow-hidden rounded-xl border border-emerald-900/40',
            'bg-[#0d0806] shadow-xl ring-1 ring-black/40',
            'dark:border-emerald-800/35',
          )}
        >
          <div className="relative aspect-[16/10] w-full min-h-[200px]">
            <div ref={hostRef} className="absolute inset-0" aria-label="Fruit Ninja playfield" />

            <div
              className={cn(
                'pointer-events-none absolute left-2 top-2 z-10 sm:left-3 sm:top-3 transition-opacity',
                phase === 'home' && !gameOver ? 'opacity-35' : 'opacity-100',
              )}
              aria-live="polite"
              aria-label={`Score: ${score}`}
            >
              <div
                className="font-mono text-2xl font-bold tabular-nums leading-tight text-white/95 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)] sm:text-3xl"
                data-testid="fruit-ninja-score"
              >
                {score}
              </div>
            </div>

            <div
              className={cn(
                'pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 sm:right-3 sm:top-3 transition-opacity',
                phase === 'home' && !gameOver ? 'opacity-35' : 'opacity-100',
              )}
              aria-label={`Misses: ${misses} of ${GAME.missLimit}`}
            >
              {Array.from({ length: GAME.missLimit }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'font-black leading-none text-2xl sm:text-3xl',
                    i < misses
                      ? 'text-red-500 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]'
                      : 'text-white/20 drop-shadow-[0_0_3px_rgba(0,0,0,0.7)]',
                  )}
                  aria-hidden="true"
                >
                  ✕
                </span>
              ))}
            </div>

            {phase === 'home' && !gameOver ? (
              <div
                className="pointer-events-none absolute inset-0 z-[12] flex flex-col items-center justify-center gap-3 px-6 text-center"
              >
                <div className="max-w-sm rounded-2xl border border-emerald-700/40 bg-black/55 px-6 py-5 shadow-lg backdrop-blur-sm ring-1 ring-white/10">
                  <p className="font-serif text-lg font-semibold tracking-wide text-emerald-50 sm:text-xl">
                    经典模式
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/85">
                    切开中央的大西瓜开始游戏
                  </p>
                </div>
              </div>
            ) : null}

            {paused && !gameOver ? (
              <div
                className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/50 backdrop-blur-[2px]"
                onClick={() => gameRef.current?.setPaused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    gameRef.current?.setPaused(false)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Resume game"
              >
                <div
                  className={cn(
                    'pointer-events-none rounded-2xl border border-emerald-800/35 bg-black/70 px-10 py-6 text-center shadow-2xl',
                    'backdrop-blur-md ring-1 ring-emerald-700/15',
                  )}
                >
                  <div className="font-serif text-xl font-semibold tracking-wide text-emerald-50">Paused</div>
                </div>
              </div>
            ) : null}
            {gameOver ? (
              <div className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center">
                <div className="pointer-events-auto max-w-sm rounded-2xl border border-emerald-800/45 bg-gradient-to-b from-emerald-950/95 to-black/95 p-8 text-center shadow-2xl ring-2 ring-red-900/25">
                  <div className="font-serif text-2xl font-bold uppercase tracking-[0.15em] text-emerald-50">
                    Game Over
                  </div>
                  <p className="mt-3 text-sm text-emerald-200/75">Final score</p>
                  <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-white">{score}</p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" onClick={() => gameRef.current?.restart()}>
                      再玩一次
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => gameRef.current?.goToHomeScreen()}>
                      返回首页
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
