import * as cheerio from "cheerio";
import { fetchHtml, parsePrice, parseSize, sleep } from "../util.js";

export const name = "kleinanzeigen";

// Kleinanzeigen (formerly eBay Kleinanzeigen) category 199 = "WG-Zimmer",
// 203 = "Mietwohnungen". Price cap goes in the URL as preis::<max>.
function buildUrl(city, filters, page) {
  const cat = (filters.rentTypes ?? ["wg"]).includes("apartment") && !(filters.rentTypes ?? []).includes("wg")
    ? "c203"
    : "c199";
  const citySlug = city.trim().toLowerCase().replace(/\s+/g, "-").replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" }[c]));
  const max = filters.maxPrice != null ? filters.maxPrice : "";
  const pageSeg = page > 1 ? `seite:${page}/` : "";
  // pattern: /s-wg-zimmer/<city>/preis::450/<pageSeg>c199l<...>
  return `https://www.kleinanzeigen.de/s-wg-zimmer/${citySlug}/preis::${max}/${pageSeg}${cat}`;
}

export async function search(filters, http, log) {
  const results = [];
  for (const city of filters.cities) {
    const maxPages = http.maxPages ?? 1;
    for (let page = 1; page <= maxPages; page++) {
      const url = buildUrl(city, filters, page);
      try {
        const html = await fetchHtml(url, http);
        const parsed = parseListings(html, city);
        log(`  [kleinanzeigen] ${city} page ${page}: ${parsed.length} listings`);
        results.push(...parsed);
        if (parsed.length === 0) break;
      } catch (err) {
        log(`  [kleinanzeigen] ${city} page ${page} failed: ${err.message}`);
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
  $("article.aditem").each((_, el) => {
    const card = $(el);
    const id = `ka-${card.attr("data-adid") || card.find("a").first().attr("href")}`;
    let href = card.find("a").first().attr("href") || "";
    if (href && !href.startsWith("http")) href = `https://www.kleinanzeigen.de${href}`;
    const title = card.find(".text-module-begin a, h2 a, .ellipsis").first().text().trim();
    const priceText = card.find(".aditem-main--middle--price-shipping--price, .aditem-main--middle--price").first().text();
    const cardText = card.text().replace(/\s+/g, " ").trim();

    out.push({
      id,
      source: "kleinanzeigen",
      title,
      url: href,
      price: parsePrice(priceText || cardText),
      sizeSqm: parseSize(cardText),
      rooms: null,
      city,
      availableFrom: null,
      isTemporary: /befristet|zwischenmiete|temporär|temporar/i.test(cardText),
      raw: cardText.slice(0, 300),
    });
  });
  return out;
}
