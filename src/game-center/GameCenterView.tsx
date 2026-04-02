import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { games } from './gameRegistry'

export default function GameCenterView() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <main
        className={cn(
          'mx-auto max-w-6xl px-4 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))]',
          'overflow-x-hidden sm:px-6 sm:pl-[88px] sm:pt-12',
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Game Center</h1>
            <p className="mt-2 text-sm text-muted-foreground">Select a game to start.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {games.map((game) => (
            <Button
              key={game.id}
              type="button"
              variant="outline"
              onClick={() => navigate(game.route)}
              aria-label={game.cardLabel}
              className={cn(
                // "Hover float": small lift + shadow for affordance.
                'group h-auto items-stretch rounded-xl border-black/10 bg-card/30 p-4',
                'transition-all duration-200 will-change-transform',
                'hover:-translate-y-1 hover:bg-card/60 hover:shadow-lg',
                'focus-visible:ring-2 focus-visible:ring-ring/30',
                'dark:border-white/10 dark:bg-card/15',
              )}
            >
              <div className="flex w-full items-center gap-4">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-background/60 ring-1 ring-black/5 dark:bg-muted dark:ring-white/10',
                    'transition-transform duration-200 group-hover:scale-[1.04]',
                  )}
                >
                  {game.thumbnail}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-base">{game.title}</div>
                  {game.description ? (
                    <div className="mt-1 truncate text-sm text-muted-foreground">{game.description}</div>
                  ) : null}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </main>
    </div>
  )
}

