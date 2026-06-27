import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULTS = {
  filters: {
    maxPrice: 450,
    minPrice: 0,
    cities: ["Berlin"],
    minSizeSqm: 0,
    minRooms: 0,
    availableFrom: null,
    rentTypes: ["wg", "apartment"],
    excludeTemporary: false,
    keywordsInclude: [],
    keywordsExclude: [],
  },
  sources: ["wggesucht", "kleinanzeigen"],
  notify: {
    method: "console",
    file: "results/latest.json",
    email: { to: "", from: "", smtpUrl: "" },
  },
  http: {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    delayMs: 1800,
    timeoutMs: 20000,
    maxPages: 2,
  },
};

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (override && typeof override === "object") {
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = deepMerge(base?.[key], override[key]);
    }
    return out;
  }
  return override === undefined ? base : override;
}

// CLI overrides: --maxPrice 500 --cities Berlin,Munich --method file
function parseCliOverrides(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    if (key === "maxPrice") (o.filters ??= {}).maxPrice = Number(val);
    else if (key === "minPrice") (o.filters ??= {}).minPrice = Number(val);
    else if (key === "cities") (o.filters ??= {}).cities = val.split(",").map((s) => s.trim());
    else if (key === "minSizeSqm") (o.filters ??= {}).minSizeSqm = Number(val);
    else if (key === "minRooms") (o.filters ??= {}).minRooms = Number(val);
    else if (key === "method") (o.notify ??= {}).method = val;
    else if (key === "sources") o.sources = val.split(",").map((s) => s.trim());
  }
  return o;
}

export function loadConfig(argv = []) {
  let fileCfg = {};
  try {
    fileCfg = JSON.parse(readFileSync(resolve(ROOT, "config.json"), "utf8"));
  } catch {
    // No config file: fall back to defaults.
  }
  const merged = deepMerge(DEFAULTS, fileCfg);
  return { ...deepMerge(merged, parseCliOverrides(argv)), _root: ROOT };
}
