import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completedPlaceMarkers, monthCompletionPlaces } from '../../src/ui/activity/completedPlaceMapModel';

test('main tab destinations disable transitions without disabling detail navigation', () => {
  const app = readFileSync('App.tsx', 'utf8');
  for (const name of ['Home', 'NearbyBrowse', 'ActivityRecord', 'Profile']) assert.match(app, new RegExp(`name="${name}"[^\\n]+animation: 'none'`));
  assert.doesNotMatch(app.match(/name="PlaceDetail"[^\n]+/)![0], /animation/);
});
test('record markers resolve only completed IDs, deduplicate and reject missing/invalid locations', () => {
  const places = [{contentId:'a',title:'방문 A'}, {contentId:'a',title:'다시 방문'}, {contentId:'missing',title:'없는 곳'}, {contentId:'bad',title:'잘못된 좌표'}];
  assert.deepEqual(completedPlaceMarkers(places, [{contentId:'a',lat:35,lon:129}, {contentId:'bad',lat:NaN,lon:129}, {contentId:'unvisited',lat:36,lon:128}]), [{lat:35,lon:129,label:'방문 A',kind:'spot'}]);
});
test('guest map follows the same local calendar month as the summary', () => {
  const a = {contentId:'a',title:'A'};
  assert.deepEqual(monthCompletionPlaces([{completedAt:new Date(2026,8,1).getTime(),places:[a]}, {completedAt:new Date(2026,7,31).getTime(),places:[{contentId:'b',title:'B'}]}], new Date(2026,8,7).getTime()), [a]);
});
