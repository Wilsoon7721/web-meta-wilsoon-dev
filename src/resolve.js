export const FILES = {
  robots: { column: "robots_config", name: "robots.txt" },
  security: { column: "security_config", name: "security.txt" },
  humans: { column: "humans_config", name: "humans.txt" },
};

function isEmptyObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0;
}

/**
 * Resolution for one file of one host:
 * - host row missing - behave as if the host had `{}` everywhere
 * - host config is NULL - 404
 * - host config is `{}` - inherit the `default` row (whose NULL is also a 404)
 * - host config has keys - use
 *
 * @param {'robots' | 'security' | 'humans'} file
 * @param {{ site: object | null, fallback: object | null }} rows
 * @returns {{ config: object | null, source: 'site' | 'default', siteName: string, updatedAt: string | null }} `config` is null when the file should 404.
 */
export function resolveConfig(file, { site, fallback }) {
  const { column } = FILES[file];
  const siteName = site?.site_name || fallback?.site_name || "";

  const own = site ? site[column] : {};
  if (own === null || own === undefined) return { config: null, source: "site", siteName, updatedAt: site?.updated_at ?? null };

  if (!isEmptyObject(own)) return { config: own, source: "site", siteName, updatedAt: site.updated_at ?? null };

  const inherited = fallback ? fallback[column] : null;
  return { config: inherited ?? null, source: "default", siteName, updatedAt: fallback?.updated_at ?? null };
}
