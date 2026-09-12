import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNearbyDirectionsUrl, openNearbyDirections } from '../../src/ui/nearbyDirections';
test('handoff browser cancel/dismiss is neutral, not a failed or verified route', async () => {
  for (const type of ['cancel', 'dismiss']) assert.equal(await openNearbyDirections({ title: 'fixture', lat: 35, lon: 129 }, {
    openExternal: async () => { throw Error('fixture reject'); }, openBrowser: async () => ({ type }),
  }), 'cancelled');
  assert.equal(await openNearbyDirections({ title: 'fixture', lat: 35, lon: 129 }, { openExternal: async () => { throw Error(); }, openBrowser: async () => ({ type: 'locked' }) }), 'unconfirmed');
});
test('nearby destination-only URL never injects a browsing origin and encodes the name', async () => {
  const place = { title: '시장 / A&B', lat: 35.1, lon: 129.1 };
  const url = buildNearbyDirectionsUrl(place)!;
  assert.equal(url, `https://map.kakao.com/link/to/${encodeURIComponent(place.title)},35.1,129.1`);
  for (const invalid of [{ ...place, lat: NaN }, { ...place, lon: 181 }, { ...place, title: '' }]) assert.equal(buildNearbyDirectionsUrl(invalid), null);
  const calls: string[] = [];
  assert.equal(await openNearbyDirections(place, { openExternal: async u => { calls.push(u); }, openBrowser: async () => { throw Error('not expected'); } }), 'opened');
  assert.deepEqual(calls, [url]);
  assert.equal(await openNearbyDirections(place, { openExternal: async () => { throw Error('unavailable'); }, openBrowser: async u => { calls.push(u); return { type: 'opened' }; } }), 'opened');
  assert.equal(calls[1], url);
  assert.equal(await openNearbyDirections(place, { openExternal: async () => { throw Error(); }, openBrowser: async () => { throw Error(); } }), 'failed');
});
