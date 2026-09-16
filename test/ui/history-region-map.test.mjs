import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { screenRuntime } from './support/screenRuntime.mjs';

test('방문 장소는 주소의 부산 구·군으로 집계되고 반복 방문과 위치 미확인을 구분한다', () => {
  const runtime = screenRuntime();
  const { buildBusanVisitMap } = runtime.load('src/ui/activity/busanVisitMapModel.ts');
  const catalog = [
    { contentId: 'a', title: 'A', addr1: '부산광역시 부산진구 시민공원로 1', lat: 35.1, lon: 129.1 },
    { contentId: 'b', title: 'B', category: '자연관광지', addr1: '기장군 장안읍 해맞이로 1', lat: 35.2, lon: 129.2 },
    { contentId: 'c', title: 'C', addr1: '', lat: 35.3, lon: 129.3 },
  ];
  const result = buildBusanVisitMap([
    { contentId: 'a', title: 'A 첫 방문' },
    { contentId: 'a', title: 'A 재방문' },
    { contentId: 'b', title: 'B 방문' },
    { contentId: 'c', title: 'C 방문' },
    { contentId: 'missing', title: '과거 기록' },
  ], catalog);
  assert.deepEqual(result.districts.filter(row => row.count > 0).map(row => [row.name, row.count]), [['부산진구', 2], ['기장군', 1]]);
  assert.equal(result.places.length, 3);
  assert.deepEqual(result.placeSummaries.map(place => [place.contentId, place.visitCount, place.neighborhood]), [['a', 2, null], ['b', 1, '장안읍']]);
  assert.equal(result.unlocatedCount, 2);
});

test('벡터 지도는 직접 선택기가 아니며 지역은 큰 카드가 아닌 한 줄 필터 칩으로 고른다', async () => {
  const calls = [];
  const districtChanges = [];
  const animationConfigs = [];
  const dependencyRuntime = screenRuntime();
  const runtime = screenRuntime({
    '../theme': { C: { accent: '#0A84FF', panel: '#202126', txt: '#FFFFFF', txt2: '#D1D1D6', muted: '#8E8E93', line: '#32343A', bg: '#111214', onAccent: '#FFFFFF', red: '#FF453A' } },
    '../../data/busan_poi_catalog.json': { matched: { data: [
      { contentId: 'a', title: '부산시민공원', category: '자연관광지', addr1: '부산광역시 부산진구 시민공원로 73', lat: 35.166, lon: 129.055 },
      { contentId: 'b', title: '전포카페', category: '카페', addr1: '부산광역시 부산진구 전포동 1', lat: 35.157, lon: 129.063 },
      { contentId: 'c', title: '해운대 산책', category: '자연관광지', addr1: '부산광역시 해운대구 중동', lat: 35.16, lon: 129.16 },
    ] }, unmatched: { data: [] } },
    './busanDistrictPaths': dependencyRuntime.load('src/ui/activity/busanDistrictPaths.ts'),
    './busanSubdistrictPaths': dependencyRuntime.load('src/ui/activity/busanSubdistrictPaths.ts'),
    './busanVisitMapModel': dependencyRuntime.load('src/ui/activity/busanVisitMapModel.ts'),
    'react-native-svg': { __esModule: true, default: 'Svg', Svg: 'Svg', G: 'G', Path: 'Path', Circle: 'Circle', Text: 'SvgText', Defs: 'Defs', LinearGradient: 'LinearGradient', Stop: 'Stop' },
  });
  runtime.native.Animated.timing = (value, config) => ({ start(callback) { animationConfigs.push(config); value.setValue(config.toValue); callback?.(); } });
  const { BusanVisitVectorMap } = runtime.load('src/ui/activity/BusanVisitVectorMap.tsx');
  const screen = runtime.mount(BusanVisitVectorMap, {
    places: [{ contentId: 'a', title: '부산시민공원' }, { contentId: 'a', title: '부산시민공원' }, { contentId: 'b', title: '전포카페' }, { contentId: 'c', title: '해운대 산책' }],
    onOpenKakao: async place => { calls.push(place.contentId); return true; },
    onDistrictFilterChange: value => districtChanges.push(value),
  });
  assert.equal(screen.get('busan-visit-vector-map').props.onPress, undefined);
  assert.match(JSON.stringify(screen.get('busan-region-card-Busanjin-gu')), /부산진구/);
  assert.match(JSON.stringify(screen.get('busan-region-all')), /전체/);
  const regionStyle = Object.assign({}, ...[screen.get('busan-region-card-Busanjin-gu').props.style].flat().filter(Boolean));
  assert.equal(regionStyle.minHeight, 44);
  assert.equal(regionStyle.width, undefined);
  assert.doesNotMatch(JSON.stringify(screen.get('busan-region-card-Busanjin-gu')), /방문 3회/);
  assert.match(JSON.stringify(screen.get('busan-region-card-Busanjin-gu')), /부산진구.*3/s);
  const districtFillBeforeSelection = screen.get('busan-district-fill-Busanjin-gu').props.fill;
  screen.press('busan-region-card-Busanjin-gu');
  assert.deepEqual(animationConfigs.slice(0, 1).map(config => [config.duration, config.useNativeDriver]), [[180, true]]);
  assert.equal(screen.nodes(node => node.props.testID === 'busan-district-detail-map-Busanjin-gu').length, 0);
  assert.equal(screen.get('busan-district-fill-Busanjin-gu').props.fill, districtFillBeforeSelection);
  assert.equal(screen.get('busan-district-focus').props.fill, 'none');
  assert.equal(screen.get('busan-district-focus-glow').props.fill, 'none');
  assert.deepEqual(districtChanges, [{ district: '부산진구', contentIds: ['a', 'b'] }]);
  assert.match(JSON.stringify(screen.get('busan-place-scope')), /부산진구.*방문 3회.*2곳/);
  assert.match(JSON.stringify(screen.get('busan-place-list-heading')), /부산진구에서 다녀간 장소/);
  assert.equal(screen.get('busan-place-list').type, 'View');
  assert.equal(screen.nodes(node => node.props.testID?.startsWith('busan-visit-place-')).length, 2);
  screen.press('busan-place-category-카페');
  assert.equal(screen.nodes(node => node.props.testID?.startsWith('busan-visit-place-')).length, 1);
  assert.match(JSON.stringify(screen.get('busan-visit-place-b')), /전포동/);
  screen.press('busan-visit-open-kakao-b');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['b']);
  screen.press('busan-region-all');
  assert.equal(districtChanges.at(-1), null);
  assert.match(JSON.stringify(screen.get('busan-place-scope')), /전체 지역/);
  assert.ok(screen.get('busan-visit-vector-map'));
  assert.doesNotMatch(fs.readFileSync('src/ui/activity/BusanVisitVectorMap.tsx', 'utf8'), /지도 경계: Kurykh|SOURCE_URL/);
});

test('세부 경계 자산은 부산 16개 구군과 출처 조건을 보존한다', () => {
  const runtime = screenRuntime();
  const { BUSAN_SUBDISTRICT_MAPS } = runtime.load('src/ui/activity/busanSubdistrictPaths.ts');
  assert.equal(BUSAN_SUBDISTRICT_MAPS.length, 16);
  assert.ok(BUSAN_SUBDISTRICT_MAPS.every(row => row.paths.length > 1));
  assert.equal(BUSAN_SUBDISTRICT_MAPS.find(row => row.districtId === 'Busanjin-gu').paths.length, 14);
});
