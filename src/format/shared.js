export function toList(value) {
  if (value === null || value === undefined) return [];

  return (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean);
}

/** Turns a site-relative value like `/sitemap.xml` into `https://<host>/sitemap.xml`. Absolute values pass through. */
export function absolutize(value, host) {
  return value.startsWith("/") && !value.startsWith("//") ? `https://${host}${value}` : value;
}
