import type { SigilId } from "../../shared";

/** Tracés SVG (viewBox 24×24, trait uniquement) de chaque sigil d'aura. */
const PATHS: Record<SigilId, string> = {
  dot: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 3v2M12 19v2M3 12h2M19 12h2",
  ember: "M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4c0 2 1 3 2 3c0-3-1-5 1-9",
  drop: "M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11M9.5 15a2.5 2.5 0 0 0 2.5 2.5",
  swirl: "M12 12a2 2 0 1 1 2-2a4 4 0 1 1-4-4a6 6 0 1 1-6 6",
  bubble: "M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14M9 9a3 3 0 0 1 3-1.5",
  crystal: "M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M12 2l-2 2M12 2l2 2M12 22l-2-2M12 22l2-2",
  gem: "M6 4h12l4 6l-10 11L2 10zM2 10h20M9 4l-2 6l5 11l5-11l-2-6",
  flame: "M12 2c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-5 4-9c1 3 3 4 3 7c1-2 1-6 0-10M12 14a2 2 0 0 0-2 2a2 2 0 0 0 4 0",
  wave: "M2 12c2-4 4-4 6 0s4 4 6 0s4-4 6 0M5 7c1.5-2 3-2 4.5 0M14.5 17c1.5 2 3 2 4.5 0",
  flower: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 9c-1-4 1-6 0-7c-1 1 1 3 0 7M15 12c4-1 6 1 7 0c-1-1-3 1-7 0M12 15c1 4-1 6 0 7c1-1-1-3 0-7M9 12c-4 1-6-1-7 0c1 1 3-1 7 0",
  nebula: "M4 14c0-5 5-9 10-8s7 6 4 9s-8 2-8-1s4-4 5-2M7 19c3 1 7 0 9-2",
  prism: "M12 3l9 16H3zM12 3v16M3 19l9-6l9 6",
  ghost: "M6 21V10a6 6 0 0 1 12 0v11l-2-2l-2 2l-2-2l-2 2l-2-2zM9.5 10h.01M14.5 10h.01",
  bolt: "M13 2L4 14h7l-1 8l9-12h-7z",
  wing: "M12 20c-1-6-4-10-10-12c3 4 4 7 4 9M12 20c1-6 4-10 10-12c-3 4-4 7-4 9M12 20V8M12 4a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  abyss: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
  sun: "M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  leaf: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15M5 19l9-9",
  triad: "M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M7 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8M17 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
  eclipse: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M15 6a7 7 0 0 1 0 12a7 7 0 0 0 0-12M12 1v2M12 21v2M1 12h2M21 12h2",
  trident: "M12 22V6M5 3v5a7 7 0 0 0 14 0V3M12 2l-2 4h4z",
  halo: "M12 2c5 0 8 1.5 8 3s-3 3-8 3s-8-1.5-8-3s3-3 8-3M12 11a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 13c-2 3-1 6 2 8M20 13c2 3 1 6-2 8",
  dawn: "M2 17h20M5 21h14M6 17a6 6 0 0 1 12 0M12 5v3M5 9l2 2M19 9l-2 2M2 13h2M20 13h2",
  eye: "M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  constellation: "M4 18l5-6l5 3l6-10M4 18h.01M9 12h.01M14 15h.01M20 5h.01M4 18a1 1 0 1 0 0 .1M9 12a1 1 0 1 0 0 .1M14 15a1 1 0 1 0 0 .1M20 5a1 1 0 1 0 0 .1",
  nova: "M12 2l1.5 7.5L21 8l-6 4l6 4l-7.5-1.5L12 22l-1.5-7.5L3 16l6-4l-6-4l7.5 1.5z",
  zenith: "M12 2v20M12 2l-4 6M12 2l4 6M5 14h14M7 18h10M9 22h6",
  singularity: "M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4M3 12c0-6 9-9 9-9M21 12c0 6-9 9-9 9M12 3c6 0 9 9 9 9M12 21c-6 0-9-9-9-9",
  paradox: "M5 5l14 14M19 5L5 19M12 2a10 10 0 0 1 0 20M12 22a10 10 0 0 1 0-20",
  void: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
  infinity: "M12 12c-2-3-4-5-6.5-5a5 5 0 0 0 0 10c2.5 0 4.5-2 6.5-5s4-5 6.5-5a5 5 0 0 1 0 10c-2.5 0-4.5-2-6.5-5",
  ouroboros: "M12 3a9 9 0 1 0 9 9M21 12a9 9 0 0 0-6-8.5M15 3.5l3 -1.5l-1 3M12 7a5 5 0 1 0 5 5",
};

export function Sigil({ id, size = 24, className }: { id: SigilId; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
