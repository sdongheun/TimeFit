// Run through tsx so the production component's pure TypeScript dependencies execute too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './support/screenRuntime.mjs';
test('completed-place trigger opens only visited markers and closes the map', () => {
  const runtime = screenRuntime({ '../data/busan_poi_catalog.json': {matched:{data:[{contentId:'a',lat:35,lon:129},{contentId:'b',lat:36,lon:128}]},unmatched:{data:[]}} });
  const { CompletedPlacesMapButton } = runtime.load('src/ui/CompletedPlacesMapButton.tsx');
  const screen = runtime.mount(CompletedPlacesMapButton, {places:[{contentId:'a',title:'다녀온 곳'}]});
  assert.equal(screen.nodes((node: {type: unknown}) => node.type === 'KakaoRouteMap').length, 0);
  screen.press('completed-places-map-open');
  const map = screen.nodes((node: {type: unknown}) => node.type === 'KakaoRouteMap')[0];
  assert.deepEqual(map.props.markers, [{lat:35,lon:129,label:'다녀온 곳',kind:'spot'}]);
  assert.deepEqual(map.props.line, []);
  screen.press('completed-places-map-close');
  assert.equal(screen.nodes((node: {type: unknown}) => node.type === 'KakaoRouteMap').length, 0);
});
