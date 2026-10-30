import { absolutize, commentLines, toList } from "./shared.js";

const KNOWN_FIELDS = [
  ["contact", "Contact"],
  ["encryption", "Encryption"],
  ["acknowledgments", "Acknowledgments"],
  ["preferred_languages", "Preferred-Languages"],
  ["canonical", "Canonical"],
  ["policy", "Policy"],
  ["hiring", "Hiring"],
  ["csaf", "CSAF"],
];

export const EXPIRES_IN_DAYS = 180;

function fieldName(key) {
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

export function computeExpires(now = new Date()) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return new Date(day + EXPIRES_IN_DAYS * 86_400_000).toISOString();
}

/**
 * Formats a flat security config into RFC 9116 security.txt
 */
export function formatSecurity(config, { host, siteName, now }) {
  const fields = { ...config, canonical: config.canonical ?? `/.well-known/security.txt` };
  delete fields.expires;
  delete fields.comments;

  const lines = [`# Host: ${host}`];
  if (siteName) lines.push(`# App Name: ${siteName}`);

  const comments = commentLines(config.comments);
  if (comments.length) lines.push("", ...comments);
  lines.push("");

  const emit = (key, label) => {
    const values = toList(fields[key]).map((v) => absolutize(v, host));
    if (!values.length) return;

    if (key === "preferred_languages") lines.push(`${label}: ${values.join(", ")}`);
    else for (const value of values) lines.push(`${label}: ${value}`);
  };

  emit("contact", "Contact");
  lines.push(`Expires: ${computeExpires(now)}`);
  for (const [key, label] of KNOWN_FIELDS.slice(1)) emit(key, label);

  const known = new Set(KNOWN_FIELDS.map(([key]) => key));
  for (const key of Object.keys(fields)) if (!known.has(key)) emit(key, fieldName(key));

  return lines.join("\n") + "\n";
}
