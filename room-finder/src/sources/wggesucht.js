import * as cheerio from "cheerio";
import { fetchHtml, parsePrice, parseSize, sleep } from "../util.js";

export const name = "wggesucht";

// WG-Gesucht encodes the city in the URL as a numeric id. These are the
// common ones; add more from the site's URL bar (the number after the city name).
const CITY_IDS = {
  berlin: 8,
  hamburg: 55,
  münchen: 90,
  munich: 90,
  muenchen: 90,
  köln: 73,
  cologne: 73,
  koeln: 73,
  "frankfurt am main": 41,
  frankfurt: 41,
  stuttgart: 124,
  düsseldorf: 30,
  duesseldorf: 30,
  leipzig: 77,
  dortmund: 26,
  essen: 32,
  bremen: 17,
  dresden: 22,
  hannover: 57,
  nürnberg: 96,
  nuremberg: 96,
  nuernberg: 96,
};

function cityId(city) {
  return CITY_IDS[city.trim().toLowerCase()] ?? null;
}

// rentTypes -> WG-Gesucht category flags in the ".1.0" segment.
// 0 = WG room, 1 = 1-room flat, 2 = flat, 3 = house.
function categorySegment(rentTypes) {
  const wantsWg = rentTypes.includes("wg");
  const wantsFlat = rentTypes.includes("apartment");
  if (wantsWg && !wantsFlat) return { slug: "wg-zimmer", cat: 0 };
  if (!wantsWg && wantsFlat) return { slug: "1-zimmer-wohnungen", cat: 1 };
  return { slug: "wg-zimmer", cat: 0 }; // default: WG rooms
}

function buildUrl(city, id, filters, page) {
  const { slug } = categorySegment(filters.rentTypes ?? ["wg"]);
  const cityName = city.replace(/\s+/g, "-");
  // pattern: /<slug>-in-<City>.<id>.0.1.<page>.html
  const base = `https://www.wg-gesucht.de/${slug}-in-${encodeURIComponent(cityName)}.${id}.0.1.${page}.html`;
  const params = new URLSearchParams();
  if (filters.maxPrice != null) params.set("rMax", String(filters.maxPrice));
  if (filters.minSizeSqm) params.set("sMin", String(filters.minSizeSqm));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function search(filters, http, log) {
  const results = [];
  for (const city of filters.cities) {
    const id = cityId(city);
    if (id == null) {
      log(`  [wggesucht] no city id for "${city}" — add it to CITY_IDS in src/sources/wggesucht.js`);
      continue;
    }
    const maxPages = http.maxPages ?? 1;
    for (let page = 0; page < maxPages; page++) {
      const url = buildUrl(city, id, filters, page);
      try {
        const html = await fetchHtml(url, http);
        const parsed = parseListings(html, city);
        log(`  [wggesucht] ${city} page ${page}: ${parsed.length} listings`);
        results.push(...parsed);
        if (parsed.length === 0) break;
      } catch (err) {
        log(`  [wggesucht] ${city} page ${page} failed: ${err.message}`);
        break;
      }
      await sleep(http.delayMs ?? 1500);
    }
  }
  return results;
}

function parseListings(html, city) {
  const $ = cheerio.load(html);
  const out = [];
  // WG-Gesucht offer cards. Selectors are best-effort; if the site changes its
  // markup, adjust here — this is the one place that knows their HTML.
  $("[id^='liste-details-ab-']").each((_, el) => {
    const card = $(el);
    const linkEl = card.find("a[href*='.html']").first();
    let href = linkEl.attr("href") || "";
    if (href && !href.startsWith("http")) href = `https://www.wg-gesucht.de/${href.replace(/^\//, "")}`;
    const idMatch = (card.attr("id") || "").match(/(\d+)/);
    const id = idMatch ? `wg-${idMatch[1]}` : `wg-${href}`;

    const cardText = card.text().replace(/\s+/g, " ").trim();
    const title = (linkEl.attr("title") || linkEl.text() || cardText.slice(0, 80)).trim();

    const price = parsePrice(cardText.match(/(\d[\d.\s]*)\s*€/)?.[0] ?? cardText);
    const sizeSqm = parseSize(cardText);

    out.push({
      id,
      source: "wggesucht",
      title,
      url: href,
      price,
      sizeSqm,
      rooms: null,
      city,
      availableFrom: null,
      isTemporary: /befristet|zwischenmiete|temporär|temporar/i.test(cardText),
      raw: cardText.slice(0, 300),
    });
  });
  return out;
}
