import assert from 'node:assert/strict';
import test from 'node:test';
import { datedMinuteLabel, recommendationDeadlineLabel, remainingSetupMinutes, resolveArrivalMinute, setupDeadlineIso } from '../../src/ui/timeSetup/datedSetupTime';
import { buildRecommendationEngineInput, buildRecommendationLimitedInput } from '../../src/ui/recommendation/v1Session';

test('URELEASEUICLEANUP: infer midnight only in the valid 180-minute window, never arbitrary past times', () => {
  assert.equal(resolveArrivalMinute(1439, 179), 1619);
  assert.equal(resolveArrivalMinute(1439, 180), 180); // tomorrow would be 181 minutes: keep invalid past input
  assert.equal(resolveArrivalMinute(1439, 1439), 1439);
  assert.equal(resolveArrivalMinute(720, 660), 660);
  assert.equal(resolveArrivalMinute(720, 900), 900);
  assert.equal(resolveArrivalMinute(720, 901), 901); // validation rejects 181, no silent clamp
});

test('URELEASE180 dated clock: 23:59, month/year rollover, expiration and fractional minute are not modulo-day', () => {
  for (const base of [new Date(2026, 8, 8, 23, 59), new Date(2026, 11, 31, 23, 59)]) {
    const deadline = setupDeadlineIso(base, 1439 + 180);
    assert.equal(remainingSetupMinutes(deadline, base.toISOString()), 180);
    assert.equal(Date.parse(deadline) - base.getTime(), 180 * 60000);
    assert.equal(remainingSetupMinutes(deadline, new Date(base.getTime() + 181 * 60000).toISOString()), -1);
    assert.equal(remainingSetupMinutes(deadline, new Date(base.getTime() + 1000).toISOString()), 179);
  }
  assert.equal(datedMinuteLabel(1439), '23:59');
  assert.equal(datedMinuteLabel(1619), '내일 2:59');
  assert.equal(recommendationDeadlineLabel({ nowIso: new Date(2026, 11, 31, 23, 59).toISOString(), remainingMin: 180 }), '1/1 2:59 (익일)');
});

test('URELEASE180 direct session permits 120/180, rejects 181 before personalization/auth/route ports', async () => {
  const session = { nowIso: '2026-09-08T14:59:00.000Z', remainingMin: 180, arrivalBufferMin: 10, origin: { id: 'o', label: 'fixture', lat: 35.1, lon: 129.1 }, destination: null };
  for (const remainingMin of [120, 180]) assert.equal(buildRecommendationEngineInput({ ...session, remainingMin }).remainingMin, remainingMin);
  let reads = 0;
  await assert.rejects(buildRecommendationLimitedInput({ ...session, remainingMin: 181 }, { routeProxyEnabled: false }, { readPersonalizationSnapshot: async () => { reads++; throw Error('must not run'); } } as never), RangeError);
  assert.equal(reads, 0);
});
