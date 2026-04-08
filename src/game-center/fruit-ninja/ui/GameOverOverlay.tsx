import type { GameOverLayout } from '../homeMenuLayout'
import { StartRing } from './rings'

export function GameOverOverlay({
  score,
  onRetry,
  onQuit,
  layout,
}: {
  score: number
  onRetry: () => void
  onQuit: () => void
  layout: GameOverLayout
}) {
  // Strict independent layer (no HUD). Pointer events must go to the canvas (slice-to-select).
  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {/* parchment board — compact; sized in `computeGameOverLayout` to clear the bottom rings */}
      <div
        data-testid="fruit-ninja-gameover-score-board"
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: layout.scoreBoardTopPx,
          width: `${layout.scoreBoardWidthPct}%`,
        }}
      >
        <div className="relative rounded-[10px] border border-[#6a4a1d]/70 bg-gradient-to-b from-[#f3e3be] via-[#e7d1a4] to-[#d7b77f] shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
          <div className="text-center" style={{ paddingTop: layout.scoreBoardPaddingY, paddingBottom: layout.scoreBoardPaddingY }}>
            <div
              className="mx-auto font-black tracking-[0.12em] text-[#e4b54a]"
              style={{
                fontSize: layout.scoreTitlePx,
                WebkitTextStroke: `${layout.scoreStrokeTitle}px rgba(90,60,18,0.92)`,
              }}
            >
              SCORE
            </div>
            <div
              className="mx-auto mt-[-2px] font-black tabular-nums text-[#f2c24a]"
              style={{
                fontSize: layout.scoreNumberPx,
                WebkitTextStroke: `${layout.scoreStrokeNumber}px rgba(90,60,18,0.92)`,
                textShadow: '0 6px 0 rgba(0,0,0,0.18)',
                lineHeight: 1,
              }}
            >
              {score}
            </div>
          </div>
        </div>
      </div>

      {/* retry button */}
      <button
        type="button"
        aria-label="再玩一次"
        onClick={onRetry}
        data-testid="fruit-ninja-gameover-retry"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${layout.uRetry * 100}%`,
          top: `${layout.vButtons * 100}%`,
          width: layout.buttonPx,
          height: layout.buttonPx,
        }}
      />
      <div
        data-testid="fruit-ninja-gameover-retry-ring"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${layout.uRetry * 100}%`,
          top: `${layout.vButtons * 100}%`,
          width: layout.ringPx,
          height: layout.ringPx,
        }}
      >
        <StartRing className="absolute inset-0 opacity-95 [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.45))]" />
      </div>

      {/* quit button */}
      <button
        type="button"
        aria-label="返回首页"
        onClick={onQuit}
        data-testid="fruit-ninja-gameover-quit"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${layout.uQuit * 100}%`,
          top: `${layout.vButtons * 100}%`,
          width: layout.buttonPx,
          height: layout.buttonPx,
        }}
      />
      <div
        data-testid="fruit-ninja-gameover-quit-ring"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${layout.uQuit * 100}%`,
          top: `${layout.vButtons * 100}%`,
          width: layout.ringPx,
          height: layout.ringPx,
        }}
      >
        <svg viewBox="0 0 320 320" className="absolute inset-0 opacity-95 [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.45))]" aria-hidden="true">
          <defs>
            <linearGradient id="fnQuitRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff2a2a" />
              <stop offset="55%" stopColor="#c01010" />
              <stop offset="100%" stopColor="#6a0000" />
            </linearGradient>
            <mask id="fnQuitMask">
              <rect x="0" y="0" width="320" height="320" fill="black" />
              <circle cx="160" cy="160" r="125" fill="white" />
              <circle cx="160" cy="160" r="92" fill="black" />
            </mask>
            <path id="fnQuitPath" d="M 160, 160 m -108, 0 a 108,108 0 1,1 216,0 a 108,108 0 1,1 -216,0" />
          </defs>
          <circle cx="160" cy="160" r="146" fill="rgba(0,0,0,0.18)" />
          <circle cx="160" cy="160" r="125" fill="url(#fnQuitRing)" stroke="rgba(255,255,255,0.18)" strokeWidth="10" mask="url(#fnQuitMask)" />
          <circle cx="160" cy="160" r="92" fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
          <text fill="rgba(255,240,240,0.92)" fontSize="18" fontWeight="900" letterSpacing="2.4" style={{ textTransform: 'uppercase' }}>
            <textPath href="#fnQuitPath" startOffset="10%">
              QUIT • QUIT • QUIT • QUIT • QUIT •
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  )
}

