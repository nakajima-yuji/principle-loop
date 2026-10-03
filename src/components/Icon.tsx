// 外部ライブラリを使わない、線画アイコン（24px グリッド）
import type { ReactNode } from 'react';

export type IconName =
  | 'sun'
  | 'search'
  | 'book'
  | 'connect'
  | 'cube'
  | 'chart'
  | 'gear'
  | 'bell'
  | 'bookmark'
  | 'bookmarkFill'
  | 'read'
  | 'arrowRight'
  | 'arrowLeft'
  | 'crown'
  | 'bolt'
  | 'clock'
  | 'mail'
  | 'copy'
  | 'external'
  | 'plus'
  | 'x'
  | 'check'
  | 'pause'
  | 'play'
  | 'info'
  | 'link'
  | 'trash'
  | 'download'
  | 'upload'
  | 'terminal'
  | 'flask'
  | 'spark'
  | 'shuffle'
  | 'user'
  | 'heart';

const PATHS: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H10a2 2 0 0 1 2 2v14a1.6 1.6 0 0 0-1.6-1.6H4z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H14a2 2 0 0 0-2 2v14a1.6 1.6 0 0 1 1.6-1.6H20z" />
    </>
  ),
  connect: (
    <>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <circle cx="12" cy="6" r="2.4" />
      <path d="M10.8 8.1 7.2 15.9M13.2 8.1l3.6 7.8M8.4 18h7.2" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.8 20.2 7.4v9.2L12 21.2l-8.2-4.6V7.4z" />
      <path d="M3.8 7.4 12 12l8.2-4.6M12 12v9.2" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V12M10 20V7M15 20v-5M20 20V4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 1.8H4.4z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  bookmark: <path d="M6.5 3.8h11v16.7L12 16.6l-5.5 3.9z" />,
  bookmarkFill: <path d="M6.5 3.8h11v16.7L12 16.6l-5.5 3.9z" fill="currentColor" />,
  read: (
    <>
      <path d="M3 5.5h6.2A2.8 2.8 0 0 1 12 8.3V20a2.2 2.2 0 0 0-2.2-2.2H3z" />
      <path d="M21 5.5h-6.2A2.8 2.8 0 0 0 12 8.3V20a2.2 2.2 0 0 1 2.2-2.2H21z" />
    </>
  ),
  arrowRight: <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />,
  arrowLeft: <path d="M19.5 12h-15M10 6.5 4.5 12l5.5 5.5" />,
  crown: <path d="m3.5 8 4.2 3.6L12 5l4.3 6.6L20.5 8l-1.8 10H5.3z" />,
  bolt: <path d="M13.2 2.5 5 13.6h6.2l-1.4 7.9 8.2-11.1h-6.2z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.4 2.2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 6.6 8.2 6.4 8.2-6.4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  pause: <path d="M8.5 5v14M15.5 5v14" />,
  play: <path d="M7 4.8v14.4L19 12z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5" />
    </>
  ),
  flask: <path d="M9.5 3.5h5M10.5 3.5v5.3L4.8 18.3A1.5 1.5 0 0 0 6.1 20.5h11.8a1.5 1.5 0 0 0 1.3-2.2L13.5 8.8V3.5M7.4 14.5h9.2" />,
  spark: <path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2z" />,
  shuffle: <path d="M4 7h3.5c4 0 5 10 9 10H20M17 14l3 3-3 3M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13 9.6c.9-1.6 1.9-2.6 3.5-2.6H20M17 4l3 3-3 3" />,
  user: (
    <>
      <circle cx="12" cy="9" r="3.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
};

export function Icon({ name, size = 20, stroke = 1.7, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.56} viewBox="0 0 100 56" aria-hidden="true">
      <defs>
        <linearGradient id="pl-logo" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#2f66e8" />
          <stop offset="0.55" stopColor="#0aa3c2" />
          <stop offset="1" stopColor="#0f9688" />
        </linearGradient>
      </defs>
      <path
        d="M50 28c-8-10-14.5-16-23-16a16 16 0 0 0 0 32c8.5 0 15-6 23-16s14.5-16 23-16a16 16 0 0 1 0 32c-8.5 0-15-6-23-16z"
        fill="none"
        stroke="url(#pl-logo)"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
