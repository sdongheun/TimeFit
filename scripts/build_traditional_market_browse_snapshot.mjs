#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const mapping = JSON.parse(fs.readFileSync('data/processed/review/live_source_place_mapping_manifest.json', 'utf8'));
const places = new Map([...catalog.matched.data, ...catalog.unmatched.data].map((place) => [place.contentId, place]));
const rows = mapping.data.filter((row) => row.traditionalMarketSourceIds.length).map((row) => {
  const place = places.get(row.contentId);
  assert.ok(place, `${row.contentId}: missing reviewed place`);
  assert.equal(row.traditionalMarketSourceIds.length, 1);
  assert.equal(row.tourapiContentId, null);
  assert.ok(Object.values(row.busanSourceIds).every((ids) => ids.length === 0));
  assert.equal(place.classification, 'conditional_more');
  assert.equal(place.sourceEvidence?.length, 1);
  assert.equal(place.sourceEvidence[0].source, 'traditional_market_standard');
  assert.equal(place.sourceEvidence[0].sourceId, row.traditionalMarketSourceIds[0]);
  assert.ok(Array.isArray(place.operatingHours) && place.operatingHours.length === 0);
  assert.ok(place.addr1?.trim() && place.title?.trim());
  assert.ok(Number.isFinite(place.lat) && Number.isFinite(place.lon));
  return {
    placeId: place.contentId,
    sourceId: row.traditionalMarketSourceIds[0],
    title: place.title,
    address: place.addr1,
    lat: place.lat,
    lon: place.lon,
  };
}).sort((a, b) => a.placeId.localeCompare(b.placeId));
assert.equal(rows.length, 118);
assert.equal(new Set(rows.map((row) => row.placeId)).size, 118);
assert.equal(new Set(rows.map((row) => row.sourceId)).size, 118);
fs.writeFileSync('src/data/traditional_market_browse_snapshot.json', `${JSON.stringify({
  meta: {
    taskId: 'DATA-LIVE-TRADITIONAL-MARKET-NEARBY-06',
    source: 'traditional_market_standard',
    sourceSnapshot: 'reviewed runtime catalog',
    use: 'live ON nearby information and directions only',
    operatingHoursStatus: 'unverified',
  },
  data: rows,
}, null, 2)}\n`);
console.log(`traditional_market_standard static browse snapshot: ${rows.length}`);
