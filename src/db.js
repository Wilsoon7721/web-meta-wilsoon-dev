/**
 * Executes a parameterized SQL query using Neon's HTTP SQL endpoint (`/sql`)
 *
 * @param {string} query SQL string with $1, $2, ... placeholders
 * @param {Array} [params=[]] Parameter values
 * @returns {Promise<{ fields: Array, rows: Array, command: string, rowCount: number }>}
 */
export async function queryNeonDb(query, params = []) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error("DATABASE_URL is not set");

  const { hostname } = new URL(connStr);
  const res = await fetch(`https://${hostname}/sql`, {
    method: "POST",
    headers: {
      "Neon-Connection-String": connStr,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, params }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.message || `Neon SQL request failed (${res.status})`);
    if (payload.code) err.code = payload.code;

    throw err;
  }

  return payload;
}

/**
 * Fetches the row for `hostname` together with the `default` fallback
 *
 * @param {string} hostname
 * @returns {Promise<{ site: object | null, fallback: object | null }>}
 */
export async function fetchSiteRows(hostname) {
  const result = await queryNeonDb(`SELECT hostname, site_name, robots_config, security_config, humans_config, updated_at FROM web_meta.sites WHERE hostname = $1 OR hostname = 'default'`, [hostname]);

  return {
    site: result.rows.find((r) => r.hostname === hostname) || null,
    fallback: result.rows.find((r) => r.hostname === "default") || null,
  };
}
