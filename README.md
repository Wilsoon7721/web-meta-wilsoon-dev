# web-meta.wilsoon.dev

Centralised platform that serves `robots.txt`, `security.txt`, `humans.txt` and `/.well-known/webfinger` for every `*.wilsoon.dev` app.

> [!NOTE]
> This is just one half of the application (the reader). I host the create/edit/delete portions in an internal app of mine, which is why it's not here. This specific app only covers the reading portion assuming a database is fully hooked up and ready with the `schema.sql` as defined.

## Request flow

```
crawler → tools.wilsoon.dev/robots.txt → Cloudflare Single Redirect (302) → web-meta.wilsoon.dev/robots.txt?origin=tools.wilsoon.dev → Cloudflare cache (30 days, cache-invalidation possible) → Netlify or Vercel function → Database
```

Without `?origin=`, the request's own host is used, so `web-meta.wilsoon.dev/robots.txt` serves itself. Origins outside `wilsoon.dev` / `*.wilsoon.dev` get a 400.

## Cache Invalidation

Cache invalidation is done via tags.

| Change                          | Tags                     |
| ------------------------------- | ------------------------ |
| create / edit / delete `<host>` | `wm-host-<host>`         |
| rename `a` → `b`                | `wm-host-a`, `wm-host-b` |
| edit `default`                  | `wm-default`             |
| everything                      | `wm`                     |

## Config shapes

```jsonc
// robots_config
{ "groups": [{ "user_agents": ["*"], "allow": ["/"], "disallow": ["/api/"], "crawl_delay": 5 }], "sitemaps": ["/sitemap.xml"] }

// security_config - Expires is always computed (180 days out), while Canonical defaults to this host's URL
{ "contact": ["mailto:hello@wilsoon.dev"], "encryption": "...", "policy": "/security-policy", "preferred_languages": ["en"] }

// humans_config - any top-level key becomes a /* SECTION */; site gets "Last update" from updated_at
{ "team": [{ "Name": "Wilson Oon" }], "thanks": ["..."], "site": { "Software": ["Next.js", "Neon"] } }

// webfinger_config - each key is a subject; a query for the key or any of its aliases returns it. Never inherits from default.
{ "resources": { "acct:wilson@wilsoon.dev": { "aliases": ["/"], "properties": { "http://schema.org/name": "Wilson Oon" }, "links": [{ "rel": "http://openid.net/specs/connect/1.0/issuer", "href": "https://id.wilsoon.dev" }] } } }
```

Values starting with `/` (sitemaps, security URLs, WebFinger aliases and link hrefs) resolve against the requesting host.

## WebFinger

`GET /.well-known/webfinger?resource=<uri>[&rel=<rel>...]` (RFC 7033) returns `application/jrd+json` with `Access-Control-Allow-Origin: *`. A missing or malformed `resource` returns 400, and an unknown one returns 404. `acct:` hosts and `http(s)` URLs are compared case-insensitively. When `rel` is given, only matching `links` are returned.

The Cloudflare redirect for this path must keep the query string, e.g. `wilsoon.dev/.well-known/webfinger?resource=...` ??? `web-meta.wilsoon.dev/.well-known/webfinger?origin=wilsoon.dev&resource=...`. The cache key must include the query string, which is Cloudflare's default.

## Deploying

Run `schema.sql` against your Postgres database to create `web_meta.sites` and the `default` fallback row.

Both hosts call the same `src/handler.js`; set `DATABASE_URL` on whichever one you use, and point the proxied `web-meta.wilsoon.dev` DNS record at it.

- **Netlify:** `netlify/functions/meta.mjs` claims the five paths; `netlify.toml` publishes only `public/`, whose static `index.html` is the landing page at `/`. It sets `region = "sin"` to sit next to the database; change it to match yours.
- **Vercel:** `api/meta.js`, with `vercel.json` pinning it to `sin1` and rewriting the file paths to it.

Either way the host's CDN is set to `no-store` for caching, so Cloudflare is the only cache a purge has to clear.
