# Ya Khaleel Awn Salawath

Independent Salawath counter for **யா கலீல் அவ்ன் மௌலானா**.

- Public target: 70,000
- Independent Cloudflare Worker and D1 database
- Live count, daily report, online visitors, and city-level visitor locations
- Location is collected only after the visitor grants browser permission. Store city/region only; do not store precise GPS coordinates.

## Setup

1. Create a Cloudflare D1 database and apply `schema.sql`.
2. Deploy `worker.js` as a Cloudflare Worker and bind the D1 database as `DB`.
3. Set `ALLOWED_ORIGINS` to the deployed website origin.
4. Update `API_BASE` in `index.html` to the Worker URL.
5. Enable GitHub Pages from the `main` branch (root).

See `wrangler.toml` for the Worker binding template.
