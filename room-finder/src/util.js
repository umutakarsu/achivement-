export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull the first euro amount out of a string: "450 €", "EUR 1.200,50", "450€ Warmmiete"
export function parsePrice(text) {
  if (text == null) return null;
  const m = String(text).match(/(\d[\d.\s]*(?:,\d+)?)\s*(?:€|eur)/i) || String(text).match(/(\d[\d.\s]*(?:,\d+)?)/);
  if (!m) return null;
  const normalized = m[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Pull square meters out of "23 m²", "23m2", "23 qm"
export function parseSize(text) {
  if (text == null) return null;
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|qm)/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function fetchHtml(url, http) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), http.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": http.userAgent,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
