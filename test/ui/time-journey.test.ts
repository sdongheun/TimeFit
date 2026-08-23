import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimeJourney } from '../../src/ui/recommendation/timeJourneyModel';

test('추천 상태는 권장 체류 후 도착 여유를 시간 여정으로 만든다', () => {
  const journey = buildTimeJourney({
    status: 'recommended', approachMin: 12, onwardMin: 18,
    minimumStayMin: 15, recommendedStayMin: 30, availableStayMin: 42,
  }, 12 * 60, 14 * 60);

  assert.deepEqual(journey, {
    activityMin: 30,
    departureMin: 12 * 60 + 42,
    arrivalMin: 12 * 60 + 60,
    reserveMin: 60,
  });
});

test('빠듯 상태는 최소 체류만 사용하고 음수 여유를 만들지 않는다', () => {
  const journey = buildTimeJourney({
    status: 'short', approachMin: 10, onwardMin: 20,
    minimumStayMin: 15, recommendedStayMin: 30, availableStayMin: 18,
  }, 12 * 60, 13 * 60);

  assert.equal(journey.activityMin, 15);
  assert.equal(journey.reserveMin, 15);
});
