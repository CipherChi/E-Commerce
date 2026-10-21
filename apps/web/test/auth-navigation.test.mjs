import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMobileNavigationLinks,
  getNavigationLinks,
  safeReturnPath,
} from '../src/lib/auth-navigation.mjs';

test('safeReturnPath accepts only same-origin single-slash paths', () => {
  assert.equal(safeReturnPath('/sales?filter=today#recent'), '/sales?filter=today#recent');
  let deeplyEncodedProtocolRelative = '//evil.example/path';
  for (let i = 0; i < 10; i += 1) {
    deeplyEncodedProtocolRelative = encodeURIComponent(deeplyEncodedProtocolRelative);
  }

  for (const input of [
    '//evil.example/path',
    '///evil.example/path',
    'https://evil.example/path',
    'http:evil.example',
    'javascript:alert(1)',
    '\\\\evil.example',
    '/\\\\evil.example',
    '/%2f%2fevil.example',
    '/%255c%255cevil.example',
    `/${deeplyEncodedProtocolRelative}`,
    '/%6a%61vascript%3Aalert(1)',
    'relative/path',
  ]) {
    assert.equal(safeReturnPath(input), '/dashboard', `expected rejection for ${input}`);
  }
});

test('sidebar and mobile links share member-role and enabled-module filtering', () => {
  const ownerLinks = getNavigationLinks('OWNER', ['FOOD']);
  assert(ownerLinks.some(([, href]) => href === '/inventory'));
  assert(!ownerLinks.some(([, href]) => href === '/properties'));
  assert(ownerLinks.some(([, href]) => href === '/expenses'));

  const staffLinks = getNavigationLinks('STAFF', ['FOOD']);
  const staffHrefs = staffLinks.map(([, href]) => href);
  assert.deepEqual(staffHrefs, ['/dashboard', '/sales/new', '/sales', '/receipts', '/customers']);
  const staffMobileHrefs = getMobileNavigationLinks('STAFF', ['FOOD']).map(([href]) => href);
  assert.deepEqual(staffMobileHrefs, [
    '/dashboard',
    '/sales/new',
    '/sales',
    '/receipts',
    '/customers',
  ]);
  assert(!staffMobileHrefs.includes('/expenses'));
  assert(!staffMobileHrefs.includes('/inventory'));

  assert(getNavigationLinks('MANAGER', ['LODGING']).some(([, href]) => href === '/bookings'));
  assert(!getNavigationLinks('MANAGER', []).some(([, href]) => href === '/bookings'));
});
