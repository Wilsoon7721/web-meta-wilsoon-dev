import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle, isAllowedHost, normalizeOrigin } from '../src/handler.js';

// Mirrors the two rows currently in web_meta.sites.
const DEFAULT_ROW = {
  hostname: 'default',
  site_name: 'Wilsoon Ecosystem',
  robots_config: { groups: [{ allow: ['/'], disallow: ['/api/', '/admin'], user_agents: ['*'] }] },
  security_config: { contact: ['mailto:hello@wilsoon.dev'] },
  humans_config: { site: { Host: 'https://wilsoon.dev' }, team: [{ Name: 'Wilson Oon' }] },
  updated_at: '2026-10-29T18:11:09.806332+00:00'
};
const TEST_ROW = {
  hostname: 'test.wilsoon.dev',
  site_name: 'Wilsoon API',
  robots_config: { groups: [{ disallow: ['/'], user_agents: ['*'] }] },
  security_config: null,
  humans_config: {},
  updated_at: '2026-10-29T18:11:09.82252+00:00'
};

const NOW = new Date('2026-10-31T12:34:56Z');

function fakeRows(host) {
  return Promise.resolve({ site: [TEST_ROW].find((r) => r.hostname === host) || null, fallback: DEFAULT_ROW });
}

async function get(url, deps = {}) {
  const res = await handle(new Request(url), { fetchRows: fakeRows, now: NOW, ...deps });
  return { res, body: await res.text() };
}

test('custom robots config is used as-is', async () => {
  const { res, body } = await get('https://web-meta.wilsoon.dev/robots.txt?origin=test.wilsoon.dev');
  assert.equal(res.status, 200);
  assert.equal(body, '# Host: test.wilsoon.dev\n# App Name: Wilsoon API\n\nUser-agent: *\nDisallow: /\n');
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-test.wilsoon.dev');
});

test('unknown host inherits every default, with the default site name', async () => {
  const { res, body } = await get('https://web-meta.wilsoon.dev/robots.txt?origin=tools.wilsoon.dev');
  assert.equal(res.status, 200);
  assert.equal(body, '# Host: tools.wilsoon.dev\n# App Name: Wilsoon Ecosystem\n\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\n');
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-tools.wilsoon.dev,wm-default');
});

test('NULL config returns a cacheable, tagged 404', async () => {
  const { res } = await get('https://web-meta.wilsoon.dev/.well-known/security.txt?origin=test.wilsoon.dev');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-test.wilsoon.dev');
  assert.match(res.headers.get('Cloudflare-CDN-Cache-Control'), /max-age=2592000/);
});

test('empty config inherits default humans.txt', async () => {
  const { res, body } = await get('https://web-meta.wilsoon.dev/humans.txt?origin=test.wilsoon.dev');
  assert.equal(res.status, 200);
  assert.equal(body, '/* Host: test.wilsoon.dev */\n/* App Name: Wilsoon API */\n\n/* TEAM */\n\tName: Wilson Oon\n\n/* SITE */\n\tHost: https://wilsoon.dev\n\tLast update: 2026/10/29\n');
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-test.wilsoon.dev,wm-default');
});

test('security.txt gets computed Expires and a per-host Canonical', async () => {
  const { res, body } = await get('https://web-meta.wilsoon.dev/security.txt?origin=tools.wilsoon.dev');
  assert.equal(res.status, 200);
  assert.equal(
    body,
    '# Host: tools.wilsoon.dev\n# App Name: Wilsoon Ecosystem\n\nContact: mailto:hello@wilsoon.dev\nExpires: 2027-04-29T00:00:00.000Z\nCanonical: https://tools.wilsoon.dev/.well-known/security.txt\n'
  );
});

test('default row NULL makes inheriting hosts 404', async () => {
  const fetchRows = () => Promise.resolve({ site: null, fallback: { ...DEFAULT_ROW, humans_config: null } });
  const { res } = await get('https://web-meta.wilsoon.dev/humans.txt?origin=tools.wilsoon.dev', { fetchRows });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-tools.wilsoon.dev,wm-default');
});

test('file can come from the rewrite query param', async () => {
  const { res } = await get('https://web-meta.wilsoon.dev/api/meta?file=robots&origin=test.wilsoon.dev');
  assert.equal(res.status, 200);
});

test('without ?origin= the request host is used', async () => {
  const { body } = await get('https://web-meta.wilsoon.dev/robots.txt');
  assert.match(body, /^# Host: web-meta\.wilsoon\.dev\n/);
});

test('foreign or malformed origins are rejected', async () => {
  for (const origin of ['evil.com', 'wilsoon.dev.evil.com', 'notwilsoon.dev', 'a..wilsoon.dev', '-x.wilsoon.dev']) {
    const { res } = await get(`https://web-meta.wilsoon.dev/robots.txt?origin=${encodeURIComponent(origin)}`);
    assert.equal(res.status, 400, origin);
  }
});

test('database failure is a non-cacheable 503', async () => {
  const { res } = await get('https://web-meta.wilsoon.dev/robots.txt?origin=test.wilsoon.dev', { fetchRows: () => Promise.reject(new Error('down')) });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('HEAD has headers but no body', async () => {
  const res = await handle(new Request('https://web-meta.wilsoon.dev/robots.txt?origin=test.wilsoon.dev', { method: 'HEAD' }), { fetchRows: fakeRows, now: NOW });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
});

test('origin normalization matches the dashboard', () => {
  assert.equal(normalizeOrigin('HTTPS://Tools.Wilsoon.dev:443/x'), 'tools.wilsoon.dev');
  assert.equal(normalizeOrigin('tools.wilsoon.dev.'), 'tools.wilsoon.dev');
  assert.ok(isAllowedHost('wilsoon.dev'));
  assert.ok(!isAllowedHost('default'));
});
