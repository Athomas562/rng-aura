import type { CSSProperties } from "react";
import { getRarity, type RarityId } from "../../shared";

export function RarityBadge({ rarity }: { rarity: RarityId }) {
  const r = getRarity(rarity);
  return (
    <span className={`rarity-badge tier-${r.tier}`} style={{ "--rc": r.color } as CSSProperties}>
      {r.label}
    </span>
  );
}
