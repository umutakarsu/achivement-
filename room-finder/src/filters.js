// Applies the user's filters to a normalized listing.
// A listing looks like:
// { id, source, title, url, price, sizeSqm, rooms, city, availableFrom, isTemporary, raw }

export function passesFilters(listing, filters) {
  const reasons = [];

  if (listing.price == null) {
    // Price is the whole point of this bot — drop listings we can't read a price from
    // unless the user explicitly allows unknown prices.
    if (!filters.allowUnknownPrice) reasons.push("no price");
  } else {
    if (filters.maxPrice != null && listing.price > filters.maxPrice)
      reasons.push(`price ${listing.price} > max ${filters.maxPrice}`);
    if (filters.minPrice != null && listing.price < filters.minPrice)
      reasons.push(`price ${listing.price} < min ${filters.minPrice}`);
  }

  if (filters.minSizeSqm && listing.sizeSqm != null && listing.sizeSqm < filters.minSizeSqm)
    reasons.push(`size ${listing.sizeSqm} < min ${filters.minSizeSqm}`);

  if (filters.minRooms && listing.rooms != null && listing.rooms < filters.minRooms)
    reasons.push(`rooms ${listing.rooms} < min ${filters.minRooms}`);

  if (filters.excludeTemporary && listing.isTemporary) reasons.push("temporary sublet");

  const haystack = `${listing.title} ${listing.raw ?? ""}`.toLowerCase();

  if (filters.keywordsExclude?.length) {
    for (const kw of filters.keywordsExclude) {
      if (kw && haystack.includes(kw.toLowerCase())) reasons.push(`excluded keyword "${kw}"`);
    }
  }

  if (filters.keywordsInclude?.length) {
    const hasAny = filters.keywordsInclude.some((kw) => kw && haystack.includes(kw.toLowerCase()));
    if (!hasAny) reasons.push("no required keyword matched");
  }

  return { ok: reasons.length === 0, reasons };
}
