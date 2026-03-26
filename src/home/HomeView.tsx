import { useEffect } from 'react'

function cn(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

export default function HomeView() {
  // Ensure the homepage stays truly full-screen (no scrollbar).
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevHeight = document.body.style.height
    document.body.style.overflow = 'hidden'
    document.body.style.height = '100vh'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.height = prevHeight
    }
  }, [])

  return (
    <div
      className={cn(
        'relative h-screen bg-background text-foreground transition-colors overflow-hidden',
      )}
    >
      {/* Main */}
      <div
        className={cn(
          'transition-transform duration-[400ms] overflow-x-hidden h-full',
        )}
      >
        <section
          className={cn(
            'relative w-full h-full overflow-hidden text-center',
            'transition-colors',
            'bg-no-repeat bg-center bg-cover',
            "bg-[url('/images/Waikiki.jpg')]",
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-0 bg-black/10 transition-colors dark:bg-black/50',
            )}
          />

          <div className="relative h-full flex items-center justify-center">
            <div className="w-[80%] max-w-[700px]">
              <h1
                className={cn(
                  'text-[3.2rem] sm:text-[5rem] font-bold tracking-[-0.03em] text-white/95 drop-shadow-[0_1px_3px_#000]',
                  'animate-fade-in-down-home [animation-delay:0.18s]',
                )}
              >
                Yanxi Wang
              </h1>
              <h2
                className={cn(
                  'm-0 text-[1.35rem] sm:text-[2rem] leading-[1.35em] font-bold text-white/90 drop-shadow-[0_1px_1px_#000]',
                  'font-serif animate-fade-in-down-home [animation-delay:0.22s]',
                )}
              >
                Web Developer
              </h2>
            </div>
          </div>

        </section>

        {/* timeline removed */}
      </div>
    </div>
  )
}

