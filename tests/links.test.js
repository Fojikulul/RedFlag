import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkLinks, inspectUrl } from '../js/engine/links.js';

function issuesOf(url) {
  return inspectUrl(url).issues;
}

test('finds links with and without a scheme', () => {
  const { links } = checkLinks('Go to https://example.com/a, www.test.org or paypal-help.top/login.');
  assert.deepEqual(links.map((link) => link.url), [
    'https://example.com/a',
    'www.test.org',
    'paypal-help.top/login',
  ]);
});

test('does not treat email addresses as links', () => {
  assert.deepEqual(checkLinks('Write to anna@gmail.com').links, []);
});

test('reports offsets into the original text', () => {
  const text = 'Tap bit.ly/abc now';
  const [link] = checkLinks(text).links;
  assert.equal(text.slice(link.start, link.end), 'bit.ly/abc');
});

test('flags URL shorteners', () => {
  assert.ok(issuesOf('https://bit.ly/3xYz').includes('shortener'));
  assert.ok(issuesOf('tinyurl.com/abc').includes('shortener'));
});

test('flags raw IP addresses', () => {
  assert.ok(issuesOf('http://192.168.4.20/login').includes('ip_address'));
});

test('flags plain http', () => {
  assert.ok(issuesOf('http://example.com').includes('no_https'));
  assert.ok(!issuesOf('https://example.com').includes('no_https'));
});

test('flags punycode domains', () => {
  assert.ok(issuesOf('https://xn--pypal-4ve.com').includes('punycode'));
});

test('flags risky top-level domains', () => {
  assert.ok(issuesOf('https://usps-redelivery.click/track').includes('risky_tld'));
});

test('flags brand look-alikes, including swapped digits', () => {
  assert.ok(issuesOf('https://paypa1.com').includes('lookalike_domain'));
  assert.ok(issuesOf('https://amaz0n-security.com').includes('lookalike_domain'));
  assert.ok(issuesOf('https://secure-chase-login.com').includes('lookalike_domain'));
  assert.ok(issuesOf('https://ups-delivery.net').includes('lookalike_domain'));
});

test('trusts the real brand domains', () => {
  assert.deepEqual(issuesOf('https://www.paypal.com/signin'), []);
  assert.deepEqual(issuesOf('https://smile.amazon.com'), []);
  assert.deepEqual(issuesOf('https://www.privatbank.ua'), []);
});

test('does not mistake ordinary words for short brand names', () => {
  assert.ok(!issuesOf('https://groups.example.com').includes('lookalike_domain'));
});

test('flags the @ trick', () => {
  const { domain, issues } = inspectUrl('http://paypal.com@evil.example.com/x');
  assert.equal(domain, 'example.com');
  assert.ok(issues.includes('at_sign'));
});

test('flags deep subdomain chains', () => {
  assert.ok(issuesOf('https://login.secure.account.verify.example.com').includes('deep_subdomains'));
});
