import type { HomeRingLayout } from '../homeMenuLayout'
import { FruitNinjaLogo, SettingsRing, StartRing, WoodSign } from './rings'

export function HomeOverlay({ layout }: { layout: HomeRingLayout }) {
  // Strictly independent UI layer (no HUD). All pointer events go to the canvas below.
  return (
    <div className="pointer-events-none absolute inset-0 z-[30]">
      {/* Keep the home vignette mood, but avoid overlaying faux plank stripes on top of 3D fruit. */}
      <div
        className="absolute inset-[-12%] opacity-55"
        style={{
          transform: 'skewX(-12deg) rotate(-6deg)',
          transformOrigin: '50% 50%',
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.42) 100%)',
        }}
      />
      {/* top logo */}
      <div className="absolute left-[6%] top-[5%]">
        <FruitNinjaLogo />
      </div>

      {/* left sign */}
      <WoodSign className="absolute left-[6.5%] top-[26%] rotate-[-6deg]" />

      {/* center start ring — position/size from `computeHomeRingLayout(playfield)` (matches 3D decor). */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${layout.uStart * 100}%`,
          top: `${layout.vStart * 100}%`,
        }}
      >
        <div
          className="relative"
          data-testid="fruit-ninja-home-start-ring"
          style={{
            width: layout.startRingPx,
            height: layout.startRingPx,
          }}
        >
          <StartRing
            className="absolute inset-0 animate-[spin_22s_linear_infinite]"
            labelText="CLASSIC"
          />
          <div className="absolute inset-0 rounded-full shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
        </div>
      </div>

      {/* right settings ring */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${layout.uSettings * 100}%`,
          top: `${layout.vSettings * 100}%`,
        }}
      >
        <div
          className="relative"
          data-testid="fruit-ninja-home-settings-ring"
          style={{
            width: layout.settingsRingPx,
            height: layout.settingsRingPx,
          }}
        >
          <SettingsRing
            className="absolute inset-0 animate-[spin_28s_linear_infinite_reverse]"
            labelText="ZEN"
          />
        </div>
      </div>
    </div>
  )
}
