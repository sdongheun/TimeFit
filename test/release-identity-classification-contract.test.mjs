import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import runtimeCatalog from '../src/data/busan_poi_catalog.json' with { type: 'json' };
import audit from '../data/processed/review/출시_사진개인화_데이터_감사.json' with { type: 'json' };

const migration = readFileSync(new URL('../supabase/migrations/202609070016_dwell_personalization_storage.sql', import.meta.url), 'utf8');
const places = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data];

test('DB identity 보완: migration016 표본 검증 입력은 최신 catalog version과 카페 5곳 exact key를 보존한다', () => {
  assert.equal(audit.dbClassificationContract.version, 'runtime-category-subcategory-3bb74d97ebcd');
  assert.equal(audit.dbClassificationContract.catalogPlaceCount, 369);
  const byId = new Map(places.map((place) => [place.contentId, place]));
  assert.deepEqual(
    ['poi_1141', 'poi_1152', 'poi_1154', 'poi_1158', 'poi_403'].map((id) => [id, byId.get(id)?.category, byId.get(id)?.subCategory]),
    [
      ['poi_1141', '카페', '베이커리'],
      ['poi_1152', '카페', '디저트카페'],
      ['poi_1154', '카페', '베이커리'],
      ['poi_1158', '카페', '커피전문점'],
      ['poi_403', '카페', '커피전문점'],
    ],
  );
  assert.match(migration, /p\.content_id=p_content_id and p\.category=p_category and p\.sub_category=p_sub_category/);
  assert.match(migration, /c\.provenance='account_completed'/);
  assert.equal(byId.get('poi_1153')?.subCategory, undefined);
  assert.equal(byId.get('poi_25')?.subCategory, undefined);
});
