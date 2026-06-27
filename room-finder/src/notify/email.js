// Sends matches by email via SMTP. Requires `nodemailer` and an SMTP URL in
// config (notify.email.smtpUrl), e.g. "smtps://user:pass@smtp.example.com:465".
// Protonmail note: use Proton Mail Bridge locally, or any SMTP you control.
function renderHtml(listings, filters) {
  const rows = listings
    .map((l) => {
      const price = l.price != null ? `${l.price} €` : "?";
      const size = l.sizeSqm != null ? `${l.sizeSqm} m²` : "";
      return `<tr>
        <td><strong>${price}</strong></td>
        <td>${size}</td>
        <td>${l.source}</td>
        <td><a href="${l.url}">${escapeHtml(l.title)}</a></td>
      </tr>`;
    })
    .join("");
  return `<h2>${listings.length} new room(s) under ${filters.maxPrice} €</h2>
    <table cellpadding="6" border="1" style="border-collapse:collapse">
      <tr><th>Price</th><th>Size</th><th>Source</th><th>Listing</th></tr>
      ${rows}
    </table>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export async function notify(listings, cfg) {
  if (listings.length === 0) {
    console.log("\nNo new rooms — skipping email.");
    return;
  }
  const { to, from, smtpUrl } = cfg.notify.email || {};
  if (!smtpUrl || !to) {
    console.log("\n[email] notify.email.smtpUrl and notify.email.to must be set — skipping email.");
    return;
  }
  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    console.log("\n[email] nodemailer not installed. Run: npm install nodemailer");
    return;
  }
  const transport = nodemailer.createTransport(smtpUrl);
  await transport.sendMail({
    from: from || to,
    to,
    subject: `🏠 ${listings.length} new room(s) under ${cfg.filters.maxPrice} € in ${cfg.filters.cities.join(", ")}`,
    html: renderHtml(listings, cfg.filters),
  });
  console.log(`\n[email] Sent ${listings.length} listing(s) to ${to}`);
}
