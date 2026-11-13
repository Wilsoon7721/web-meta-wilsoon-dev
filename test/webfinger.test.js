import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeResource } from '../src/format/webfinger.js';
import { handle } from '../src/handler.js';

const APEX_ROW = {
  hostname: 'wilsoon.dev',
  site_name: 'Wilsoon',
  webfinger_config: {
    resources: {
      'acct:wilson@wilsoon.dev': {
        aliases: ['/'],
        properties: { 'http://schema.org/name': 'Wilson Oon' },
        links: [
          { rel: 'http://webfinger.net/rel/profile-page', type: 'text/html', href: '/' },
          { rel: 'http://openid.net/specs/connect/1.0/issuer', href: 'https://id.wilsoon.dev' }
        ]
      }
    }
  },
  updated_at: '2026-11-14T00:00:00Z'
};
const DEFAULT_ROW = { hostname: 'default', site_name: 'Wilsoon Ecosystem', webfinger_config: { resources: { 'acct:x@wilsoon.dev': {} } } };

function fakeRows(host) {
  return Promise.resolve({ site: [APEX_ROW].find((r) => r.hostname === host) || null, fallback: DEFAULT_ROW });
}

async function get(path, deps = {}) {
  const res = await handle(new Request(`https://web-meta.wilsoon.dev${path}`), { fetchRows: fakeRows, ...deps });
  return { res, body: await res.text() };
}

const ACCT = encodeURIComponent('acct:wilson@wilsoon.dev');

test('acct resource returns a JRD with CORS and cache tags', async () => {
  const { res, body } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${ACCT}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/jrd+json; charset=utf-8');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-wilsoon.dev');
  assert.deepEqual(JSON.parse(body), {
    subject: 'acct:wilson@wilsoon.dev',
    aliases: ['https://wilsoon.dev/'],
    properties: { 'http://schema.org/name': 'Wilson Oon' },
    links: [
      { rel: 'http://webfinger.net/rel/profile-page', type: 'text/html', href: 'https://wilsoon.dev/' },
      { rel: 'http://openid.net/specs/connect/1.0/issuer', href: 'https://id.wilsoon.dev' }
    ]
  });
});

test('rel filters links but keeps subject, aliases and properties', async () => {
  const rel = encodeURIComponent('http://openid.net/specs/connect/1.0/issuer');
  const { body } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${ACCT}&rel=${rel}`);
  const jrd = JSON.parse(body);
  assert.deepEqual(jrd.links, [{ rel: 'http://openid.net/specs/connect/1.0/issuer', href: 'https://id.wilsoon.dev' }]);
  assert.ok(jrd.aliases && jrd.properties);
});

test('an alias resolves to the canonical subject', async () => {
  const { res, body } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${encodeURIComponent('https://Wilsoon.dev')}`);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(body).subject, 'acct:wilson@wilsoon.dev');
});

test('acct host is case-insensitive', async () => {
  const { res } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${encodeURIComponent('acct:wilson@WILSOON.dev')}`);
  assert.equal(res.status, 200);
});

test('missing or malformed resource is a 400 before any database call', async () => {
  const fetchRows = () => assert.fail('should not query');
  for (const q of ['', '&resource=', '&resource=wilson%40wilsoon.dev', '&resource=acct%3Awilsoon.dev', '&resource=acct%3A%40wilsoon.dev']) {
    const { res } = await get(`/.well-known/webfinger?origin=wilsoon.dev${q}`, { fetchRows });
    assert.equal(res.status, 400, q);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  }
});

test('unknown resource is a tagged 404', async () => {
  const { res } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${encodeURIComponent('acct:nobody@wilsoon.dev')}`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('Cache-Tag'), 'wm,wm-host-wilsoon.dev');
});

test('webfinger never inherits the default row', async () => {
  const { res } = await get(`/.well-known/webfinger?origin=tools.wilsoon.dev&resource=${encodeURIComponent('acct:x@wilsoon.dev')}`);
  assert.equal(res.status, 404);
});

test('webfinger works through the vercel rewrite param', async () => {
  const { res } = await get(`/api/meta?file=webfinger&origin=wilsoon.dev&resource=${ACCT}`);
  assert.equal(res.status, 200);
});

test('database failure is a non-cacheable 503', async () => {
  const { res } = await get(`/.well-known/webfinger?origin=wilsoon.dev&resource=${ACCT}`, { fetchRows: () => Promise.reject(new Error('down')) });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('HEAD has headers but no body', async () => {
  const res = await handle(new Request(`https://web-meta.wilsoon.dev/.well-known/webfinger?origin=wilsoon.dev&resource=${ACCT}`, { method: 'HEAD' }), { fetchRows: fakeRows });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
});

test('resource normalization', () => {
  assert.equal(normalizeResource('ACCT:Wilson@Wilsoon.DEV'), 'acct:Wilson@wilsoon.dev');
  assert.equal(normalizeResource('acct:a%40b@wilsoon.dev'), 'acct:a%40b@wilsoon.dev');
  assert.equal(normalizeResource('https://wilsoon.dev'), 'https://wilsoon.dev/');
  assert.equal(normalizeResource('mailto:hello@wilsoon.dev'), 'mailto:hello@wilsoon.dev');
  assert.equal(normalizeResource('not a uri'), null);
});
