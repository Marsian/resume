export function FruitNinjaThumbnail({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="fn-blade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="100%" stopColor="#ffd27a" />
        </linearGradient>
        <radialGradient id="fn-fruit" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="55%" stopColor="#ff7a3d" />
          <stop offset="100%" stopColor="#c41e4a" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0c111a" />
      <circle cx="34" cy="30" r="16" fill="url(#fn-fruit)" />
      <path
        d="M34 14 Q38 10 42 12"
        fill="none"
        stroke="#3d7c3d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M8 48 L52 10" stroke="url(#fn-blade)" strokeWidth="3.5" strokeLinecap="round" opacity="0.95" />
      <circle cx="22" cy="40" r="2.2" fill="#fff3b0" opacity="0.85" />
      <circle cx="40" cy="36" r="1.6" fill="#fff8e1" opacity="0.7" />
    </svg>
  )
}
