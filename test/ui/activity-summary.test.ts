import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCompletedActivities } from '../../src/ui/activity/activitySummary';

test('이번 달 완료 피드백만으로 활동 시간과 카테고리 비율을 집계한다', () => {
  const now = new Date('2026-08-23T12:00:00+09:00').getTime();
  const summary = summarizeCompletedActivities([
    { id: '1', completedAt: new Date('2026-08-01T13:00:00+09:00').getTime(), contentId: 'c1', title: '카페 A', category: '카페', rating: 5, actualDwellMin: 30 },
    { id: '2', completedAt: new Date('2026-08-10T13:00:00+09:00').getTime(), contentId: 'c2', title: '공원 B', category: '자연관광지', rating: 4, actualDwellMin: 45 },
    { id: '3', completedAt: new Date('2026-07-31T13:00:00+09:00').getTime(), contentId: 'c3', title: '전시 C', category: '문화시설', rating: 4, actualDwellMin: 60 },
  ], now);

  assert.equal(summary.completedPlaceCount, 2);
  assert.equal(summary.completedDwellMin, 75);
  assert.deepEqual(summary.categories, [
    { category: '자연관광지', count: 1, dwellMin: 45, ratio: 60 },
    { category: '카페', count: 1, dwellMin: 30, ratio: 40 },
  ]);
});

test('완료 기록이 없으면 성취 수치를 만들지 않는다', () => {
  const summary = summarizeCompletedActivities([], new Date('2026-08-23T12:00:00+09:00').getTime());
  assert.equal(summary.completedPlaceCount, 0);
  assert.equal(summary.completedDwellMin, 0);
  assert.deepEqual(summary.categories, []);
});
