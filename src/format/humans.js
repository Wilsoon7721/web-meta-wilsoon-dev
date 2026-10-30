const SECTION_ORDER = ["team", "thanks", "site"];

function formatValue(value) {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value);
}

function formatEntries(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => {
      const block = item !== null && typeof item === "object" ? formatEntries(item) : [`\t${item}`];
      return i > 0 && item !== null && typeof item === "object" ? ["", ...block] : block;
    });
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `\t${k}: ${formatValue(v)}`);
  }

  return [`\t${value}`];
}

function formatDate(updatedAt) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10).replaceAll("-", "/");
}

/**
 * Config shape:
 * {
 *   "team": [{ "Name": "Wilson Oon", "Site": "https://wilsoon.dev" }],
 *   "thanks": ["Someone"],
 *   "site": { "Standards": "HTML5, CSS3", "Software": ["Next.js", "Neon"] }
 * }
 * `site` gets a "Last update" from the row's updated_at unless the config sets one.
 */
export function formatHumans(config, { host, siteName, updatedAt }) {
  const sections = { ...config };
  const lastUpdate = updatedAt ? formatDate(updatedAt) : null;
  if (lastUpdate && !(sections.site && typeof sections.site === "object" && "Last update" in sections.site)) {
    sections.site = { ...(typeof sections.site === "object" && !Array.isArray(sections.site) ? sections.site : {}), "Last update": lastUpdate };
  }

  const lines = [`/* Host: ${host} */`];
  if (siteName) lines.push(`/* App Name: ${siteName} */`);

  const keys = [...SECTION_ORDER.filter((k) => k in sections), ...Object.keys(sections).filter((k) => !SECTION_ORDER.includes(k))];
  for (const key of keys) {
    const body = formatEntries(sections[key]);
    if (!body.length) continue;

    lines.push("", `/* ${key.toUpperCase()} */`, ...body);
  }

  return lines.join("\n") + "\n";
}
