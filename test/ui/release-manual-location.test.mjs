import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const tick = async () => { for(let i=0;i<30;i++) await Promise.resolve(); };
test('MANUAL old device snapshot is never retransmitted as a detail map marker', () => {
  const require = createRequire(import.meta.url);
  const { buildPlaceDetailMarkers } = require('../../src/ui/placeDetailModel.ts');
  const session = { origin: { lat: 35, lon: 129 }, deviceLocationSnapshot: { lat: 37, lon: 127 } };
  const markers = buildPlaceDetailMarkers(session, { lat: 35.2, lon: 129.2, title: '선택 장소' });
  assert.equal(markers.some(m => m.lat === 37 || m.kind === 'current'), false);
  assert.deepEqual(session.deviceLocationSnapshot, { lat: 37, lon: 127 }); // storage is not deleted
});
test('MANUAL location camera uses only selected point; no point means no control', async () => {
  let reads=0; const calls=[];
  const host=screenRuntime({'expo-location':new Proxy({}, {get(){return async()=>{reads++;return {status:'granted',coords:{latitude:1,longitude:2}};};}})});
  const Component=host.load('src/ui/MapCameraButton.tsx').MapCameraButton;
  const point={lat:35.1,lon:129.1};const screen=host.mount(Component,{point,onCamera:p=>calls.push(p)});
  screen.get('map-camera-current').props.onPress();await tick();assert.deepEqual(calls,[point]);assert.equal(reads,0);screen.unmount();
  const empty=host.mount(Component,{onCamera:p=>calls.push(p)});assert.equal(empty.nodes(n=>n.props.onPress).length,0);empty.unmount();
});
test('MANUAL profile ignores granted GPS dependencies entirely', async () => {
  let reads=0;
  const host=screenRuntime({'expo-notifications':{},'./liveActivity/nativeLiveActivityPort':{nativeLiveActivityPort:{}}});
  const port=host.load('src/ui/profileSettingsPort.ts');
  const value=await port.readProfilePermissionSnapshot({getLocationPermission:async()=>{reads++;return {status:'granted'};},getNotificationPermission:async()=>({status:'granted'})});
  assert.equal(reads,0);assert.equal(value.notification,'granted');assert.equal('location' in value,false);
});
test('MANUAL stale device draft has no confirmation entry', () => {
  const require = createRequire(import.meta.url);
  const { createLocationSearchDraft } = require('../../src/ui/locationSearchDraft.ts');
  const draft = createLocationSearchDraft(); draft.start('출발지 선택');
  draft.resolveGps(draft.beginGps(), { lat: 37, lon: 127 }, '과거 기기 주소');
  const host = screenRuntime({ '../services/kakaoLocationSearchAdapter': { createKakaoLocationSearchAdapter: () => ({ search() { throw Error('must not search automatically'); } }) } });
  const screen = host.mount(host.load('src/ui/PlacePicker.tsx').PlacePicker, { visible: true, title: '출발지 선택', center: { lat: 35, lon: 129 }, editingSession: draft, onConfirm() { throw Error('old GPS must not be confirmed'); }, onClose() {}, onOpenMap() {} });
  assert.equal(screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  screen.unmount();
});
test('MANUAL non-clean native regeneration strips only location permissions and preserves Live Activity', () => {
  const require = createRequire(import.meta.url);
  const { stripLocationPermissions } = require('../../plugins/withoutLocationPermissions.cjs');
  const plist = { NSLocationWhenInUseUsageDescription: 'legacy', NSLocationAlwaysUsageDescription: 'legacy', NSLocationAlwaysAndWhenInUseUsageDescription: 'legacy', NSLocationTemporaryUsageDescriptionDictionary: { purpose: 'legacy' }, UIBackgroundModes: ['location', 'audio'], NSSupportsLiveActivities: true, CFBundleDisplayName: '짜투리' };
  stripLocationPermissions(plist); stripLocationPermissions(plist);
  assert.deepEqual(plist, { UIBackgroundModes: ['audio'], NSSupportsLiveActivities: true, CFBundleDisplayName: '짜투리' });
  const config = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(config.dependencies['expo-location'], undefined);
});
test('MANUAL production UI imports no automatic positioning and native config has no location plugin',()=>{
  for(const name of fs.readdirSync('src/ui').filter(n=>/\.(tsx?|jsx?)$/.test(n))) {
    const code=fs.readFileSync(`src/ui/${name}`,'utf8');
    assert.doesNotMatch(code,/from ['"]expo-location['"]|navigator\.geolocation/,name);
  }
  const config=JSON.parse(fs.readFileSync('app.json','utf8'));
  assert.equal(config.expo.plugins.some(p=>(Array.isArray(p)?p[0]:p)==='expo-location'),false);
});
