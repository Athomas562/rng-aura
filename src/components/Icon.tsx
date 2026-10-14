const ICONS = {
  roll: "M12 2l8.7 5v10L12 22l-8.7-5V7zM12 2v20M3.3 7l17.4 10M20.7 7L3.3 17",
  inventory: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  collection: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  achievements: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  leaderboard: "M3 20h18M5 20v-6h4v6M10 20V9h4v11M15 20v-9h4v9M12 3l1 2h2l-1.5 1.5L14 9l-2-1.2L10 9l.5-2.5L9 5h2z",
  settings:
    "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7 15h10",
  clover: "M12 12c-3-1-5-3-5-5a2.5 2.5 0 0 1 5-.5a2.5 2.5 0 0 1 5 .5c0 2-2 4-5 5M12 12c1 3 3 5 5 5a2.5 2.5 0 0 0 .5-5M12 12c-1 3-3 5-5 5a2.5 2.5 0 0 1-.5-5M12 12l2 9",
  fire: "M12 2c3 4 6 7 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7c0 2 1 3 2 3c0-3-1-5 1-7",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2",
  star: "M12 2l3 6.5l7 1l-5 5l1.2 7L12 18l-6.2 3.5L7 14.5l-5-5l7-1z",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  logout: "M15 4h4v16h-4M10 8l-4 4l4 4M6 12h11",
  bolt: "M13 2L4 14h7l-1 8l9-12h-7z",
  repeat: "M17 2l3 3l-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3l3-3M20 13v2a4 4 0 0 1-4 4H4",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  check: "M5 12l5 5L20 7",
  volume: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
