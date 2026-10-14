/**
 * Usage (Node 24, aucune installation) :
 *   node scripts/rtdb-export-to-sql.ts <export-firebase.json> <sortie.sql>
 *
 * Lit un export JSON téléchargé depuis la console Firebase et écrit un fichier SQL
 * d'INSERT OR IGNORE pour D1. Ce script ne contacte ni Firebase ni Cloudflare.
 * L'import réel se fait ensuite, après vérification, avec :
 *   npx wrangler d1 execute rng-aura --local  --file <sortie.sql>   (base locale de test)
 *   npx wrangler d1 execute rng-aura --remote --file <sortie.sql>   (production, avec accord)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { rtdbExportToSql } from "../worker/migration/rtdbImport.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node scripts/rtdb-export-to-sql.ts <export-firebase.json> <sortie.sql>");
  process.exit(1);
}

const { sql, counts } = rtdbExportToSql(JSON.parse(readFileSync(input, "utf8")), Date.now());
writeFileSync(output, sql);
console.log(`Écrit ${output} :`, counts);
