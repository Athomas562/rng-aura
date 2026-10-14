/** Générateur uniforme dans [0, 1). */
export type Rng = () => number;

/**
 * RNG cryptographique sur 53 bits (précision maximale d'un double),
 * nécessaire pour distinguer correctement des chances de 1 sur 250 000 000.
 * Fonctionne dans le navigateur et dans Node ≥ 19 (globalThis.crypto).
 */
export const secureRng: Rng = () => {
  const buf = new Uint32Array(2);
  globalThis.crypto.getRandomValues(buf);
  // 27 bits + 26 bits = 53 bits
  return ((buf[0] >>> 5) * 67108864 + (buf[1] >>> 6)) / 9007199254740992;
};

/** RNG déterministe (mulberry32) — uniquement pour les tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
