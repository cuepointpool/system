/* Inline icons for the game shell. Kept as SVG (not image assets) so the
   navigation and reward chrome never depends on a file being uploaded, and
   so everything inherits currentColor. */

type P = { className?: string };

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" {...S} />
      <path d="M5.5 9.5V20h13V9.5" {...S} />
      <path d="M9.5 20v-6h5v6" {...S} />
    </svg>
  );
}

export function TrophyIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...S} />
      <path d="M7 5.5H4.5V7a3.5 3.5 0 0 0 3 3.46" {...S} />
      <path d="M17 5.5h2.5V7a3.5 3.5 0 0 1-3 3.46" {...S} />
      <path d="M12 14v3.5M8.5 21h7M9.5 21c0-1.9 1.1-3.5 2.5-3.5s2.5 1.6 2.5 3.5" {...S} />
    </svg>
  );
}

export function PlayIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M9 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  );
}

export function ChartIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="12" width="4" height="8" rx="1.2" {...S} />
      <rect x="10" y="7" width="4" height="13" rx="1.2" {...S} />
      <rect x="16" y="10" width="4" height="10" rx="1.2" {...S} />
    </svg>
  );
}

export function UserIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="8.5" r="3.6" {...S} />
      <path d="M4.5 20.5c.9-3.7 3.8-5.6 7.5-5.6s6.6 1.9 7.5 5.6" {...S} />
    </svg>
  );
}

export function LockIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="5" y="10.5" width="14" height="10" rx="2.4" {...S} />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" {...S} />
    </svg>
  );
}

export function CheckIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" {...S} strokeWidth={2.4} />
    </svg>
  );
}

export function CrownIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M3.5 8.5 7 12l5-6.5 5 6.5 3.5-3.5-1.6 9.5H5.1L3.5 8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function StarIcon({ className, filled = true }: P & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="m12 3.5 2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83L6.62 20.1l1.03-6L3.3 9.9l6-.9L12 3.5Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.5}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.45}
      />
    </svg>
  );
}

export function CoinIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="url(#coin-g)" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#8a6410" strokeWidth="1.1" opacity=".55" />
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="#6b4d08"
        fontFamily="system-ui, sans-serif"
      >
        8
      </text>
      <defs>
        <linearGradient id="coin-g" x1="4" y1="4" x2="20" y2="20">
          <stop stopColor="#ffd970" />
          <stop offset="1" stopColor="#c9971e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function XpIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" fill="url(#xp-g)" />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        fontSize="7.2"
        fontWeight="700"
        fill="#04121c"
        fontFamily="system-ui, sans-serif"
      >
        XP
      </text>
      <defs>
        <linearGradient id="xp-g" x1="4" y1="3" x2="20" y2="21">
          <stop stopColor="#2af0d6" />
          <stop offset="1" stopColor="#00a48f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BadgeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.5 20 5.5v6.2c0 4.6-3.2 8.3-8 9.8-4.8-1.5-8-5.2-8-9.8V5.5l8-3Z" fill="url(#badge-g)" />
      <path d="m8.6 12.2 2.4 2.4 4.4-4.6" fill="none" stroke="#04121c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="badge-g" x1="4" y1="3" x2="20" y2="21">
          <stop stopColor="#5fe8d6" />
          <stop offset="1" stopColor="#00816f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CueIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M20.5 3.5 8.2 15.8" stroke="url(#cue-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.2 15.8 4 20l4.2-1.1.9-3.1Z" fill="#d9c39a" />
      <circle cx="19.6" cy="4.4" r="1.5" fill="#2af0d6" />
      <defs>
        <linearGradient id="cue-g" x1="4" y1="20" x2="21" y2="3">
          <stop stopColor="#c9a86a" />
          <stop offset="1" stopColor="#6b4f2a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ChevronIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="m9 5 7 7-7 7" {...S} strokeWidth={2} />
    </svg>
  );
}

export function BackIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="m15 5-7 7 7 7" {...S} strokeWidth={2} />
    </svg>
  );
}

export function FlagIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M6 21V4" {...S} />
      <path d="M6 4.5h11l-2.2 3.8L17 12H6" fill="currentColor" opacity=".9" stroke="none" />
    </svg>
  );
}
