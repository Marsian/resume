import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Moon, Sun } from 'lucide-react'

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

  return (
    <div className="no-print fixed left-[18px] top-1/2 -translate-y-1/2 z-[60]">
      <div
        className={cn(
          'rounded-[18px] backdrop-blur border shadow-xl px-[10px] py-[10px]',
          isDark
            ? 'bg-[#0f172a]/85 border-white/10'
            : 'bg-white/85 border-black/5',
        )}
      >
        <div className="flex flex-col gap-[8px]">
          <button
            type="button"
            onClick={() => navigate('/claw')}
            className={cn(
              'h-[40px] w-[40px] rounded-[14px] flex items-center justify-center',
              isDark
                ? 'text-[#8ab4ff] hover:text-[#c3dcff] hover:bg-[#8ab4ff]/10 focus-visible:ring-[#8ab4ff]/40'
                : 'text-[#4679bd] hover:text-[#2e5fa0] hover:bg-[#4679bd]/10 focus-visible:ring-[#4679bd]/40',
              'focus-visible:outline-none focus-visible:ring-2',
              'transition-colors',
            )}
            aria-label="Claw"
            title="Claw"
          >
            <LobsterIcon className="text-[18px] font-bold" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/resume')}
            className={cn(
              'h-[40px] w-[40px] rounded-[14px] flex items-center justify-center',
              isDark
                ? 'text-[#8ab4ff] hover:text-[#c3dcff] hover:bg-[#8ab4ff]/10 focus-visible:ring-[#8ab4ff]/40'
                : 'text-[#4679bd] hover:text-[#2e5fa0] hover:bg-[#4679bd]/10 focus-visible:ring-[#4679bd]/40',
              'focus-visible:outline-none focus-visible:ring-2',
              'transition-colors',
            )}
            aria-label="Resume"
            title="Resume"
          >
            <FileText className="h-[20px] w-[20px]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              'h-[40px] w-[40px] rounded-[14px] flex items-center justify-center',
              isDark
                ? 'text-[#8ab4ff] hover:text-[#c3dcff] hover:bg-[#8ab4ff]/10 focus-visible:ring-[#8ab4ff]/40'
                : 'text-[#4679bd] hover:text-[#2e5fa0] hover:bg-[#4679bd]/10 focus-visible:ring-[#4679bd]/40',
              'focus-visible:outline-none focus-visible:ring-2',
              'transition-colors',
            )}
            aria-label="Theme"
            title="Theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-[20px] w-[20px]" aria-hidden="true" />
            ) : (
              <Moon className="h-[20px] w-[20px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

