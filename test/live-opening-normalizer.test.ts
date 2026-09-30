import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditStoredRepresentativeTourOpenings,
  normalizeTourLiveOpening,
} from '../src/data/liveOpeningNormalizer';

const normalize = (rawText?: string, patch: Partial<Parameters<typeof normalizeTourLiveOpening>[0]> = {}) => normalizeTourLiveOpening({
  placeId: 'poi_1',
  sourceId: '127004',
  contentTypeId: '12',
  referenceDate: '2026-09-21',
  opening: { ...(rawText !== undefined ? { rawText } : {}) },
  ...patch,
});

test('RED fixture: stored representative TourAPI opening audit stays 76 exact reuse / 6 safe parse / 16 review', () => {
  const audit = auditStoredRepresentativeTourOpenings('2026-09-21');
  assert.deepEqual(audit.summary, {
    representativeTourLinked: 98,
    exactReviewedReuse: 76,
    safeRuntimeParse: 6,
    needsReview: 16,
    eventExcluded: 0,
  });
  assert.equal(audit.rows.length, 98);
  assert.ok(audit.rows.every((row) => !('rawText' in row) && !('sourceText' in row)));
});

test('RED fixture: explicit always-open expressions and one clear daily range become StructuredAvailability', () => {
  for (const rawText of ['24시간', '상시', '상시 개방', '연중무휴']) {
    const result = normalize(rawText);
    assert.equal(result.status, 'structured');
    if (result.status !== 'structured') continue;
    assert.deepEqual(result.availability, { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] });
  }
  const daily = normalize('매일 09:30~18:00');
  assert.equal(daily.status, 'structured');
  if (daily.status === 'structured') assert.deepEqual(daily.availability, { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 570, endMin: 1080 }] });
});

test('RED fixture: representable weekday/weekend ranges and daily overnight ranges parse conservatively', () => {
  const weekday = normalize('월요일~금요일 09:00~18:00');
  assert.equal(weekday.status, 'structured');
  if (weekday.status === 'structured') assert.deepEqual(weekday.availability.dayTypes, ['weekday']);
  const weekend = normalize('주말 10:00-17:30');
  assert.equal(weekend.status, 'structured');
  if (weekend.status === 'structured') assert.deepEqual(weekend.availability.dayTypes, ['weekend']);
  const overnight = normalize('매일 22:00~02:00');
  assert.equal(overnight.status, 'structured');
  if (overnight.status === 'structured') assert.deepEqual(overnight.availability.windows, [{ startMin: 0, endMin: 120 }, { startMin: 1320, endMin: 1440 }]);
});

test('RED fixture: conditional, inquiry, multiple ranges, closures and unrepresentable day exceptions fail closed', () => {
  const cases = [
    ['점포별 상이', undefined],
    ['09:00~18:00 문의', undefined],
    ['09:00~18:00 홈페이지 참조', undefined],
    ['행사별 상이', undefined],
    ['프로그램별 운영', undefined],
    ['09:00~18:00 / 성수기 10:00~20:00', undefined],
    ['화요일~일요일 09:00~18:00', undefined],
    ['평일 22:00~02:00', undefined],
    ['09:00~18:00', '매주 월요일 휴무'],
    ['09:00~18:00', '임시휴무 가능'],
  ] as const;
  for (const [rawText, closedText] of cases) {
    const result = normalize(rawText, { opening: { rawText, ...(closedText ? { closedText } : {}) } });
    assert.equal(result.status, 'needs_review', `${rawText} / ${closedText ?? ''}`);
    if (result.status === 'needs_review') assert.equal(result.availability.status, 'needs_review');
  }
  assert.equal(normalize().status, 'needs_review');
});

test('RED fixture: HTML breaks normalize, but raw text is never returned or persisted in the result', () => {
  const result = normalize('매일<br/>09:00~18:00');
  assert.equal(result.status, 'structured');
  assert.doesNotMatch(JSON.stringify(result), /매일|09:00|sourceText/);
  if (result.status === 'structured') {
    assert.equal(result.provenance.mode, 'live_runtime_parse');
    assert.deepEqual(result.provenance.fields, ['rawText']);
  }
});

test('RED fixture: exact reviewed source text and source ID reuse reviewed windows only without added live constraints', () => {
  const reused = normalize('상시 개방');
  assert.equal(reused.status, 'structured');
  if (reused.status === 'structured') assert.equal(reused.provenance.mode, 'reviewed_exact_reuse');

  const changed = normalize('매일 09:00~18:00');
  assert.equal(changed.status, 'structured');
  if (changed.status === 'structured') assert.equal(changed.provenance.mode, 'live_runtime_parse');

  const wrongSource = normalize('상시 개방', { sourceId: 'different-source' });
  assert.equal(wrongSource.status, 'needs_review');
  if (wrongSource.status === 'needs_review') assert.equal(wrongSource.reason, 'source_mapping_mismatch');
  const wrongType = normalize('상시 개방', { contentTypeId: '14' });
  assert.equal(wrongType.status, 'needs_review');
  if (wrongType.status === 'needs_review') assert.equal(wrongType.reason, 'source_mapping_mismatch');

  const addedClosure = normalize('상시 개방', { opening: { rawText: '상시 개방', closedText: '매주 월요일 휴무' } });
  assert.equal(addedClosure.status, 'needs_review');
  if (addedClosure.status === 'needs_review') {
    assert.equal(addedClosure.reason, 'closed_text_requires_review');
    assert.notEqual(addedClosure.provenance.mode, 'reviewed_exact_reuse');
  }
});

test('RED fixture: event period returns typed before/after exclusion and never synthesizes an hours window from dates', () => {
  const before = normalize('09:00~18:00', { referenceDate: '2026-09-20', opening: { rawText: '09:00~18:00', eventStartDate: '20260921', eventEndDate: '20260930' } });
  assert.deepEqual(before, {
    status: 'event_excluded',
    reason: 'event_not_started',
    provenance: { source: 'tourapi_detailIntro2_live', sourceId: '127004', mode: 'event_period_gate', parserVersion: 1, fields: ['eventEndDate', 'eventStartDate', 'rawText'] },
  });
  const after = normalize('09:00~18:00', { referenceDate: '2026-10-01', opening: { rawText: '09:00~18:00', eventStartDate: '20260921', eventEndDate: '20260930' } });
  assert.equal(after.status, 'event_excluded');
  if (after.status === 'event_excluded') assert.equal(after.reason, 'event_ended');

  const during = normalize('09:00~18:00', { referenceDate: '2026-09-25', opening: { rawText: '09:00~18:00', eventStartDate: '20260921', eventEndDate: '20260930' } });
  assert.equal(during.status, 'structured');
  if (during.status === 'structured') {
    assert.equal(during.provenance.mode, 'live_runtime_parse');
    assert.deepEqual(during.availability.windows, [{ startMin: 540, endMin: 1080 }]);
  }
});

test('RED fixture: incomplete, invalid or reversed event periods require review', () => {
  for (const opening of [
    { rawText: '09:00~18:00', eventStartDate: '20260921' },
    { rawText: '09:00~18:00', eventStartDate: '2026-09-21', eventEndDate: '20260930' },
    { rawText: '09:00~18:00', eventStartDate: '20261001', eventEndDate: '20260930' },
  ]) {
    const result = normalizeTourLiveOpening({ placeId: 'poi_1', sourceId: '127004', contentTypeId: '12', referenceDate: '2026-09-25', opening });
    assert.equal(result.status, 'needs_review');
    if (result.status === 'needs_review') assert.equal(result.reason, 'invalid_event_period');
  }
});
