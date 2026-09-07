import assert from 'node:assert/strict';
import test from 'node:test';
import runtimeCatalog from '../src/data/busan_poi_catalog.json' with { type: 'json' };
import cafeCultureAudit from '../data/processed/review/카페문화시설_세부분류_감사.json' with { type: 'json' };
import { projectRuntimeImageWithPermission } from '../scripts/runtime_image_permission.mjs';

const places = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data];

test('U-PUBLIC-API-PHOTO-01: API 단위 이용허락이 확인된 부산 명소·맛집 사진 101개만 공개한다', () => {
  const photos = places.filter((place) => place.imageUrl);
  assert.equal(photos.length, 101);
  assert.equal(photos.filter((place) => place.imageEvidence.source === 'busan_attraction').length, 85);
  assert.equal(photos.filter((place) => place.imageEvidence.source === 'busan_food').length, 16);
  assert.equal(photos.filter((place) => place.imageEvidence.source === 'busan_shopping').length, 0);
  assert.equal(photos.filter((place) => place.imageSource === 'tourapi').length, 0);
});

test('DATA-RELEASE-PERSONALIZATION-01: 사진 부재는 장소 ID와 추천 eligibility를 줄이지 않는다', () => {
  assert.equal(places.length, 369);
  assert.equal(new Set(places.map((place) => place.contentId)).size, 369);
  assert.equal(places.filter((place) => ['representative_core', 'representative_standard'].includes(place.classification)).length, 191);
  assert.equal(places.filter((place) => place.classification === 'conditional_more').length, 178);
});

test('DATA-RELEASE-PERSONALIZATION-01 후속: 공식 구조화 유형이 있는 카페 5곳만 세부분류하고 문화시설 missing은 추정하지 않는다', () => {
  const byId = new Map(places.map((place) => [place.contentId, place]));
  assert.deepEqual(
    ['poi_1141', 'poi_1152', 'poi_1154', 'poi_1158', 'poi_403'].map((id) => [id, byId.get(id)?.subCategory]),
    [
      ['poi_1141', '베이커리'],
      ['poi_1152', '디저트카페'],
      ['poi_1154', '베이커리'],
      ['poi_1158', '커피전문점'],
      ['poi_403', '커피전문점'],
    ],
  );
  assert.equal(places.filter((place) => place.category === '카페' && place.subCategory).length, 5);
  assert.equal(places.filter((place) => place.category === '문화시설' && place.subCategory).length, 2);
  assert.equal(byId.get('poi_1153')?.subCategory, undefined, '공식 SUBTITLE의 상품명 케이크를 장소 유형으로 추정하지 않는다');
  assert.equal(byId.get('poi_25')?.subCategory, undefined, '문화시설 이름을 보고 미술관 유형을 합성하지 않는다');
});

test('DATA-RELEASE-PERSONALIZATION-01 후속: 변경 5건은 정확한 공식 원천 필드와 연결된다', () => {
  const changed = cafeCultureAudit.data.filter((place) => place.previousSubCategory !== place.newSubCategory);
  assert.equal(cafeCultureAudit.summary.total, 98);
  assert.equal(cafeCultureAudit.summary.changed, 5);
  assert.equal(Object.values(cafeCultureAudit.summary.byCategory).reduce((sum, row) => sum + row.remainingMissing, 0), 91);
  assert.deepEqual(changed.map((place) => place.contentId).sort(), ['poi_1141', 'poi_1152', 'poi_1154', 'poi_1158', 'poi_403']);
  for (const place of changed) {
    assert.equal(place.decision, 'assign_exact_official_subtitle');
    assert.equal(place.officialEvidence.length, 1);
    assert.equal(place.officialEvidence[0].source, 'busan_food');
    assert.equal(place.officialEvidence[0].field, 'SUBTITLE');
    assert.equal(place.officialEvidence[0].sourceText, place.newSubCategory);
  }
});

test('DATA-RELEASE-PERSONALIZATION-01: 정확하고 완전한 이용허락만 조건과 함께 투영한다', () => {
  const candidate = {
    imageUrl: 'https://images.example.test/photo.jpg',
    imageSource: 'busan_official',
    imageEvidence: { source: 'busan_attraction', sourceId: '17' },
  };
  const permission = {
    contentId: 'poi_fixture',
    source: 'busan_attraction',
    sourceId: '17',
    imageUrl: candidate.imageUrl,
    permissionBasis: 'api_service',
    serviceName: 'fixture API service',
    status: 'verified',
    rightsHolder: 'fixture rights holder',
    sourcePageUrl: 'https://source.example.test/17',
    licenseName: 'fixture license',
    licenseUrl: 'https://license.example.test/1',
    attribution: 'fixture attribution',
    attributionRequired: false,
    displayConditions: 'fixture display condition',
    commercialUseAllowed: true,
    modificationAllowed: true,
    verifiedAt: '2026-09-07',
  };

  const projected = projectRuntimeImageWithPermission('poi_fixture', candidate, [permission]);
  assert.equal(projected?.imageUrl, candidate.imageUrl);
  assert.deepEqual(projected?.imageEvidence.usagePermission, {
    basis: 'api_service',
    serviceName: 'fixture API service',
    status: 'verified',
    rightsHolder: 'fixture rights holder',
    sourcePageUrl: 'https://source.example.test/17',
    licenseName: 'fixture license',
    licenseUrl: 'https://license.example.test/1',
    attribution: 'fixture attribution',
    attributionRequired: false,
    displayConditions: 'fixture display condition',
    commercialUseAllowed: true,
    modificationAllowed: true,
    verifiedAt: '2026-09-07',
  });
  assert.equal(projectRuntimeImageWithPermission('other', candidate, [permission]), null);
  assert.equal(projectRuntimeImageWithPermission('poi_fixture', candidate, [{ ...permission, permissionBasis: 'individual_photo' }]), null);
  assert.equal(projectRuntimeImageWithPermission('poi_fixture', candidate, [{ ...permission, modificationAllowed: false }]), null);
  assert.equal(projectRuntimeImageWithPermission('poi_fixture', candidate, [{ ...permission, licenseUrl: '' }]), null);
  assert.equal(projectRuntimeImageWithPermission('poi_fixture', candidate, [permission, permission]), null);
});
