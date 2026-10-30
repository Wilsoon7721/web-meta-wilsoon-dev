import { fetchSiteRows } from "./db.js";
import { formatHumans } from "./format/humans.js";
import { formatRobots } from "./format/robots.js";
import { formatSecurity } from "./format/security.js";
import { FILES, resolveConfig } from "./resolve.js";

const FORMATTERS = { robots: formatRobots, security: formatSecurity, humans: formatHumans };

const PATH_TO_FILE = {
  "/robots.txt": "robots",
  "/humans.txt": "humans",
  "/security.txt": "security",
  "/.well-known/security.txt": "security",
};

const CACHEABLE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "Cloudflare-CDN-Cache-Control": "public, max-age=2592000",
  "Vercel-CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
};

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeOrigin(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.+$/, "");
}

export function isAllowedHost(host, allowedDomain = process.env.ALLOWED_DOMAIN || "wilsoon.dev") {
  if (!host || host.length > 253) return false;
  if (host !== allowedDomain && !host.endsWith(`.${allowedDomain}`)) return false;

  return host.split(".").every((label) => HOSTNAME_LABEL.test(label));
}

function text(body, status, headers = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", ...headers } });
}

/**
 * Handles GET/HEAD for robots.txt, security.txt and humans.txt.
 * The file comes from `?file=` (set by the vercel.json rewrites) or the request path.
 * The host comes from `?origin=` (set by the Cloudflare redirect) or the request's own host.
 *
 * @param {Request} request
 * @param {{ fetchRows?: typeof fetchSiteRows, now?: Date }} [deps]
 */
export async function handle(request, { fetchRows = fetchSiteRows, now = new Date() } = {}) {
  const url = new URL(request.url);
  const file = FILES[url.searchParams.get("file")] ? url.searchParams.get("file") : PATH_TO_FILE[url.pathname];
  if (!file) return text("Not Found\n", 404, CACHEABLE_HEADERS);

  const host = normalizeOrigin(url.searchParams.get("origin") || url.hostname);
  if (!isAllowedHost(host)) return text("Bad Request: origin is not a served host\n", 400, CACHEABLE_HEADERS);

  let rows;
  try {
    rows = await fetchRows(host);
  } catch (err) {
    console.error(`Failed to load web_meta.sites for ${host}:`, err);
    return text("Service Unavailable\n", 503, { "Cache-Control": "no-store", "Retry-After": "60" });
  }

  const { config, source, siteName, updatedAt } = resolveConfig(file, rows);
  const tags = ["wm", `wm-host-${host}`, ...(source === "default" ? ["wm-default"] : [])];
  const headers = { ...CACHEABLE_HEADERS, "Cache-Tag": tags.join(",") };

  if (!config) return text("Not Found\n", 404, headers);

  const body = FORMATTERS[file](config, { host, siteName, updatedAt, now });
  return text(request.method === "HEAD" ? null : body, 200, headers);
}
