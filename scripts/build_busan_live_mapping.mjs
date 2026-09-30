#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const SOURCE_MAPPING = 'data/processed/review/live_source_place_mapping_manifest.json';
const OVERLAP_CONTRACT = 'data/processed/review/live_source_overlap_field_contract.json';
const OUTPUT = 'data/processed/review/busan_live_mapping_manifest.json';
const FIXTURE_OUTPUT = 'data/processed/review/busan_live_mapping_fixture.json';
const AUDIT_OUTPUT = 'data/processed/review/busan_live_mapping_audit.json';

const SERVICES = {
  busan_attraction: {
    storedFile: 'data/processed/부산시_명소정보.json',
    serviceName: '부산광역시 부산명소정보 서비스',
    servicePageUrl: 'https://www.data.go.kr/data/15063481/openapi.do',
    operation: 'getAttractionKr',
  },
  busan_food: {
    storedFile: 'data/processed/부산시_맛집정보.json',
    serviceName: '부산광역시 부산맛집정보 서비스',
    servicePageUrl: 'https://www.data.go.kr/data/15063472/openapi.do',
    operation: 'getFoodKr',
  },
  busan_shopping: {
    storedFile: 'data/processed/부산시_쇼핑정보.json',
    serviceName: '부산광역시 부산쇼핑정보 서비스',
    servicePageUrl: 'unknown',
    operation: 'getShoppingKr',
  },
};

const FIELD_CONTRACT = {
  title: ['MAIN_TITLE', 'PLACE', 'MAIN_PLACE', 'TITLE'],
  address: ['ADDR1', 'ADDR2'],
  lat: ['LAT'],
  lon: ['LNG'],
  opening: ['USAGE_DAY_WEEK_AND_TIME', 'USAGE_DAY'],
  closed: ['HLDY_INFO'],
  description: ['ITEMCNTNTS'],
  image: ['MAIN_IMG_NORMAL', 'MAIN_IMG_THUMB'],
  modified: [],
  deleted: [],
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row);
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});

const sourceMapping = read(SOURCE_MAPPING);
const overlapContract = read(OVERLAP_CONTRACT);
const storedSources = Object.fromEntries(Object.entries(SERVICES).map(([provider, service]) => {
  const payload = read(service.storedFile);
  assert.equal(payload.meta.endpoint.endsWith(`/${service.operation}`), true, `${provider}: operation/endpoint mismatch`);
  return [provider, {
    payload,
    byId: new Map(payload.data.map((row) => [String(row.UC_SEQ), row])),
  }];
}));

function fieldsPresent(row) {
  return Object.fromEntries(Object.entries(FIELD_CONTRACT).map(([field, keys]) => [
    field,
    keys.length > 0 && keys.some((key) => present(row[key])),
  ]));
}

const mappings = sourceMapping.data.flatMap((place) => Object.entries(place.busanSourceIds)
  .flatMap(([provider, sourceIds]) => sourceIds.map((sourceId) => {
    const source = storedSources[provider];
    const row = source.byId.get(String(sourceId));
    assert.ok(row, `${place.contentId}: missing ${provider}/${sourceId}`);
    return {
      contentId: place.contentId,
      title: place.title,
      classification: place.classification,
      representative: place.classification !== 'conditional_more',
      provider,
      sourceId: String(sourceId),
      tourapiContentId: place.tourapiContentId,
      overlapsTourapi: Boolean(place.tourapiContentId),
      joinKey: { provider, field: 'UC_SEQ', value: String(sourceId), match: 'exact_only' },
      fieldsPresent: fieldsPresent(row),
    };
  })))
  .sort((left, right) => `${left.provider}:${left.sourceId}:${left.contentId}`
    .localeCompare(`${right.provider}:${right.sourceId}:${right.contentId}`));

const uniquePlaces = new Set(mappings.map((row) => row.contentId));
const representativeMappings = mappings.filter((row) => row.representative);
const representativePlaces = new Set(representativeMappings.map((row) => row.contentId));
const representativeBoth = new Set(representativeMappings.filter((row) => row.overlapsTourapi).map((row) => row.contentId));
const representativeBusanOnly = new Set(representativeMappings.filter((row) => !row.overlapsTourapi).map((row) => row.contentId));

function providerSummary(provider) {
  const service = SERVICES[provider];
  const stored = storedSources[provider].payload;
  const links = mappings.filter((row) => row.provider === provider);
  const representativeLinks = links.filter((row) => row.representative);
  const schemaKeys = [...new Set(stored.data.flatMap((row) => Object.keys(row)))].sort();
  return {
    provider,
    serviceName: service.serviceName,
    servicePageUrl: service.servicePageUrl,
    storedInput: {
      file: service.storedFile,
      generatedAt: stored.meta.generatedAt,
      records: stored.data.length,
      endpoint: stored.meta.endpoint,
      operation: service.operation,
      originalCollectorScript: 'unknown',
      collectorScriptSearchResult: 'no repository script writes this stored input or names its operation',
    },
    requestContract: {
      exactSourceIdRequestSupported: 'unknown',
      exactSourceIdParameter: 'unknown',
      listRequestRequiredForTransition: true,
      paginationRequired: true,
      paginationParameterNames: 'unknown',
      completeListProofRequired: ['all_pages_received', 'no_duplicate_UC_SEQ', 'stable_response_snapshot_id'],
      deletionRule: 'missing UC_SEQ means inactive only after a complete list; partial/error pages never mean deleted',
      modificationRule: 'no stored per-row modified field; compare normalized field digest between complete snapshots',
    },
    identity: {
      sourceIdField: 'UC_SEQ',
      join: 'exact_only',
      schemaContainsSourceId: schemaKeys.includes('UC_SEQ'),
    },
    sourceSchemaKeys: schemaKeys,
    fieldContract: Object.fromEntries(Object.entries(FIELD_CONTRACT).map(([field, keys]) => [field, {
      sourceFields: keys,
      schemaProvidesField: keys.some((key) => schemaKeys.includes(key)),
      mappedLinksWithValue: links.filter((row) => row.fieldsPresent[field]).length,
      mappedLinks: links.length,
      consumption: ['title', 'address', 'lat', 'lon'].includes(field)
        ? 'identity_gate_then_session_fact'
        : field === 'opening' || field === 'closed'
          ? 'opening_normalizer_input_never_product_window'
          : field === 'description'
            ? 'optional_detail_after_exact_identity'
            : field === 'image'
              ? 'exact_url_rights_gate_else_default_image'
              : field === 'modified'
                ? 'unavailable_compare_snapshot_field_digest'
                : 'derive_provider_inactive_only_from_complete_list_absence',
    }])),
    mappedCoverage: {
      all: { places: new Set(links.map((row) => row.contentId)).size, links: links.length },
      representative: {
        places: new Set(representativeLinks.map((row) => row.contentId)).size,
        links: representativeLinks.length,
      },
    },
  };
}

const services = Object.keys(SERVICES).map(providerSummary);

const overlapMergeContract = {
  scope: '20 reviewed TourAPI+Busan places; rules apply only after both exact source IDs pass their identity gates',
  freshnessOrder: [
    'use a field only from an accepted live response in the same session snapshot',
    'when both providers return the field, use a strictly newer comparable per-record modified timestamp',
    'Busan stored/live schema has no verified modified field, so retrieval time alone never makes its value newer',
    'if freshness is not comparable, use semantic equivalence/presence rules below; never apply a provider-wide priority',
  ],
  fields: {
    title: {
      autoMerge: 'normalized values equal, or one value is absent and the present value equals current title/reviewed alias',
      reviewRequired: 'both present and different after normalization, or either fails the reviewed title/alias identity gate',
    },
    address: {
      autoMerge: 'normalized values equal, or only one accepted source provides a non-empty value',
      reviewRequired: 'both present and materially different without a comparable newer modified timestamp',
    },
    latLon: {
      autoMerge: 'coordinate pairs are equal after numeric normalization; if only one pair exists use it after identity validation',
      reviewRequired: 'both pairs exist and differ without a comparable newer modified timestamp; over 100m is also identity conflict',
    },
    opening: {
      autoMerge: 'normalized texts equal, or only one source provides a non-empty value; then pass that text to its normalizer',
      reviewRequired: 'both non-empty texts differ; never concatenate or prefer a provider globally',
    },
    closed: {
      autoMerge: 'normalized texts equal, or only one source explicitly provides a value',
      reviewRequired: 'both explicit values differ; missing is unknown and never means no holiday',
    },
    description: {
      autoMerge: 'normalized texts equal, only one accepted source provides text, or a strictly newer comparable modified timestamp exists',
      reviewRequired: 'both present and different with no comparable field freshness',
    },
    image: {
      autoMerge: 'only the exact URL with an existing rights record may be exposed; identical accepted URLs share provenance',
      reviewRequired: 'changed/different URLs do not merge; show default image until a URL-specific rights decision exists',
    },
    modified: {
      autoMerge: 'never collapse provider timestamps; retain provider-scoped value and field digest',
      reviewRequired: 'invalid or future timestamp; Busan field is currently unavailable',
    },
    deleted: {
      autoMerge: 'retain provider-scoped active/inactive state; place is globally inactive only when every mapped live provider is confirmed inactive by complete lists',
      reviewRequired: 'any incomplete page/error, ID reuse signal, or unresolved identity conflict',
    },
  },
};

const manifest = {
  meta: {
    taskId: 'DATA-BUSAN-LIVE-MAPPING-01',
    contractVersion: 1,
    deterministic: true,
    externalCalls: 0,
    sourceMapping: SOURCE_MAPPING,
    overlapContract: OVERLAP_CONTRACT,
    unknownRule: 'facts not proven by stored metadata or repository history remain unknown',
  },
  summary: {
    busanOfficialPlaces: uniquePlaces.size,
    busanOfficialLinks: mappings.length,
    representative: {
      places: representativePlaces.size,
      links: representativeMappings.length,
      busanOnlyPlaces: representativeBusanOnly.size,
      tourapiAndBusanPlaces: representativeBoth.size,
    },
    allTourapiAndBusanPlaces: overlapContract.summary.overlapPlaces,
    traditionalMarketOnlyOutOfScope: sourceMapping.summary.targetProviderCoverage.traditionalMarketOnly,
    providers: Object.fromEntries(services.map((service) => [service.provider, service.mappedCoverage])),
  },
  services,
  overlapMergeContract,
  mappings,
};

const fixture = {
  meta: { taskId: 'DATA-BUSAN-LIVE-MAPPING-01', fixtureVersion: 1, externalCalls: 0 },
  invariants: {
    busanOfficialPlaces: 132,
    busanOfficialLinks: 133,
    representativePlaces: 109,
    representativeLinks: 110,
    representativeBusanOnlyPlaces: 93,
    representativeTourapiAndBusanPlaces: 16,
    allTourapiAndBusanPlaces: 20,
    traditionalMarketOnlyOutOfScope: 118,
  },
  cases: [
    { id: 'BUSAN-LIVE-EXACT-01', input: 'known provider + exact UC_SEQ', expected: 'join_existing_internal_id' },
    { id: 'BUSAN-LIVE-NEW-01', input: 'unknown UC_SEQ', expected: 'review_required_no_auto_promotion' },
    { id: 'BUSAN-LIVE-PARTIAL-01', input: 'missing mapped UC_SEQ in incomplete/error page set', expected: 'unknown_not_deleted' },
    { id: 'BUSAN-LIVE-DELETED-01', input: 'missing mapped UC_SEQ after complete list proof', expected: 'provider_inactive' },
    { id: 'BUSAN-LIVE-BOTH-EQUAL-01', input: 'TourAPI and Busan live field semantically equal', expected: 'auto_merge_with_both_provenance' },
    { id: 'BUSAN-LIVE-BOTH-CONFLICT-01', input: 'both live values differ and freshness is not comparable', expected: 'review_required_no_provider_wide_priority' },
    { id: 'BUSAN-LIVE-MARKET-SCOPE-01', input: 'traditional_market_standard-only source', expected: 'provider_out_of_scope_unchanged' },
  ],
};

assert.equal(manifest.summary.busanOfficialPlaces, 132);
assert.equal(manifest.summary.busanOfficialLinks, 133);
assert.deepEqual(manifest.summary.representative, {
  places: 109,
  links: 110,
  busanOnlyPlaces: 93,
  tourapiAndBusanPlaces: 16,
});
assert.equal(manifest.summary.allTourapiAndBusanPlaces, 20);
assert.equal(manifest.summary.traditionalMarketOnlyOutOfScope, 118);
assert.equal(new Set(mappings.map((row) => `${row.provider}:${row.sourceId}`)).size, mappings.length);
assert.equal(mappings.every((row) => row.joinKey.match === 'exact_only'), true);
assert.equal(services.every((service) => service.requestContract.exactSourceIdRequestSupported === 'unknown'), true);
assert.equal(services.every((service) => service.requestContract.listRequestRequiredForTransition), true);

const audit = {
  meta: { taskId: 'DATA-BUSAN-LIVE-MAPPING-01', deterministic: true, externalCalls: 0 },
  checks: {
    expectedCoverage: 'passed',
    exactSourceIdsExistInStoredInputs: 'passed',
    duplicateProviderSourceIds: 0,
    representativeCoveragePreserved: 'passed',
    traditionalMarketOnlyOutOfScopePreserved: 'passed',
    originalCollectorScriptIdentified: false,
    exactIdOperationProven: false,
    paginationParameterNamesProven: false,
  },
  hashes: {
    manifest: hash(manifest),
    fixture: hash(fixture),
  },
};

write(OUTPUT, manifest);
write(FIXTURE_OUTPUT, fixture);
write(AUDIT_OUTPUT, audit);

console.log(JSON.stringify({ summary: manifest.summary, checks: audit.checks }, null, 2));
