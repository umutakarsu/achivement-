export async function notify(listings) {
  if (listings.length === 0) {
    console.log("\nNo new rooms matched your filters this run.");
    return;
  }
  console.log(`\n🏠 ${listings.length} new room(s) matched:\n`);
  for (const l of listings) {
    const price = l.price != null ? `${l.price} €` : "price ?";
    const size = l.sizeSqm != null ? `, ${l.sizeSqm} m²` : "";
    console.log(`• [${l.source}] ${price}${size} — ${l.title}`);
    console.log(`  ${l.url}\n`);
  }
}
