import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createCourseV1CandidateProvider } from '../src/data/courseV1CandidateProvider';
import runtimeCatalog from '../src/data/busan_poi_catalog.json';
import cafeCultureAudit from '../data/processed/review/카페문화시설_세부분류_감사.json';
import photoPermissionAllowlist from '../data/processed/review/사진_이용허락_허용목록.json';

const OUTPUT = 'data/processed/review/출시_사진개인화_데이터_감사.json';
const EXPECTED_PROTECTED_HASH = '9944c5a86051d7d63c8b29d10da069690ff613e211e2ce623731bdb390b79820';
const now = new Date('2026-09-07T10:00:00+09:00');
type AuditedRuntimePlace = {
  contentId: string;
  category: string;
  subCategory?: string;
  classification: string;
  imageUrl?: string;
  imageSource?: string;
  imageEvidence?: { source?: string };
};
const places = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data] as AuditedRuntimePlace[];
const representativeClasses = new Set(['representative_core', 'representative_standard']);
const representativePlaces = places.filter((place) => representativeClasses.has(place.classification));
const provider = createCourseV1CandidateProvider();
const representative = provider.listRepresentativeCandidates(now);
const discovery = provider.listDiscoveryCandidates(now);
const conditionalVisit = provider.listConditionalVisitCandidates(now);
const placeById = new Map(places.map((place) => [place.contentId, place]));

function stripImageFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripImageFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['imageUrl', 'imageSource', 'imageEvidence', 'subCategory', 'generatedAt'].includes(key))
    .map(([key, item]) => [key, stripImageFields(item)]));
}

function coverage(rows: readonly { category?: string; subCategory?: string }[]) {
  const applicable = rows.filter((row) => Boolean(row.category?.trim()) && Boolean(row.subCategory?.trim())).length;
  return { total: rows.length, applicable, missingSubCategory: rows.length - applicable, applicableRatePercent: Number((applicable / rows.length * 100).toFixed(1)) };
}

function byCategory(rows: readonly { category?: string; subCategory?: string }[]) {
  const categories = [...new Set(rows.map((row) => row.category ?? 'missing'))].sort();
  return categories.map((category) => ({ category, ...coverage(rows.filter((row) => (row.category ?? 'missing') === category)) }));
}

function classificationKeyCounts(rows: readonly { category?: string; subCategory?: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.category?.trim() || !row.subCategory?.trim()) continue;
    const key = JSON.stringify([row.category, row.subCategory]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [category, subCategory] = JSON.parse(key) as [string, string];
      return { category, subCategory, count };
    })
    .sort((left, right) => left.category.localeCompare(right.category) || left.subCategory.localeCompare(right.subCategory));
}

function assertExactProjection(rows: readonly { id: string; category?: string; subCategory?: string }[]) {
  for (const candidate of rows) {
    const place = placeById.get(candidate.id);
    assert.ok(place, `${candidate.id}: runtime place missing`);
    assert.equal(candidate.category, place.category, `${candidate.id}: category mismatch`);
    assert.equal(candidate.subCategory, place.subCategory ?? undefined, `${candidate.id}: subCategory mismatch`);
  }
}

assert.equal(places.length, 369);
assert.equal(new Set(places.map((place) => place.contentId)).size, places.length);
assert.equal(places.filter((place) => representativeClasses.has(place.classification)).length, 191);
assert.equal(places.filter((place) => place.classification === 'conditional_more').length, 178);
const exposedPhotos = places.filter((place) => place.imageUrl);
assert.equal(exposedPhotos.length, 101);
assert.equal(exposedPhotos.filter((place) => place.imageEvidence?.source === 'busan_attraction').length, 85);
assert.equal(exposedPhotos.filter((place) => place.imageEvidence?.source === 'busan_food').length, 16);
assert.equal(exposedPhotos.filter((place) => place.imageEvidence?.source === 'busan_shopping').length, 0);
assert.equal(exposedPhotos.filter((place) => place.imageSource === 'tourapi').length, 0);
assert.equal(photoPermissionAllowlist.summary.allowed, exposedPhotos.length);
assertExactProjection(representative);
assertExactProjection(discovery);
assertExactProjection(conditionalVisit);

const protectedHash = crypto.createHash('sha256').update(JSON.stringify(stripImageFields(runtimeCatalog))).digest('hex');
assert.equal(protectedHash, EXPECTED_PROTECTED_HASH);

const classificationCatalogRows = places
  .map(({ contentId, category, subCategory }) => ({ contentId, category, subCategory: subCategory ?? null }))
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const classificationCatalogHash = crypto.createHash('sha256').update(JSON.stringify(classificationCatalogRows)).digest('hex');

const subCategoryCategories = new Map<string, Set<string>>();
for (const place of places.filter((row) => row.subCategory)) {
  const categories = subCategoryCategories.get(place.subCategory!) ?? new Set<string>();
  categories.add(place.category);
  subCategoryCategories.set(place.subCategory!, categories);
}

const audit = {
  meta: {
    taskId: 'DATA-RELEASE-PERSONALIZATION-01',
    asOf: '2026-09-07',
    networkCalls: 0,
  },
  imageSafety: {
    taskStartUniqueRuntimeImages: 203,
    taskStartBySource: { busan_official: 130, tourapi: 73 },
    verifiedApiServices: 2,
    exactApiPermissionPhotoLinks: photoPermissionAllowlist.summary.allowed,
    exposedRuntimeImages: exposedPhotos.length,
    exposedBySource: photoPermissionAllowlist.summary.allowedBySource,
    heldUnconfirmedBySource: photoPermissionAllowlist.summary.heldBySource,
    defaultImageFallbackPlaces: places.length - exposedPhotos.length,
    representativeExposedImages: representativePlaces.filter((place) => place.imageUrl).length,
    representativeFallbackPlaces: representativePlaces.filter((place) => !place.imageUrl).length,
  },
  personalizationCoverage: {
    beforeFollowup: { runtimeApplicable: 231, runtimeMissingSubCategory: 138, representativeApplicable: 74, representativeMissingSubCategory: 117 },
    runtime: { ...coverage(places), byCategory: byCategory(places) },
    representativeProvider: { ...coverage(representative), byCategory: byCategory(representative) },
    discoveryProvider: coverage(discovery),
    conditionalVisitProvider: coverage(conditionalVisit),
    repeatedSubCategoryAcrossCategories: [...subCategoryCategories.entries()]
      .filter(([, categories]) => categories.size > 1)
      .map(([subCategory, categories]) => ({ subCategory, categories: [...categories].sort() }))
      .sort((left, right) => left.subCategory.localeCompare(right.subCategory)),
  },
  dbClassificationContract: {
    version: `runtime-category-subcategory-${classificationCatalogHash.slice(0, 12)}`,
    sha256: classificationCatalogHash,
    identityKey: 'contentId',
    valueFields: ['category', 'subCategory'],
    nullSubCategoryMeans: 'not_applied',
    catalogPlaceCount: classificationCatalogRows.length,
    applicablePlaceCount: coverage(places).applicable,
    missingSubCategoryCount: coverage(places).missingSubCategory,
    distinctApplicableKeyCount: classificationKeyCounts(places).length,
    applicableKeyCounts: classificationKeyCounts(places),
    representativeApplicableKeyCounts: classificationKeyCounts(representative),
  },
  invariants: {
    runtimeTotal: places.length,
    representativeTotal: representative.length,
    conditionalTotal: places.filter((place) => place.classification === 'conditional_more').length,
    discoveryProviderTotal: discovery.length,
    conditionalVisitProviderTotal: conditionalVisit.length,
    authorizedCafeCultureSubCategoryChanges: cafeCultureAudit.summary.changed,
    protectedSemanticHash: protectedHash,
    expectedProtectedSemanticHash: EXPECTED_PROTECTED_HASH,
    protectedSemanticHashMatches: true,
    routeSnapshotResyncRequired: false,
    routeSnapshotReason: 'route snapshot version uses representative IDs and coordinates only; both are unchanged',
  },
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  imageFallback: `${audit.imageSafety.defaultImageFallbackPlaces}/${audit.invariants.runtimeTotal}`,
  runtimePersonalization: coverage(places),
  representativePersonalization: coverage(representative),
  providerCounts: { representative: representative.length, discovery: discovery.length, conditionalVisit: conditionalVisit.length },
}, null, 2));
