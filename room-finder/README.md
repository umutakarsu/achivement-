# Room Finder DE 🏠

A small bot that searches German room/flat sites for listings **under a price you set**,
filters them, and notifies you. Built for the "find me a WG room under €450" use case.

## What it does

1. Queries each configured **source** (WG-Gesucht, Kleinanzeigen) for your cities.
2. Applies your **filters** (price, size, rooms, keywords, temporary-or-not).
3. Remembers what it already showed you, so scheduled runs only report **new** rooms.
4. **Notifies** you via console, a JSON file, or email.

## Quick start

```bash
cd room-finder
npm install
npm run search
```

Edit `config.json` to set your filters, or override on the command line:

```bash
node src/index.js --cities Berlin,Munich --maxPrice 450 --minSizeSqm 15 --method file
```

## Filters (in `config.json`)

| Filter            | Meaning                                                        |
|-------------------|---------------------------------------------------------------|
| `maxPrice`        | Hard cap in € (e.g. `450`). Listings without a price are dropped. |
| `minPrice`        | Lower bound, if you want to skip suspiciously cheap scams.     |
| `cities`          | List of German cities, e.g. `["Berlin", "Munich"]`.           |
| `minSizeSqm`      | Minimum room/flat size in m².                                  |
| `minRooms`        | Minimum number of rooms.                                       |
| `rentTypes`       | `"wg"` (shared room) and/or `"apartment"` (whole flat).        |
| `excludeTemporary`| Skip befristet / Zwischenmiete / temporary sublets.           |
| `keywordsInclude` | Listing must contain at least one of these words.             |
| `keywordsExclude` | Listing is dropped if it contains any of these words.         |

## Delivery (`notify.method`)

- `"console"` — print matches to the terminal (default).
- `"file"` — write matches to `results/latest.json`.
- `"email"` — send an HTML email. Requires `npm install nodemailer` and an SMTP
  URL in `notify.email.smtpUrl` (e.g. via Proton Mail Bridge for Protonmail).

## Run it on a schedule

Rooms go fast, so run it every few hours. Example cron (every 2 hours):

```cron
0 */2 * * * cd /path/to/room-finder && /usr/bin/node src/index.js >> run.log 2>&1
```

The `results/seen.json` file ensures you only ever get notified about **new** listings.

## Important notes

- **Run it from your own machine or a server.** This repo's cloud dev
  environment blocks outbound traffic to these sites (403), so live results
  only appear when you run it yourself.
- German listing sites actively block bots. If you get HTTP 403/429, slow down
  (`http.delayMs`), reduce `http.maxPages`, or run less frequently. Respect each
  site's Terms of Service and `robots.txt`.
- Adding a city: WG-Gesucht needs a numeric city id — add it to `CITY_IDS` in
  `src/sources/wggesucht.js` (the number appears in the site's URL).
- HTML selectors live in `src/sources/*.js`. If a site changes its markup and
  parsing returns 0, that's the one place to update.

## Project layout

```
room-finder/
  config.json          # all your filters + delivery settings
  src/
    index.js           # orchestration: collect -> filter -> dedup -> notify
    config.js          # config loading + CLI overrides
    filters.js         # the filtering logic
    store.js           # "already seen" memory for scheduled runs
    util.js            # fetch + price/size parsing
    sources/           # one file per site (add your own here)
    notify/            # console / file / email delivery
```
