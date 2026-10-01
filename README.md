# PassiveAggressive

Static guild website at https://passiveaggressive.us/. GitHub Pages publishes
the root of `master`. The application/token proxy is a **separate Cloudflare
Worker**; pushing to GitHub does not deploy the Worker.

## Checks

Use Node.js 22 or newer:

```sh
node --test tests/worker.test.mjs tests/application.test.mjs tests/home.test.mjs tests/character-lookup.test.mjs
```

The tests mock external services and never send applications to Discord.

## Deploy the backend

From this repository, with access to the existing Cloudflare account:

```sh
npx wrangler login
npx wrangler whoami
npx wrangler secret list
npx wrangler deploy
```

Verify that the account is the one hosting `pa-proxy.pnutjr-lw.workers.dev`.
The existing Worker needs these secrets (do not put values in Git):
`BLIZZ_CLIENT_ID`, `BLIZZ_CLIENT_SECRET`, `DISCORD_WEBHOOK_URL`.
Set only missing secrets using `npx wrangler secret put SECRET_NAME`.
Deploy from this directory so `wrangler.toml` creates the required
`APPLICATION_RATE_LIMITER` binding. The application route returns 503 if that
binding or the webhook secret is absent; it never silently disables protection.

The limiter allows five attempts per IP per minute at each Cloudflare location.
It reduces anonymous bursts, but is not a global quota or bot authentication.
The origin check is an additional browser safeguard, not authentication.
If sustained abuse occurs, add a verified challenge such as Turnstile.
Rate limiter documentation:
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.

The Worker also serves `POST /character-search`, which powers the name popup on the Apply page. Blizzard has no character-name search, so it proxies Raider.io's public (undocumented) search endpoint, keeps US results only, and caches them for 5 minutes. If it is not deployed or Raider.io is down, the popup stays hidden and the manual "Look up Character" button still works. Deploy the Worker (`npx wrangler deploy`) for the popup to work after pushing the site.

The frontend retains the existing embed request format so it continues to work
while the Worker deployment is pending. The new Worker extracts only the nine
validated application fields, rebuilds the message, disables Discord mentions,
limits body/field sizes, checks origin, and handles upstream errors. Previously
opened forms without the new honeypot/rules properties remain compatible.

## Content maintenance

- Active hours are Monday–Friday 5:30–10:30 p.m. Eastern / Area 52 server time,
  and throughout the day on weekends. Keep Home, About, Mythic+, and Apply aligned.
- Keep recruitment/key-range facts on the homepage current.
- A missing member count is shown as unavailable, never replaced by an estimate.
- Guide update dates come from their prior Git history. When mechanics are edited,
  update the corresponding `<time>` date. The resource links are further reading,
  not claims that every mechanic was independently verified.
- `logo-small.webp` and `favicon.png` are resized versions of `logo.png`; the
  original is retained for social previews and future artwork exports.

## Application character lookup

The optional lookup uses the existing `/blizzard-token` endpoint, then calls
Blizzard's public retail-US realm index and character profile endpoints directly.
No additional Worker route or backend deployment is required for this feature.
Applicants enter a character name and select a realm (Area 52 is the default).
Lookup runs automatically after 700 ms without typing, and also after a realm
change. It waits until at least two characters are entered, defers during IME
composition, and cancels pending requests when details change. Blizzard's public
profile endpoint requires the complete name; this is not a prefix search across
all characters. The lookup button remains available for an immediate retry.
A successful lookup fills the official name, realm, class, active spec, and role;
spec and role remain editable for the application. Manual entry remains available
when a character is private, absent, or Blizzard is unavailable. This is a public
profile lookup, not a verification of account ownership.
