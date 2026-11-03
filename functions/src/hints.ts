/**
 * Textes des indices des succès secrets — CÔTÉ SERVEUR UNIQUEMENT.
 * Un indice n'est envoyé au navigateur qu'après avoir été révélé (et payé) via l'action « hint ».
 *
 * ⚠️ Ce module ne doit avoir AUCUN effet de bord au chargement (pas de table calculée au niveau
 * du module) : le mode hors ligne l'importe indirectement, et seul un module sans effet de bord
 * est retiré du site de production par le build. La table est donc construite à la demande.
 *
 * Trame de rédaction (3 phrases par succès secret, de plus en plus précises) :
 *  1. Vague       — oriente vers le thème, sans chiffre ni nom. « Ce succès récompense une rareté très élevée… »
 *  2. Précis      — donne la catégorie et l'ordre de grandeur. « …une aura plus rare que 1 sur 10 millions. »
 *  3. Quasi-sol.  — presque tout, sans la réponse exacte. « …de la famille des rêves ou au-delà. »
 * Ne jamais écrire la condition exacte (nombre précis, nom d'aura) dans l'indice 3.
 */
import { SECRET_ACHIEVEMENT_IDS, type PlayerState } from "../../shared/index";

let table: Record<string, [string, string, string]> | null = null;

/** Textes par succès secret : [vague, précis, quasi-solution]. À remplir au fur et à mesure. */
export function hintTexts(): Record<string, [string, string, string]> {
  if (!table) {
    const placeholder = "Indice à venir.";
    const written: Record<string, [string, string, string]> = {
      // id_du_succes: ["Indice vague…", "Indice précis…", "Quasi-solution…"],
    };
    table = Object.fromEntries(SECRET_ACHIEVEMENT_IDS.map((id) => [id, written[id] ?? [placeholder, placeholder, placeholder]]));
  }
  return table;
}

/** Indices déjà révélés par le joueur (uniquement ceux-là). */
export function revealedHints(state: PlayerState): Record<string, string[]> {
  const texts = hintTexts();
  const out: Record<string, string[]> = {};
  for (const [id, level] of Object.entries(state.hints)) {
    if (texts[id] && level > 0) out[id] = texts[id].slice(0, level);
  }
  return out;
}
