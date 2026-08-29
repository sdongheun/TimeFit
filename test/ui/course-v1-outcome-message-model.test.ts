import assert from 'node:assert/strict';
import test from 'node:test';
import { courseV1OutcomeMessage } from '../../src/ui/recommendation/courseV1OutcomeMessageModel';

test('UREC01-04: 결과 없음 사유는 provider·network detail 없는 고정 사용자 문구로 바뀐다', () => {
  assert.deepEqual({
    no_eligible_candidates: courseV1OutcomeMessage('no_eligible_candidates'),
    no_open_candidates: courseV1OutcomeMessage('no_open_candidates'),
    time_budget_exceeded: courseV1OutcomeMessage('time_budget_exceeded'),
    route_not_verified: courseV1OutcomeMessage('route_not_verified'),
    route_verification_unavailable: courseV1OutcomeMessage('route_verification_unavailable'),
  }, {
    no_eligible_candidates: '이 위치와 시간에 추천 조건을 통과한 장소가 부족해요.',
    no_open_candidates: '지금 운영 중인 추천 장소가 부족해요.',
    time_budget_exceeded: '이동과 머무름을 합쳐 도착 시각 안에 들어오는 코스를 찾지 못했어요.',
    route_not_verified: '실제 이동 경로로 가능한 코스를 확인하지 못했어요.',
    route_verification_unavailable: '지금은 이동 경로를 확인할 수 없어 추천하지 않았어요. 잠시 후 다시 시도해 주세요.',
  });
});

test('UREC01-05: 사유가 없거나 노출 대상 밖이면 기존 일반 빈 상태 문구를 호출자가 유지한다', () => {
  assert.equal(courseV1OutcomeMessage(), undefined);
  assert.equal(courseV1OutcomeMessage('no_distinct_verified_alternative'), undefined);
});
