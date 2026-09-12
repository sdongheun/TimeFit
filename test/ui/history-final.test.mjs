import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
test('shared summary presents visits, preview and actual categories without four metric boxes', () => {
  const runtime = screenRuntime({ '../CompletedPlacesMapButton': { CompletedPlacesMapButton: 'MapPreview' } });
  const Summary = runtime.load('src/ui/activity/ActivityStatistics.tsx').ActivityStatistics;
  const places = [{contentId:'a'}, {contentId:'a'}, {contentId:'b'}];
  const screen = runtime.mount(Summary, {summary:{completedPlaceCount:3,categories:[{category:'카페',count:2},{category:'문화시설',count:1}],dwellPresentation:{kind:'unmeasured'}},completedPlaces:places,mapKey:'fixture',scope:'이번 달'});
  assert.match(JSON.stringify(screen.render()), /방문/);
  assert.doesNotMatch(JSON.stringify(screen.render()), /활동 비율|활용한 시간|활동 유형/);
  assert.equal(screen.nodes(n => n.type === 'MapPreview')[0].props.preview, true);
  assert.deepEqual(screen.nodes(n => n.type === 'MapPreview')[0].props.places, places);
});
test('history offers explicit menu and long press without permanent swipe hint', () => {
  const row = fs.readFileSync('src/ui/HistorySwipeRow.tsx','utf8');
  assert.match(row,/onLongPress/); assert.match(row,/history-menu-/);
  assert.doesNotMatch(fs.readFileSync('src/ui/AccountRecordsPanel.tsx','utf8'), /왼쪽으로 밀어 삭제/);
});
