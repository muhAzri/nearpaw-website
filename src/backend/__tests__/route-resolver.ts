import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/api/v1");

function walk(dir: string, rel: string[] = []): string[][] {
  const out: string[][] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, [...rel, name]));
    else if (name === "route.ts") out.push(rel);
  }
  return out;
}

const ROUTES = walk(ROOT);

/** Maps a concrete URL path to its route file and dynamic params (static segments win). */
export function resolveRoute(segments: string[]): { file: string; params: Record<string, string> } {
  let best: { pattern: string[]; score: number } | null = null;
  for (const pattern of ROUTES) {
    if (pattern.length !== segments.length) continue;
    let score = 0;
    const ok = pattern.every((p, i) => {
      if (p.startsWith("[")) return true;
      score++;
      return p === segments[i];
    });
    if (ok && (!best || score > best.score)) best = { pattern, score };
  }
  if (!best) throw new Error(`No route for /${segments.join("/")}`);
  const params: Record<string, string> = {};
  best.pattern.forEach((p, i) => {
    if (p.startsWith("[")) params[p.slice(1, -1)] = segments[i];
  });
  return { file: best.pattern.join("/"), params };
}
