#!/usr/bin/env node
// 부산 공공 원천의 장소 분포를 검토하기 위한 비추천용 통합 목록을 만든다.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = 'data';
const OUTPUT = 'data/processed/review/부산_공공장소_통합현황.json';
const EARTH_RADIUS_M = 6_371_000;

const sourceConfigs = [
  {
    source: 'public_facility',
    label: '전국공공시설개방정보표준데이터',
    nameField: '개방시설명',
    parentNameField: '개방장소명',
    addressFields: ['소재지도로명주소', '소재지지번주소'],
    hoursFields: ['평일운영시작시각', '평일운영종료시각', '주말운영시작시각', '주말운영종료시각'],
    imageFields: ['시설사진정보'],
    findFile: (fields) => fields.includes('개방시설명'),
    kind: '공공시설',
    groupChildFacilities: true,
  },
  {
    source: 'urban_park',
    label: '전국도시공원정보표준데이터',
    nameField: '공원명',
    addressFields: ['소재지도로명주소', '소재지지번주소'],
    hoursFields: [],
    imageFields: [],
    findFile: (fields) => fields.includes('공원명'),
    kind: '도시공원',
    groupChildFacilities: false,
  },
  {
    source: 'traditional_market',
    label: '전국전통시장표준데이터',
    nameField: '시장명',
    addressFields: ['소재지도로명주소', '소재지지번주소'],
    hoursFields: [],
    imageFields: [],
    findFile: (fields) => fields.includes('시장명'),
    kind: '전통시장',
    groupChildFacilities: false,
  },
];

function readSource(config) {
  const file = fs.readdirSync(DATA_DIR).find((candidate) => {
    if (!candidate.endsWith('.json')) return false;
    const payload = JSON.parse(fs.readFileSync(path.join(DATA_DIR, candidate), 'utf8'));
    return config.findFile((payload.fields ?? []).map((field) => field.id));
  });
  if (!file) throw new Error(`${config.label} 원본을 찾지 못했습니다.`);

  const payload = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  return { ...config, file, rows: payload.records ?? [] };
}

function text(value) {
  return String(value ?? '').trim();
}

function canonicalName(value) {
  return text(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·ㆍ.,'"!~\-_/&]/g, '');
}

function distanceM(first, second) {
  const rad = (value) => value * Math.PI / 180;
  const lat = rad(second.lat - first.lat);
  const lon = rad(second.lon - first.lon);
  const a = Math.sin(lat / 2) ** 2
    + Math.cos(rad(first.lat)) * Math.cos(rad(second.lat)) * Math.sin(lon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function getAddress(row, fields) {
  return fields.map((field) => text(row[field])).find(Boolean) ?? '';
}

function districtOf(address) {
  return address.match(/부산(?:광역시)?\s+([가-힣]+(?:구|군))/)?.[1] ?? '미상';
}

function isBusan(row, config) {
  const values = [...config.addressFields, '제공기관명'].map((field) => text(row[field]));
  return values.some((value) => value.includes('부산'));
}

function toPlace(row, config) {
  const name = text(row[config.parentNameField]) || text(row[config.nameField]);
  const address = getAddress(row, config.addressFields);
  const lat = Number(row.위도);
  const lon = Number(row.경도);
  const hours = config.hoursFields.filter((field) => text(row[field])).map((field) => ({ field, value: text(row[field]) }));
  const imageUrls = config.imageFields.filter((field) => text(row[field])).map((field) => text(row[field]));

  return {
    name,
    canonicalName: canonicalName(name),
    address,
    district: districtOf(address),
    lat,
    lon,
    kind: config.kind,
    source: config.source,
    sourceLabel: config.label,
    sourceFile: config.file,
    operatingHours: hours,
    operatingHoursStatus: config.hoursFields.length === 0 ? 'not_provided' : hours.length > 0 ? 'provided' : 'missing',
    imageUrls,
    imageStatus: config.imageFields.length === 0 ? 'not_provided' : imageUrls.length > 0 ? 'provided' : 'missing',
    rawRecords: [row],
  };
}

function groupFacilityRows(places) {
  const groups = new Map();
  for (const place of places) {
    const key = [place.canonicalName, place.address, place.lat.toFixed(6), place.lon.toFixed(6)].join('|');
    const group = groups.get(key);
    if (!group) {
      groups.set(key, place);
      continue;
    }
    group.rawRecords.push(...place.rawRecords);
    group.operatingHours.push(...place.operatingHours);
    group.imageUrls.push(...place.imageUrls);
    group.operatingHoursStatus = group.operatingHours.length > 0 ? 'provided' : group.operatingHoursStatus;
    group.imageStatus = group.imageUrls.length > 0 ? 'provided' : group.imageStatus;
  }
  return [...groups.values()];
}

function canMerge(first, second) {
  return first.canonicalName.length > 1
    && first.canonicalName === second.canonicalName
    && Number.isFinite(first.lat)
    && Number.isFinite(first.lon)
    && Number.isFinite(second.lat)
    && Number.isFinite(second.lon)
    && distanceM(first, second) <= 100;
}

function mergePlaces(places) {
  const groups = [];
  for (const place of places) {
    const group = groups.find((candidate) => canMerge(candidate.representative, place));
    if (!group) {
      groups.push({ representative: place, places: [place] });
      continue;
    }
    group.places.push(place);
  }
  return groups.map(({ representative, places }, index) => ({
    placeId: `public_ref_${String(index + 1).padStart(4, '0')}`,
    title: representative.name,
    kind: [...new Set(places.map((place) => place.kind))],
    address: representative.address,
    district: representative.district,
    lat: representative.lat,
    lon: representative.lon,
    operatingHoursStatus: places.some((place) => place.operatingHoursStatus === 'provided')
      ? 'provided'
      : places.some((place) => place.operatingHoursStatus === 'missing')
        ? 'missing'
        : 'not_provided',
    imageStatus: places.some((place) => place.imageStatus === 'provided')
      ? 'provided'
      : places.some((place) => place.imageStatus === 'missing')
        ? 'missing'
        : 'not_provided',
    sourceRecords: places.map((place) => ({
      source: place.source,
      sourceLabel: place.sourceLabel,
      sourceFile: place.sourceFile,
      rawRecordCount: place.rawRecords.length,
      childFacilityNames: [...new Set(place.rawRecords.map((row) => text(row.개방시설명)).filter(Boolean))],
      operatingHours: place.operatingHours,
      imageUrls: [...new Set(place.imageUrls)],
    })),
    recommendationStatus: 'reference_only',
    reason: '공공 원천의 위치·공식성·중복 검토용이다. 자투리 활동 적합성, 실제 입장 가능 여부, 체류시간은 아직 판정하지 않았다.',
  }));
}

function countBy(items, selector) {
  return items.reduce((result, item) => {
    const key = selector(item);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

const sources = sourceConfigs.map(readSource);
const sourceSummary = {};
const places = [];
for (const source of sources) {
  const busanRows = source.rows.filter((row) => isBusan(row, source));
  let sourcePlaces = busanRows.map((row) => toPlace(row, source));
  if (source.groupChildFacilities) sourcePlaces = groupFacilityRows(sourcePlaces);
  sourceSummary[source.source] = {
    label: source.label,
    sourceFile: path.join(DATA_DIR, source.file),
    nationwideRawRows: source.rows.length,
    busanRawRows: busanRows.length,
    busanPlaceGroupsBeforeCrossSourceMerge: sourcePlaces.length,
    operatingHoursField: source.hoursFields.length > 0 ? 'provided_by_source' : 'not_provided_by_source',
    imageField: source.imageFields.length > 0 ? 'provided_by_source' : 'not_provided_by_source',
  };
  places.push(...sourcePlaces);
}

const merged = mergePlaces(places);
const byAvailability = countBy(merged, (place) => `${place.operatingHoursStatus}|${place.imageStatus}`);
const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    purpose: '부산 공공 원천 장소의 지역 분포·중복·정보 충족 현황 검토용. 앱 추천 후보로 사용하지 않는다.',
    scope: ['전국공공시설개방정보표준데이터', '전국도시공원정보표준데이터', '전국전통시장표준데이터'],
    mergeRule: '공공시설은 같은 개방장소명·주소·좌표의 하위 시설을 하나로 묶는다. 원천 간 병합은 정규화한 이름이 같고 좌표가 100m 이내일 때만 수행한다.',
    nonMergeRule: '이름이 비슷하거나 같은 주소여도 서로 다른 시설·공원·시장일 수 있으므로 자동 병합하지 않는다.',
  },
  summary: {
    sourceSummary,
    totalPlaceGroupsBeforeCrossSourceMerge: places.length,
    totalDistinctPlaces: merged.length,
    mergedDuplicateGroupCount: places.length - merged.length,
    byDistrict: countBy(merged, (place) => place.district),
    byKind: merged.reduce((result, place) => {
      for (const kind of place.kind) result[kind] = (result[kind] ?? 0) + 1;
      return result;
    }, {}),
    byOperatingHoursAndImage: byAvailability,
  },
  places: merged,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`부산 공공 장소 ${merged.length}개 -> ${OUTPUT}`);
