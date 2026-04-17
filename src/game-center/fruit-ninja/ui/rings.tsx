import { cn } from '@/lib/utils'

function RingTwinText({
  pathId,
  label,
  color,
}: {
  pathId: string
  label: string
  color: string
}) {
  return (
    <>
      <text
        fill={color}
        fontSize="25"
        fontWeight="900"
        letterSpacing="1.2"
        textAnchor="middle"
        style={{ textTransform: 'uppercase' }}
      >
        <textPath href={`#${pathId}`} startOffset="25%">
          {label}
        </textPath>
      </text>
      <text
        fill={color}
        fontSize="25"
        fontWeight="900"
        letterSpacing="1.2"
        textAnchor="middle"
        style={{ textTransform: 'uppercase' }}
      >
        <textPath href={`#${pathId}`} startOffset="75%">
          {label}
        </textPath>
      </text>
    </>
  )
}

function DonutRing({
  className,
  gradientId,
  textPathId,
  maskId,
  label,
  stops,
}: {
  className?: string
  gradientId: string
  maskId: string
  textPathId: string
  label: string
  stops: Array<{ o: number; c: string }>
}) {
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((s) => (
            <stop key={s.o} offset={`${s.o}%`} stopColor={s.c} />
          ))}
        </linearGradient>
        <radialGradient id={`${gradientId}-glow`} cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="320" height="320" fill="black" />
          <circle cx="160" cy="160" r="125" fill="white" />
          <circle cx="160" cy="160" r="92" fill="black" />
        </mask>
        <path id={textPathId} d="M 160, 160 m -100, 0 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0" />
      </defs>
      <circle cx="160" cy="160" r="146" fill="rgba(0,0,0,0.16)" />
      <circle
        cx="160"
        cy="160"
        r="125"
        fill={`url(#${gradientId})`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="10"
        mask={`url(#${maskId})`}
      />
      <circle cx="160" cy="160" r="125" fill={`url(#${gradientId}-glow)`} mask={`url(#${maskId})`} />
      <circle cx="160" cy="160" r="92" fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
      <RingTwinText
        pathId={textPathId}
        label={label}
        color="rgba(245,245,255,0.9)"
      />
    </svg>
  )
}

export function StartRing({ className, labelText }: { className?: string; labelText?: string }) {
  const label = labelText ?? 'TAP HERE TO START'
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fnStartRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1aa0ff" />
          <stop offset="45%" stopColor="#166bdb" />
          <stop offset="100%" stopColor="#0b2e7a" />
        </linearGradient>
        <radialGradient id="fnStartRingGlow" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
        <mask id="fnStartRingMask">
          <rect x="0" y="0" width="320" height="320" fill="black" />
          {/* show outer disk */}
          <circle cx="160" cy="160" r="125" fill="white" />
          {/* cut inner hole */}
          <circle cx="160" cy="160" r="92" fill="black" />
        </mask>
        <path id="fnStartRingPath" d="M 160, 160 m -100, 0 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0" />
      </defs>
      <circle cx="160" cy="160" r="146" fill="rgba(0,0,0,0.18)" />
      <circle
        cx="160"
        cy="160"
        r="125"
        fill="url(#fnStartRing)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="10"
        mask="url(#fnStartRingMask)"
      />
      <circle cx="160" cy="160" r="125" fill="url(#fnStartRingGlow)" mask="url(#fnStartRingMask)" />
      {/* Inner rim */}
      <circle cx="160" cy="160" r="92" fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
      <RingTwinText
        pathId="fnStartRingPath"
        label={label}
        color="rgba(232,248,255,0.92)"
      />
    </svg>
  )
}

export function SettingsRing({ className, labelText }: { className?: string; labelText?: string }) {
  return (
    <DonutRing
      className={className}
      gradientId="fnSettingsRing"
      maskId="fnSettingsMask"
      textPathId="fnSettingsPath"
      label={labelText ?? 'SETTINGS'}
      stops={[
        { o: 0, c: '#b051ff' },
        { o: 55, c: '#6b2cff' },
        { o: 100, c: '#3a0bb2' },
      ]}
    />
  )
}

export function FruitNinjaLogo({ className }: { className?: string }) {
  // Pixel-ish logo: colored FRUIT + metallic NINJA with heavy drop shadows
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <div className="flex items-end gap-3">
        <div className="font-black tracking-[0.14em] drop-shadow-[0_14px_26px_rgba(0,0,0,0.55)]" style={{ fontSize: 'clamp(44px, 6.2vw, 78px)' }}>
          <span className="bg-gradient-to-b from-[#b85cff] via-[#7b45ff] to-[#3a18c9] bg-clip-text text-transparent">F</span>
          <span className="bg-gradient-to-b from-[#ff4a4a] via-[#ff8a2a] to-[#b60d1b] bg-clip-text text-transparent">R</span>
          <span className="bg-gradient-to-b from-[#ffd24a] via-[#ffb300] to-[#a36500] bg-clip-text text-transparent">U</span>
          <span className="bg-gradient-to-b from-[#ffb31a] via-[#ff7a2a] to-[#9a3000] bg-clip-text text-transparent">I</span>
          <span className="bg-gradient-to-b from-[#6dff5d] via-[#25c95a] to-[#0a6b3c] bg-clip-text text-transparent">T</span>
        </div>
        <div className="font-black tracking-[0.18em] drop-shadow-[0_14px_26px_rgba(0,0,0,0.55)]" style={{ fontSize: 'clamp(38px, 5.2vw, 66px)' }}>
          <span className="bg-gradient-to-b from-[#f8fbff] via-[#c8d3e0] to-[#6f7d8f] bg-clip-text text-transparent">NINJA</span>
        </div>
      </div>
    </div>
  )
}

export function WoodSign({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <div
        className={cn(
          'rounded-[10px] border border-[#3a250f]/85',
          'bg-gradient-to-b from-[#f1d2a3] via-[#cc9a5f] to-[#7a4e23]',
          'px-6 py-5',
          'shadow-[0_18px_40px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="text-[12px] font-black tracking-[0.2em] text-[#2a1a09]/90">TAP FRUIT</div>
        <div className="mt-1 text-[12px] font-black tracking-[0.2em] text-[#2a1a09]/90">TO BEGIN</div>
      </div>
    </div>
  )
}
