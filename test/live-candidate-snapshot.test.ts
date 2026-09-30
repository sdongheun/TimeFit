import assert from 'node:assert/strict';
import test from 'node:test';
import type { TourLiveSourceResult, TourLivePlace } from '../src/services/tourApiLiveAdapter';
import { buildLiveCandidateSnapshot, sourceDistanceMeters, type LocalLivePlaceProjection } from '../src/engine/liveCandidateSnapshot';

const local = (id = 'poi_a'): LocalLivePlaceProjection => ({
  id, order: 1, mapping: { status: 'exact', tourapiContentId: '100', contentTypeId: '12' },
  facts: { title: '기존 공원', address: '기존 주소', lat: 35.1, lon: 129.1, opening: { rawText: '기존 시간', closedText: '기존 휴무' } },
  aliases: ['검토 별칭'], policy: { category: '자연', subCategory: '공원', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, classification: 'representative_standard' },
  relations: { siteGroupId: 'site_a', siteRole: 'parent', mergedPlaceIds: ['old_a'] },
  photoRights: [{ url: 'https://example.test/approved.jpg', status: 'operator_approved', attribution: '보존 출처' }],
});
const place = (patch: Partial<TourLivePlace> = {}): TourLivePlace => ({ contentId: '100', contentTypeId: '12', title: '기존 공원', lat: 35.1, lon: 129.1, opening: { rawText: '09:00~18:00' }, ...patch });
const live = (p = place()): TourLiveSourceResult => ({ status: 'ready', snapshot: { snapshotId: 'fixture-1', fetchedAt: '2026-09-21T01:00:00Z', unreviewedCount: 0, places: [p], candidateStates: [{ contentId: p.contentId, contentTypeId: p.contentTypeId, state: 'active_ready' }] } });

test('active update includes live facts only; missing optional is absent', () => {
  const l = local();
  const r = buildLiveCandidateSnapshot([l], live(place({ title: '새 이름', address: '새 주소', modifiedAt: '20260921' })));
  assert.equal(r.status, 'ready');
  assert.equal(r.candidates[0].facts.title, '새 이름');
  assert.equal(r.candidates[0].facts.opening.closedText, undefined);
  assert.equal(r.candidates[0].provenance['opening.closedText'], undefined);
  assert.equal(r.candidates[0].provenance['opening.rawText'], 'tourapi_live');
  assert.deepEqual(r.candidates[0].policy, l.policy);
  assert.deepEqual(r.candidates[0].relations, l.relations);
  assert.deepEqual(r.candidates[0].photoRights, l.photoRights);
  assert.equal(r.candidates[0].openingVerification, 'required');
  assert.equal(l.facts.title, '기존 공원');
});

test('R1: absent live address/modified/opening fields never fall back to local facts', () => {
  const l = local();
  l.facts.modifiedAt = 'old-modified';
  l.facts.opening = { rawText: 'old-hours', closedText: 'old-closed', eventStartDate: '20200101', eventEndDate: '20201231' };
  const r = buildLiveCandidateSnapshot([l], live(place({ opening: {} })));
  const c = r.candidates[0];
  for (const key of ['address', 'modifiedAt'] as const) {
    assert.equal(c.facts[key], undefined);
    assert.equal(Object.hasOwn(c.facts, key), false);
    assert.equal(Object.hasOwn(c.provenance, key), false);
  }
  assert.deepEqual(c.facts.opening, {});
  assert.equal(c.openingVerification, 'required');
  assert.doesNotMatch(JSON.stringify(r), /old-hours|old-closed|old-modified|local_snapshot|기존 주소/);
  const blank = buildLiveCandidateSnapshot([l], live(place({ address: '', opening: { rawText: '' } }))).candidates[0];
  assert.equal(blank.facts.address, '');
  assert.deepEqual(blank.facts.opening, { rawText: '' });
  assert.equal(blank.openingVerification, 'required');
});

test('inactive/detail failure/identity conflict stay distinct, never resurrected', () => {
  for (const [state, reason] of [['inactive', 'inactive'], ['active_detail_failed', 'detail_failed'], ['identity_conflict', 'review_required']] as const) {
    const r = buildLiveCandidateSnapshot([local()], { status: 'partial', snapshot: { snapshotId: 'fixture-1', fetchedAt: '2026-09-21T01:00:00Z', places: [], candidateStates: [{ contentId: '100', contentTypeId: '12', state }], unreviewedCount: 0 }, failures: [] });
    assert.equal(r.candidates.length, 0);
    assert.equal(r.diagnostics[0].reason, reason);
  }
});

test('type conflict and combined unknown title + >=1km require review; isolated changes allowed', () => {
  for (const [patch, count] of [
    [{ contentTypeId: '14' }, 0], [{ title: '새 이름' }, 1], [{ lat: 35.12 }, 1],
    [{ title: '새 이름', lat: 35.12 }, 0], [{ title: '검토 별칭', lat: 35.12 }, 1],
  ] as const) {
    const r = buildLiveCandidateSnapshot([local()], live(place(patch)));
    assert.equal(r.candidates.length, count);
    if (!count) assert.equal(r.diagnostics[0].reason, 'review_required');
  }
  assert.equal(sourceDistanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(Math.abs(sourceDistanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111194.9266) < 0.001);
});

test('new IDs ignored, unmapped and missing states are not deletion', () => {
  const r = buildLiveCandidateSnapshot([local(), { ...local('poi_b'), mapping: undefined }], live(place({ contentId: '999' })));
  assert.equal(r.candidates.length, 0);
  assert.deepEqual(r.diagnostics.map(d => d.reason), ['not_in_snapshot', 'out_of_scope']);
});

test('AI-Hub/unknown fields cannot affect identity, dwell, or leak into output', () => {
  const l = { ...local(), aiHub: { title: '새 이름', lat: 35.12, dwell: 999 }, userId: 'fixture-private' };
  const p = { ...place(), aiHubDwell: 999, apiKey: 'fixture-secret' };
  const r = buildLiveCandidateSnapshot([l], live(p));
  assert.equal(r.candidates[0].policy.recommendedStayMin, 30);
  assert.doesNotMatch(JSON.stringify(r), /fixture-private|fixture-secret|aiHub/);
  assert.equal(buildLiveCandidateSnapshot([l], live(place({ title: '새 이름', lat: 35.12 }))).candidates.length, 0);
  const culture = local(); culture.policy = { ...culture.policy, category: '문화시설', maxStayMin: 120 };
  assert.equal(buildLiveCandidateSnapshot([culture], live()).candidates[0].policy.maxStayMin, 120);
});

test('unavailable returns no stale candidates or raw failure', () => {
  const r = buildLiveCandidateSnapshot([local()], { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'network', status: null, message: 'fixture-secret' } } as TourLiveSourceResult);
  assert.equal(r.status, 'unavailable');
  assert.equal(r.candidates.length, 0);
  assert.equal(r.diagnostics[0].reason, 'source_unavailable');
  assert.doesNotMatch(JSON.stringify(r), /fixture-secret/);
});

test('input/API order do not change snapshot; returned snapshot is detached and frozen', () => {
  const a = local(), b = { ...local('poi_b'), mapping: { status: 'exact' as const, tourapiContentId: '200', contentTypeId: '12' } };
  const source = live(); assert.notEqual(source.status, 'unavailable');
  if (source.status === 'unavailable') return;
  const s = { ...source, snapshot: { ...source.snapshot, places: [place(), place({ contentId: '200' })], candidateStates: [...source.snapshot.candidateStates, { contentId: '200', contentTypeId: '12', state: 'active_ready' as const }] } };
  const r = buildLiveCandidateSnapshot([b, a], s);
  assert.deepEqual(r, buildLiveCandidateSnapshot([a, b], { ...s, snapshot: { ...s.snapshot, places: [...s.snapshot.places].reverse(), candidateStates: [...s.snapshot.candidateStates].reverse() } }));
  a.relations.mergedPlaceIds.push('later');
  assert.deepEqual(r.candidates[0].relations.mergedPlaceIds, ['old_a']);
  assert.ok(Object.isFrozen(r.candidates[0].policy));
});

test('compound distance gate brackets 1km and accepts normalized reviewed aliases', () => {
  const l = local(); l.facts.lat = 0; l.facts.lon = 0;
  for (const meters of [999, 1000, 1001]) {
    const longitude = meters / 6371000 * 180 / Math.PI;
    const distance = sourceDistanceMeters(l.facts, { lat: 0, lon: longitude });
    assert.ok(Math.abs(distance - meters) < 1e-8);
    const r = buildLiveCandidateSnapshot([l], live(place({ title: '다른 이름', lat: 0, lon: longitude })));
    assert.equal(r.candidates.length, meters >= 1000 ? 0 : 1);
  }
  assert.equal(buildLiveCandidateSnapshot([local()], live(place({ title: '검토 (별칭)', lat: 35.12 }))).candidates.length, 1);
});

test('partial joins successful places only; hold never promoted; blank opening is not a fabricated schedule', () => {
  const a = local(); a.policy.classification = 'hold';
  const b = { ...local('poi_b'), mapping: { status: 'exact' as const, tourapiContentId: '200', contentTypeId: '12' } };
  const source = live(place({ opening: { rawText: '' } }));
  if (source.status === 'unavailable') return;
  const r = buildLiveCandidateSnapshot([b, a], { status: 'partial', snapshot: { ...source.snapshot, candidateStates: [...source.snapshot.candidateStates, { contentId: '200', contentTypeId: '12', state: 'active_detail_failed' }] }, failures: [{ operation: 'detailIntro2', code: 'timeout', status: null }] });
  assert.deepEqual(r.candidates.map(c => c.id), ['poi_a']);
  assert.equal(r.candidates[0].policy.classification, 'hold');
  assert.equal(r.candidates[0].facts.opening.rawText, '');
  assert.equal(r.candidates[0].openingVerification, 'required');
  assert.deepEqual(r.diagnostics, [{ placeId: 'poi_b', reason: 'detail_failed' }]);
});

test('ambiguous mapping/source duplicates and invalid coordinates cannot overlay', () => {
  const a = local(); const b = local('poi_b');
  assert.equal(buildLiveCandidateSnapshot([a, b], live()).candidates.length, 0);
  const source = live(); if (source.status === 'unavailable') return;
  assert.equal(buildLiveCandidateSnapshot([a], { ...source, snapshot: { ...source.snapshot, places: [place(), place({ title: 'duplicated' })] } }).candidates.length, 0);
  assert.equal(buildLiveCandidateSnapshot([a], live(place({ lat: 91 }))).diagnostics[0].reason, 'invalid_source');
});

test('complete inactive membership is ready-empty, not provider unavailability', () => {
  const r = buildLiveCandidateSnapshot([local()], { status: 'ready', snapshot: { snapshotId: 'empty', fetchedAt: '2026-09-21T01:00:00Z', places: [], candidateStates: [{ contentId: '100', contentTypeId: '12', state: 'inactive' }], unreviewedCount: 0 } });
  assert.equal(r.status, 'ready');
  assert.deepEqual(r.candidates, []);
  assert.deepEqual(r.diagnostics, [{ placeId: 'poi_a', reason: 'inactive' }]);
});
