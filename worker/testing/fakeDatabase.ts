/**
 * Fausse Realtime Database en mémoire reproduisant l'API REST utilisée par le Worker :
 * GET (avec ETag sur demande), PUT (conditionnel avec if-match → 412), `print=silent`,
 * jeton Bearer obligatoire. Pour les tests uniquement — aucun accès réseau.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface FakeDatabaseOptions {
  baseUrl: string;
  token: string;
  /** Appelé juste avant d'appliquer un PUT : permet de simuler une écriture concurrente. */
  beforePut?: (path: string) => void | Promise<void>;
  /** Latence aléatoire maximale (ms) pour entrelacer les requêtes. */
  jitterMs?: number;
}

/** Comme la vraie base : les valeurs null sont supprimées, les objets vides disparaissent. */
function stripNulls(v: Json): Json {
  if (v === null || typeof v !== "object") return v;
  const entries = Object.entries(v as Record<string, Json>)
    .map(([k, x]) => [k, stripNulls(x)] as const)
    .filter(([, x]) => x !== null);
  return entries.length ? Object.fromEntries(entries) : null;
}

function etagOf(value: unknown): string {
  const s = JSON.stringify(value ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `"${(h >>> 0).toString(16)}-${s.length}"`;
}

export class FakeDatabase {
  root: Json = null;
  requests: { method: string; path: string; ifMatch?: string; status: number }[] = [];

  constructor(private opts: FakeDatabaseOptions) {}

  get(path: string): Json {
    let node: Json = this.root;
    for (const k of path.split("/").filter(Boolean)) {
      if (!node || typeof node !== "object" || Array.isArray(node)) return null;
      node = (node as Record<string, Json>)[k] ?? null;
    }
    return node;
  }

  set(path: string, value: Json) {
    const keys = path.split("/").filter(Boolean);
    if (keys.length === 0) {
      this.root = stripNulls(value);
      return;
    }
    if (!this.root || typeof this.root !== "object") this.root = {};
    let node = this.root as Record<string, Json>;
    for (const k of keys.slice(0, -1)) {
      if (!node[k] || typeof node[k] !== "object") node[k] = {};
      node = node[k] as Record<string, Json>;
    }
    const last = keys[keys.length - 1];
    const clean = stripNulls(JSON.parse(JSON.stringify(value)) as Json); // comme la vraie base : JSON pur
    if (clean === null) delete node[last];
    else node[last] = clean;
  }

  fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input);
    if (!input.startsWith(this.opts.baseUrl + "/") || !url.pathname.endsWith(".json")) {
      return new Response("not found", { status: 404 });
    }
    const path = url.pathname.slice(0, -".json".length).split("/").filter(Boolean).map(decodeURIComponent).join("/");
    const headers = new Headers(init.headers);
    const method = init.method ?? "GET";
    const log = (status: number) => {
      this.requests.push({ method, path, ifMatch: headers.get("if-match") ?? undefined, status });
    };

    if (headers.get("Authorization") !== `Bearer ${this.opts.token}`) {
      log(401);
      return new Response(JSON.stringify({ error: "Permission denied" }), { status: 401 });
    }
    if (this.opts.jitterMs) await new Promise((r) => setTimeout(r, Math.random() * this.opts.jitterMs!));

    if (method === "GET") {
      const value = this.get(path);
      const res = new Response(JSON.stringify(value), { status: 200 });
      if (headers.get("X-Firebase-ETag") === "true") res.headers.set("ETag", etagOf(value));
      log(200);
      return res;
    }

    if (method === "PUT") {
      await this.opts.beforePut?.(path);
      const ifMatch = headers.get("if-match");
      const current = this.get(path);
      if (ifMatch && ifMatch !== etagOf(current)) {
        log(412);
        const res = new Response(JSON.stringify(current), { status: 412 });
        res.headers.set("ETag", etagOf(current));
        return res;
      }
      this.set(path, JSON.parse(String(init.body)) as Json);
      const silent = url.searchParams.get("print") === "silent";
      log(silent ? 204 : 200);
      return silent ? new Response(null, { status: 204 }) : new Response(String(init.body), { status: 200 });
    }

    log(405);
    return new Response("method not allowed", { status: 405 });
  };
}
