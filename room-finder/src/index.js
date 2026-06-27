#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { passesFilters } from "./filters.js";
import { SeenStore } from "./store.js";
import { uniqueBy } from "./util.js";

import * as wggesucht from "./sources/wggesucht.js";
import * as kleinanzeigen from "./sources/kleinanzeigen.js";

import { notify as notifyConsole } from "./notify/console.js";
import { notify as notifyFile } from "./notify/file.js";
import { notify as notifyEmail } from "./notify/email.js";

const SOURCES = { wggesucht, kleinanzeigen };
const NOTIFIERS = { console: notifyConsole, file: notifyFile, email: notifyEmail };

const log = (msg) => console.log(msg);

async function main() {
  const cfg = loadConfig(process.argv.slice(2));
  const { filters, http } = cfg;

  log(`Room finder — max ${filters.maxPrice} € in ${filters.cities.join(", ")}`);
  log(`Sources: ${cfg.sources.join(", ")}\n`);

  // 1. Collect raw listings from every configured source.
  const collected = [];
  for (const srcName of cfg.sources) {
    const src = SOURCES[srcName];
    if (!src) {
      log(`Unknown source "${srcName}" — skipping.`);
      continue;
    }
    log(`Searching ${srcName}...`);
    try {
      collected.push(...(await src.search(filters, http, log)));
    } catch (err) {
      log(`  ${srcName} errored: ${err.message}`);
    }
  }

  // 2. Filter, dedup, and keep only listings we haven't reported before.
  const deduped = uniqueBy(collected, (l) => l.id);
  const matched = deduped.filter((l) => passesFilters(l, filters).ok);

  const seen = new SeenStore(cfg._root);
  const fresh = matched.filter((l) => !seen.has(l.id));
  fresh.forEach((l) => seen.add(l.id));
  seen.save();

  fresh.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));

  log(
    `\nFound ${collected.length} raw, ${matched.length} matched filters, ${fresh.length} new since last run.`,
  );

  // 3. Notify. File output always also writes the full matched set for browsing.
  const notifier = NOTIFIERS[cfg.notify.method] || notifyConsole;
  await notifier(fresh, cfg);
  if (cfg.notify.method !== "file") {
    await notifyFile(matched, cfg); // keep results/latest.json fresh regardless
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
