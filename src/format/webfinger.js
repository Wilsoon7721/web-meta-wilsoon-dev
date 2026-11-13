import { absolutize } from "./shared.js";

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Canonical form used to compare a queried `resource` with configured keys and aliases (RFC 7033 4.1, RFC 7565).
 * - `acct:user@host` - scheme and host lowercased, userpart kept as-is (split on the last `@`)
 * - `http(s):` - WHATWG URL serialization, so `https://Wilsoon.dev` equals `https://wilsoon.dev/`
 * - any other scheme - scheme lowercased
 *
 * @param {unknown} value
 * @returns {string | null} null when the value is not a usable URI
 */
export function normalizeResource(value) {
  const raw = String(value ?? "").trim();
  if (!SCHEME.test(raw) || /\s/.test(raw)) return null;

  const colon = raw.indexOf(":");
  const scheme = raw.slice(0, colon).toLowerCase();
  const rest = raw.slice(colon + 1);

  if (scheme === "acct") {
    const at = rest.lastIndexOf("@");
    const host = rest.slice(at + 1).toLowerCase();
    if (at <= 0 || !host) return null;

    return `acct:${rest.slice(0, at)}@${host}`;
  }

  if (scheme === "http" || scheme === "https") {
    try {
      return new URL(raw).href;
    } catch {
      return null;
    }
  }

  return rest ? `${scheme}:${rest}` : null;
}

/**
 * Finds the entry whose key or `aliases` match `resource`. The key is the entry's `subject`.
 *
 * @param {{ resources?: Record<string, object> } | null} config
 * @param {string} resource already normalized
 * @param {string} host requesting host, for site-relative aliases
 * @returns {{ subject: string, entry: object } | null}
 */
export function findWebfingerEntry(config, resource, host) {
  const resources = config?.resources;
  if (!resources || typeof resources !== "object") return null;

  for (const [subject, entry] of Object.entries(resources)) {
    const names = [subject, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])];
    if (names.some((name) => normalizeResource(absolutize(String(name), host)) === resource)) return { subject, entry: entry ?? {} };
  }

  return null;
}

/**
 * Builds the JRD (RFC 7033 4.4). Links are filtered to the requested `rel` values when any are given.
 * Subject, aliases and properties are always returned. Site-relative alias and link hrefs resolve against `host`.
 *
 * @param {{ subject: string, entry: object }} match
 * @param {{ host: string, rels?: string[] }} ctx
 * @returns {string}
 */
export function formatWebfinger({ subject, entry }, { host, rels = [] }) {
  const jrd = { subject };

  if (Array.isArray(entry.aliases) && entry.aliases.length) jrd.aliases = entry.aliases.map((a) => absolutize(String(a), host));
  if (entry.properties && typeof entry.properties === "object") jrd.properties = entry.properties;

  const links = (Array.isArray(entry.links) ? entry.links : []).filter((l) => l && typeof l.rel === "string" && (!rels.length || rels.includes(l.rel)));
  jrd.links = links.map((l) => (typeof l.href === "string" ? { ...l, href: absolutize(l.href, host) } : l));

  return JSON.stringify(jrd);
}
