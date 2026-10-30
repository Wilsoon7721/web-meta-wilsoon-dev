import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHumans } from '../src/format/humans.js';
import { formatRobots } from '../src/format/robots.js';
import { computeExpires, formatSecurity } from '../src/format/security.js';

const ctx = { host: 'tools.wilsoon.dev', siteName: 'Wilsoon Tools', updatedAt: null, now: new Date('2026-10-31T23:59:59Z') };

test('robots: multiple groups, crawl delay and relative sitemaps', () => {
  const body = formatRobots(
    {
      groups: [
        { user_agents: ['GPTBot', 'CCBot'], disallow: ['/'] },
        { user_agents: '*', allow: '/', crawl_delay: 5 }
      ],
      sitemaps: ['/sitemap.xml', 'https://cdn.wilsoon.dev/other.xml']
    },
    ctx
  );

  assert.equal(
    body,
    [
      '# Host: tools.wilsoon.dev',
      '# App Name: Wilsoon Tools',
      '',
      'User-agent: GPTBot',
      'User-agent: CCBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Allow: /',
      'Crawl-delay: 5',
      '',
      'Sitemap: https://tools.wilsoon.dev/sitemap.xml',
      'Sitemap: https://cdn.wilsoon.dev/other.xml',
      ''
    ].join('\n')
  );
});

test('robots: groups without user agents are skipped', () => {
  assert.equal(formatRobots({ groups: [{ disallow: ['/'] }] }, ctx), '# Host: tools.wilsoon.dev\n# App Name: Wilsoon Tools\n');
});

test('security: field order, ignored expires, explicit canonical, extension fields', () => {
  const body = formatSecurity(
    {
      policy: '/security-policy',
      contact: ['mailto:a@wilsoon.dev', 'https://wilsoon.dev/contact'],
      expires: '1999-01-01T00:00:00Z',
      preferred_languages: ['en', 'ms'],
      canonical: 'https://wilsoon.dev/.well-known/security.txt',
      bug_bounty: 'none'
    },
    ctx
  );

  assert.equal(
    body,
    [
      '# Host: tools.wilsoon.dev',
      '# App Name: Wilsoon Tools',
      '',
      'Contact: mailto:a@wilsoon.dev',
      'Contact: https://wilsoon.dev/contact',
      'Expires: 2027-04-29T00:00:00.000Z',
      'Preferred-Languages: en, ms',
      'Canonical: https://wilsoon.dev/.well-known/security.txt',
      'Policy: https://tools.wilsoon.dev/security-policy',
      'Bug-Bounty: none',
      ''
    ].join('\n')
  );
});

test('security: Expires is stable within a UTC day and under a year out', () => {
  assert.equal(computeExpires(new Date('2026-10-31T00:00:01Z')), computeExpires(new Date('2026-10-31T23:59:59Z')));
  assert.ok(new Date(computeExpires(new Date('2026-10-31T00:00:00Z'))) < new Date('2027-10-31T00:00:00Z'));
});

test('humans: arbitrary sections, string lists, explicit Last update kept', () => {
  const body = formatHumans(
    {
      colophon: 'Built in Singapore',
      thanks: ['Neon', 'Vercel'],
      site: { 'Last update': '2020/01/01', Software: ['Next.js', 'Neon'] },
      team: [
        { Name: 'Wilson Oon', Location: 'Singapore' },
        { Name: 'Someone', Site: '' }
      ]
    },
    { ...ctx, updatedAt: '2026-10-29T18:11:09Z' }
  );

  assert.equal(
    body,
    [
      '/* Host: tools.wilsoon.dev */',
      '/* App Name: Wilsoon Tools */',
      '',
      '/* TEAM */',
      '\tName: Wilson Oon',
      '\tLocation: Singapore',
      '',
      '\tName: Someone',
      '',
      '/* THANKS */',
      '\tNeon',
      '\tVercel',
      '',
      '/* SITE */',
      '\tLast update: 2020/01/01',
      '\tSoftware: Next.js, Neon',
      '',
      '/* COLOPHON */',
      '\tBuilt in Singapore',
      ''
    ].join('\n')
  );
});

test('robots and security: comments print under the header, blank entries as a bare #', () => {
  assert.equal(formatRobots({ comments: 'Line one\nLine two', groups: [{ user_agents: '*', allow: '/' }] }, ctx), '# Host: tools.wilsoon.dev\n# App Name: Wilsoon Tools\n\n# Line one\n# Line two\n\nUser-agent: *\nAllow: /\n');
  assert.equal(
    formatSecurity({ comments: ['Hi', '', 'Policy'], contact: 'mailto:a@wilsoon.dev' }, ctx),
    '# Host: tools.wilsoon.dev\n# App Name: Wilsoon Tools\n\n# Hi\n#\n# Policy\n\nContact: mailto:a@wilsoon.dev\nExpires: 2027-04-29T00:00:00.000Z\nCanonical: https://tools.wilsoon.dev/.well-known/security.txt\n'
  );
});
