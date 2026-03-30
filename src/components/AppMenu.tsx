import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Moon, Sun, Gamepad2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import '@fontsource/open-sans/300.css'
import '@fontsource/open-sans/500.css'

function cn(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function LobsterIcon({ className }: { className?: string }) {
  // Emoji is the fastest way to get a lobster-like mark with lucide/react-less dependencies.
  return (
    <span aria-hidden="true" className={cn('leading-none', className)}>
      🦞
    </span>
  )
}

export function AppMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDevMode, setIsDevMode] = useState(import.meta.env.DEV)
  const dUnlockCountRef = useRef(0)
  const dUnlockWindowStartRef = useRef(0)

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored =
      typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null
    if (stored === 'light' || stored === 'dark') return stored
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    return prefersDark ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Dev: always enabled. Prod: press D three times in a row to unlock.
  const showResume = isDevMode

  useEffect(() => {
    if (import.meta.env.DEV) return
    if (typeof window === 'undefined') return

    const UNLOCK_WINDOW_MS = 1200
    const onKeyDown = (event: KeyboardEvent) => {
      if (isDevMode) return
      if (event.code !== 'KeyD') {
        dUnlockCountRef.current = 0
        dUnlockWindowStartRef.current = 0
        return
      }

      const now = Date.now()
      const windowStart = dUnlockWindowStartRef.current
      const isInWindow = windowStart > 0 && now - windowStart <= UNLOCK_WINDOW_MS
      if (!isInWindow) {
        dUnlockWindowStartRef.current = now
        dUnlockCountRef.current = 1
      } else {
        dUnlockCountRef.current += 1
      }

      if (dUnlockCountRef.current >= 3) {
        setIsDevMode(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDevMode])

  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem('theme', next)
      return next
    })
  }

  const isDark = theme === 'dark'
  const routeButtonClass = (active: boolean) =>
    cn(
      'size-9 rounded-[12px] [&_svg]:size-4 sm:size-10 sm:rounded-[14px] sm:[&_svg]:size-5',
      isDark
        ? 'text-[#8ab4ff] hover:bg-[#8ab4ff]/10 hover:text-[#c3dcff] focus-visible:ring-[#8ab4ff]/40'
        : 'text-[#1f4f8d] hover:bg-[#1f4f8d]/10 hover:text-[#0f2f5f] focus-visible:ring-[#1f4f8d]/40',
      active &&
        (isDark
          ? 'bg-[#8ab4ff]/15 text-[#d8e8ff] ring-1 ring-inset ring-[#8ab4ff]/35'
          : 'bg-[#1f4f8d]/14 text-[#0f2f5f] ring-1 ring-inset ring-[#1f4f8d]/35'),
    )
  const routeButtonProps = (path: string) => {
    const active = location.pathname.startsWith(path)
    return {
      className: routeButtonClass(active),
      'aria-current': active ? ('page' as const) : undefined,
    }
  }
  const menuButtonClass = routeButtonClass(false)

  return (
    <nav
      className={cn(
        'app-menu no-print fixed z-[60]',
        /* 小屏：底栏居中；大屏：左侧垂直居中 */
        'left-1/2 top-auto bottom-[calc(1rem+env(safe-area-inset-bottom))] -translate-x-1/2',
        'sm:left-[18px] sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:translate-x-0',
      )}
      aria-label="Site"
    >
      <div
        className={cn(
          'rounded-[999px] backdrop-blur-sm border shadow-xl px-2 py-1.5 sm:rounded-[18px] sm:px-[10px] sm:py-[10px]',
          isDark
            ? 'bg-[#0f172a]/85 border-white/10'
            // Light theme: reduce white opacity (current "white sheet" felt too heavy)
            : 'bg-white/40 border-black/6',
        )}
      >
        <div className="flex flex-row items-center gap-1.5 sm:flex-col sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/claw')}
            {...routeButtonProps('/claw')}
            aria-label="Claw"
            title="Claw"
          >
            <LobsterIcon className="text-[15px] font-bold sm:text-[18px]" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tank90')}
            {...routeButtonProps('/tank90')}
            aria-label="90 Tank Battle"
            title="90 Tank Battle"
          >
            <Gamepad2 aria-hidden="true" />
          </Button>

          {showResume ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate('/resume')}
              {...routeButtonProps('/resume')}
              aria-label="Resume"
              title="Resume"
            >
              <FileText aria-hidden="true" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={menuButtonClass}
            aria-label="Theme"
            title="Theme"
          >
            {theme === 'dark' ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  )
}

