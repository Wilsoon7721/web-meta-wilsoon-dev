import { absolutize, toList } from "./shared.js";

/**
 * Follows RFC 9309 robots.txt
 * Config shape:
 * {
 *   "groups": [{ "user_agents": ["*"], "allow": ["/"], "disallow": ["/api/"], "crawl_delay": 10 }],
 *   "sitemaps": ["/sitemap.xml"]   // relative paths resolve against the requesting host
 * }
 */
export function formatRobots(config, { host, siteName }) {
  const lines = [`# Host: ${host}`];
  if (siteName) lines.push(`# App Name: ${siteName}`);

  for (const group of Array.isArray(config.groups) ? config.groups : []) {
    const agents = toList(group.user_agents ?? group.user_agent);
    if (!agents.length) continue;

    lines.push("");
    for (const agent of agents) lines.push(`User-agent: ${agent}`);
    for (const path of toList(group.allow)) lines.push(`Allow: ${path}`);
    for (const path of toList(group.disallow)) lines.push(`Disallow: ${path}`);
    if (group.crawl_delay !== undefined && group.crawl_delay !== null) lines.push(`Crawl-delay: ${group.crawl_delay}`);
  }

  const sitemaps = toList(config.sitemaps ?? config.sitemap);
  if (sitemaps.length) {
    lines.push("");
    for (const sitemap of sitemaps) lines.push(`Sitemap: ${absolutize(sitemap, host)}`);
  }

  return lines.join("\n") + "\n";
}
