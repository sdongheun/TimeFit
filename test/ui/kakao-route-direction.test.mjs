import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf8');

function directionModel() {
  const start = source.indexOf('function toRad');
  const end = source.indexOf('function addDirectionArrows');
  assert.ok(start >= 0 && end > start, 'direction placement model must remain testable');
  return new Function(`${source.slice(start, end)}; return { arrowMarks, distanceM };`)();
}

test('route direction arrows stay off sharp corners and route endpoints', () => {
  const { arrowMarks, distanceM } = directionModel();
  const corner = { lat: 35, lon: 129.0044 };
  const marks = arrowMarks([
    { lat: 35, lon: 129 },
    corner,
    { lat: 35.0038, lon: 129.0044 },
  ]);
  assert.ok(marks.length >= 2, 'long route should still communicate direction');
  assert.ok(marks.every(mark => distanceM(mark.point, corner) >= 24), 'a chevron must not straddle the 90-degree corner');
  assert.ok(marks.every(mark => distanceM(mark.point, { lat: 35, lon: 129 }) >= 20));
  assert.ok(marks.every(mark => distanceM(mark.point, { lat: 35.0038, lon: 129.0044 }) >= 20));
});

test('a straight A-to-B route uses several evenly spaced direction chevrons', () => {
  const { arrowMarks, distanceM } = directionModel();
  const marks = arrowMarks([
    { lat: 35, lon: 129 },
    { lat: 35, lon: 129.0066 },
  ]);
  assert.ok(marks.length >= 4, 'a roughly 600m route needs more than one or two direction marks');
  const gaps = marks.slice(1).map((mark, index) => distanceM(marks[index].point, mark.point));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 2, 'straight-route chevrons should keep an even rhythm');
});

test('route direction visual is a compact chevron inside a stronger route line, not a floating pill', () => {
  assert.match(source, /\.route-arrow\{width:12px;height:12px/);
  assert.match(source, /\.route-arrow path\.body\{[^}]*stroke:#fff/);
  assert.doesNotMatch(source, /\.arrow\{width:26px;height:20px/);
  assert.match(source, /strokeWeight: highlighted \? \(isFallback \? 5 : 7\) : 4/);
  assert.match(source, /addDirectionArrows\(seg\.points \|\| \[\], seg\.mode \|\| seg\.quality\)/);
});

test('highlighted leg renders after dim context and is the only leg receiving arrows', () => {
  assert.match(source, /highlightedLegIndex/);
  assert.match(source, /orderedSegments/);
  assert.match(source, /var highlighted = !hasHighlight \|\| seg\.legIndex === data\.highlightedLegIndex/);
  assert.match(source, /if \(highlighted\) addDirectionArrows/);
});
