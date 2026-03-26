import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Moon, Sun } from 'lucide-react'

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
        : 'text-[#4679bd] hover:bg-[#4679bd]/10 hover:text-[#2e5fa0] focus-visible:ring-[#4679bd]/40',
      active &&
        (isDark
          ? 'bg-[#8ab4ff]/15 text-[#d8e8ff] ring-1 ring-inset ring-[#8ab4ff]/35'
          : 'bg-[#4679bd]/12 text-[#1f4f8d] ring-1 ring-inset ring-[#4679bd]/30'),
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
            : 'bg-white/85 border-black/5',
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
            onClick={() => navigate('/resume')}
            {...routeButtonProps('/resume')}
            aria-label="Resume"
            title="Resume"
          >
            <FileText aria-hidden="true" />
          </Button>

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

