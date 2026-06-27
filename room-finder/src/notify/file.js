import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export async function notify(listings, cfg) {
  const target = resolve(cfg._root, cfg.notify.file || "results/latest.json");
  mkdirSync(dirname(target), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: listings.length,
    filters: cfg.filters,
    listings,
  };
  writeFileSync(target, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${listings.length} listing(s) to ${target}`);
}
