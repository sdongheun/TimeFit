import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('data/processed/review/부산_자투리장소_카탈로그_초안.json', 'utf8'));
const decisions = JSON.parse(fs.readFileSync('data/processed/review/부산_자투리장소_보류및제외.json', 'utf8'));
const candidates = catalog.data;
const approved = candidates.filter((place) => place.selectionStatus === 'approved');
const conditional = candidates.filter((place) => place.selectionStatus === 'conditional');
const all = [...candidates, ...decisions.review, ...decisions.excluded];

test('자투리 장소 카탈로그는 런타임 변환의 단일 원천이며 원본 추적 정보를 보존한다', () => {
  assert.equal(catalog.meta.status, 'runtime_source_active');
  assert.equal(catalog.summary.existingSourceTotal, 911);
  assert.equal(catalog.summary.sourceTotal, 911 + catalog.summary.addedTraditionalMarketCandidates);
  assert.equal(catalog.summary.approved + catalog.summary.conditional + catalog.summary.review + catalog.summary.excluded, catalog.summary.sourceTotal);
});

test('일반 음식점은 자동 추천 승인 대상이 아니다', () => {
  const food = /식당|음식|맛집|분식|국밥|밀면|횟집|복국|갈비|곰탕|칼국수|고기|전복|해장|돼지|라멘|만게츠|텐푸라|포차|주점/;
  assert.deepEqual(approved.filter((place) => place.category === '식당' || food.test(place.title)).map((place) => place.title), []);
});

test('카페·베이커리는 제외가 아니라 대기·운영시간 수동 검토 대상으로 남긴다', () => {
  const quickRest = all
    .filter((place) => place.category === '카페');
  assert.ok(quickRest.length > 0, '카페·베이커리 후보가 필요합니다.');
  assert.deepEqual(quickRest.filter((place) => place.selectionStatus === 'excluded').map((place) => place.title), []);
});

test('활동 유형과 좌표가 있는 보류 후보는 조건부 후보로 사용하되 불확실성을 숨기지 않는다', () => {
  assert.ok(conditional.length > 0, '조건부 후보가 필요합니다.');
  for (const place of conditional) {
    assert.ok(place.shortStayType, `${place.title}: activity type required`);
    assert.ok(Number.isFinite(place.lat) && Number.isFinite(place.lon), `${place.title}: coordinates required`);
    assert.equal(place.initialSelectionStatus, 'review');
    assert.match(place.mapSearchUrl ?? '', /^https:\/\/map\.kakao\.com\/link\/search\//, `${place.title}: map link required`);
    assert.ok(place.availabilityNotice, `${place.title}: uncertainty notice required`);
  }
});

test('승인 장소는 정확한 AIHub 근거 또는 운영시간이 확인된 quick_rest 근거를 가진다', () => {
  for (const place of approved) {
    if (place.shortStayType === 'quick_rest') {
      assert.equal(place.selectionEvidence.hasOperatingHours, true, `${place.title}: opening hours required`);
    } else {
      assert.equal(place.selectionEvidence.exactAihubMatch, true, `${place.title}: exact match required`);
      assert.equal(place.aihubMatch?.matchType, 'name+coord', `${place.title}: match type`);
      assert.ok(place.aihubMatch?.distanceM <= 100, `${place.title}: coordinate distance`);
    }
  }
});

test('승인 장소는 짧은 체류 범위와 활동 유형을 가진다', () => {
  for (const place of approved) {
    assert.ok(place.shortStayType, `${place.title}: missing type`);
    assert.ok(place.minStayMin > 0, `${place.title}: min`);
    assert.ok(place.minStayMin <= place.recommendedStayMin, `${place.title}: recommended`);
    assert.ok(place.recommendedStayMin <= place.maxStayMin, `${place.title}: max`);
  }
});

test('권장 체류는 활동 대응 AI-Hub 카테고리 최빈값 30분을 사용하고, 문화시설만 최대 120분을 둔다', () => {
  for (const place of candidates) {
    assert.equal(place.dwellReference?.kind, 'category_mode', `${place.title}: category mode reference`);
    assert.equal(place.dwellReference?.mode, 30, `${place.title}: AI-Hub category mode`);
    assert.equal(place.recommendedStayMin, 30, `${place.title}: short-visit recommendation`);
    assert.equal(place.minStayMin, 20, `${place.title}: short-visit minimum`);
    assert.equal(place.maxStayMin, place.shortStayType === 'compact_culture' ? 120 : 60, `${place.title}: activity maximum`);
  }
});

test('긴 활동과 예약·대기 위험이 큰 장소는 승인되지 않는다', () => {
  const longActivity = /롯데월드|놀이공원|아쿠아리움|크루즈|케이블카|키자니아|온천|스파|찜질|레포츠|서핑|다이빙|요트|승마|골프|낚시|캠핑|체육공원|빙상장|인라인|무장애숲길|둘레길|등산|연대봉|금정산|아홉산숲/;
  assert.deepEqual(approved.filter((place) => longActivity.test(place.title)).map((place) => place.title), []);
});

test('이미 확인된 모호하거나 잘못된 엔터티는 승인하지 않는다', () => {
  assert.equal(approved.some((place) => place.title === '그런고로'), false);
});

test('명시된 포괄 장소 내부 후보는 대표 권역으로 대체한다', () => {
  assert.deepEqual(approved.filter((place) => place.scope?.type === '내부장소').map((place) => place.title), []);
  const replaced = decisions.excluded.filter((place) => place.decisionReasons?.includes('represented_by_parent_area'));
  assert.ok(replaced.length > 0, '내부 장소 대체 기록이 필요합니다.');
  for (const place of replaced) {
    assert.ok(place.representedBy?.id, `${place.title}: 대표 장소 ID가 필요합니다.`);
    assert.ok(place.representedBy?.title, `${place.title}: 대표 장소 이름이 필요합니다.`);
  }
});

test('모든 원천 장소는 승인·검토·제외 사유 중 하나로 추적된다', () => {
  assert.equal(all.length, catalog.summary.sourceTotal);
  for (const place of all) {
    assert.ok(['approved', 'conditional', 'review', 'excluded'].includes(place.selectionStatus));
    assert.ok(place.decisionReasons?.length, `${place.title}: decision reason missing`);
    assert.ok(place.sourceEvidence?.length, `${place.title}: source evidence missing`);
  }
});

test('전통시장 표준데이터 추가 후보는 대표 시장 review로만 들어가며 즉시 승인되지 않는다', () => {
  const markets = all.filter((place) => place.sourceEvidence?.some((source) => source.source === 'traditional_market_standard'));
  assert.equal(markets.length, catalog.summary.addedTraditionalMarketCandidates);
  assert.deepEqual(markets.filter((place) => place.selectionStatus === 'approved').map((place) => place.title), []);
  for (const market of markets) {
    assert.notEqual(market.selectionStatus, 'approved');
    assert.equal(market.scope?.type, '포괄장소');
    assert.equal(market.scope?.kind, '시장');
  }
});
