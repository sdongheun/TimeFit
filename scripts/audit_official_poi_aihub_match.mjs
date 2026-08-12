#!/usr/bin/env node
// 부산시 공식 관광 후보와 AIHub 부산 방문지의 체류시간 매칭률을 감사한다.
import fs from 'node:fs';
import path from 'node:path';

const CANDIDATE_FILE = 'data/processed/review/부산시_공식관광장소_통합후보_검토.json';
const REPORT_FILE = 'data/processed/review/부산시_공식관광장소_AIHub매칭_검토.json';
const CATALOG_FILE = 'src/data/busan_poi_catalog.json';
const AIHUB_ROOT = 'data/aihub_donbu';
const MATCH_RADIUS_M = 150;
const POI_THRESHOLD = 3;

const AIHUB_VIS = {
  1: '자연관광지', 2: '역사/유적/종교', 3: '문화시설', 4: '상업지구',
  5: '레저/스포츠', 6: '테마시설', 7: '산책로/둘레길', 10: '상점',
  11: '식당', 13: '체험활동관광지',
};

const normalize = (value = '') => String(value)
  .replace(/\s+/g, '')
  .replace(/[()\[\]{}・·.,'"`’]/g, '')
  .toLowerCase();

const numberOrNull = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  let row = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(current);
      current = '';
    } else if (character === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else if (character !== '\r') {
      current += character;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  const header = (rows.shift() ?? []).map((value) => value.replace(/^﻿/, ''));
  return rows
    .filter((values) => values.length === header.length)
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]])));
}

function haversineM(a, b) {
  const toRadians = (degree) => degree * Math.PI / 180;
  const earthRadiusM = 6_371_000;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function loadAihubPois() {
  const files = [
    path.join(AIHUB_ROOT, 'training/tn_visit_area_info_방문지정보_F.csv'),
    path.join(AIHUB_ROOT, 'validation/tn_visit_area_info_방문지정보_F.csv'),
  ];
  const pois = new Map();

  for (const file of files) {
    for (const row of parseCsv(file)) {
      const address = String(row.ROAD_NM_ADDR || row.LOTNO_ADDR || '').trim();
      if (!address.startsWith('부산')) continue;

      const category = AIHUB_VIS[Number.parseInt(row.VISIT_AREA_TYPE_CD, 10)];
      const dwell = numberOrNull(row.RESIDENCE_TIME_MIN);
      const lat = numberOrNull(row.Y_COORD);
      const lon = numberOrNull(row.X_COORD);
      const name = String(row.VISIT_AREA_NM || row.POI_NM || '').trim();
      if (!category || dwell == null || dwell <= 0 || dwell > 1440 || lat == null || lon == null || !name) continue;

      const key = normalize(name);
      if (!pois.has(key)) {
        pois.set(key, { key, name, category, dwell: [], lats: [], lons: [], aliases: new Set() });
      }

      const poi = pois.get(key);
      poi.dwell.push(dwell);
      poi.lats.push(lat);
      poi.lons.push(lon);
      poi.aliases.add(name);
      if (row.POI_NM) poi.aliases.add(String(row.POI_NM).trim());
    }
  }

  return [...pois.values()]
    .filter((poi) => poi.dwell.length >= POI_THRESHOLD)
    .map((poi) => ({
      ...poi,
      lat: median(poi.lats),
      lon: median(poi.lons),
      dwell: { count: poi.dwell.length, median: Math.round(median(poi.dwell)) },
    }));
}

function bestMatch(candidate, aihubPois) {
  const locations = candidate.records
    .map((record) => ({
      lat: numberOrNull(record.LAT),
      lon: numberOrNull(record.LNG),
      name: record.PLACE || record.MAIN_TITLE || candidate.title,
      source: record.source,
    }))
    .filter((location) => location.lat != null && location.lon != null);
  const candidateNames = [candidate.title, ...candidate.records.flatMap((record) => [record.MAIN_TITLE, record.PLACE])]
    .filter(Boolean)
    .map(normalize);

  let nameHit = null;
  let coordinateHit = null;

  for (const poi of aihubPois) {
    const nameMatches = candidateNames.includes(poi.key)
      || [...poi.aliases].some((alias) => candidateNames.includes(normalize(alias)));

    if (nameMatches) {
      for (const location of locations) {
        const distanceM = haversineM(location, poi);
        if (!nameHit || distanceM < nameHit.distanceM) nameHit = { poi, location, distanceM };
      }
    }

    for (const location of locations) {
      const distanceM = haversineM(location, poi);
      if (distanceM <= MATCH_RADIUS_M && (!coordinateHit || distanceM < coordinateHit.distanceM)) {
        coordinateHit = { poi, location, distanceM };
      }
    }
  }

  if (nameHit && coordinateHit && nameHit.poi.key === coordinateHit.poi.key) {
    return { ...coordinateHit, matchType: 'name+coord' };
  }

  const choices = [];
  if (nameHit) choices.push({ ...nameHit, matchType: 'name', score: 1000 + nameHit.distanceM });
  if (coordinateHit) choices.push({ ...coordinateHit, matchType: 'coord', score: coordinateHit.distanceM });
  choices.sort((a, b) => a.score - b.score);
  return choices[0] ?? null;
}

const candidateDocument = JSON.parse(fs.readFileSync(CANDIDATE_FILE, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const aihubPois = loadAihubPois();
const stats = { all: { total: 0, matched: 0 }, scope: {}, source: {}, matchTypes: {} };

for (const candidate of candidateDocument.data) {
  const match = bestMatch(candidate, aihubPois);
  candidate.aihubMatch = match
    ? {
      status: 'matched',
      matchType: match.matchType,
      distanceM: Math.round(match.distanceM),
      matchedField: match.location.name,
      aihubName: match.poi.name,
      aihubCategory: match.poi.category,
      dwell: match.poi.dwell,
    }
    : { status: 'unmatched' };

  const scope = candidate.scopeClassification?.type ?? '미분류';
  stats.all.total += 1;
  stats.scope[scope] ||= { total: 0, matched: 0 };
  stats.scope[scope].total += 1;
  for (const source of candidate.sourceTypes) {
    stats.source[source] ||= { total: 0, matched: 0 };
    stats.source[source].total += 1;
  }

  if (!match) continue;
  stats.all.matched += 1;
  stats.scope[scope].matched += 1;
  for (const source of candidate.sourceTypes) stats.source[source].matched += 1;
  stats.matchTypes[match.matchType] = (stats.matchTypes[match.matchType] ?? 0) + 1;
}

const withRate = (value) => ({ ...value, rate: Number((value.matched / value.total * 100).toFixed(1)) });
const existingTourApi = {
  total: catalog.matched.data.length + catalog.unmatched.data.length,
  matched: catalog.matched.data.length,
};
existingTourApi.rate = Number((existingTourApi.matched / existingTourApi.total * 100).toFixed(1));

const summary = {
  matchingRule: `AIHub 부산 허용 방문지, 표본 ${POI_THRESHOLD}건 이상. 후보명 일치 또는 후보 좌표와 AIHub 대표 좌표 ${MATCH_RADIUS_M}m 이내일 때 매칭.`,
  aihubEligiblePois: aihubPois.length,
  officialCandidates: withRate(stats.all),
  byScope: Object.fromEntries(Object.entries(stats.scope).map(([key, value]) => [key, withRate(value)])),
  bySource: Object.fromEntries(Object.entries(stats.source).map(([key, value]) => [key, withRate(value)])),
  matchTypes: stats.matchTypes,
  existingTourApiA: existingTourApi,
  comparison: {
    percentagePointDifference: Number((stats.all.matched / stats.all.total * 100 - existingTourApi.rate).toFixed(1)),
    note: '기존 A 비율은 현재 TourAPI 후보 610개 중 A 122개의 비율이다.',
  },
};

candidateDocument.meta.aihubMatching = summary.matchingRule;
candidateDocument.summary.aihubMatching = summary;
fs.writeFileSync(CANDIDATE_FILE, `${JSON.stringify(candidateDocument, null, 2)}\n`);

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    sourceCandidateFile: CANDIDATE_FILE,
    comparisonBaseline: CATALOG_FILE,
    matchingRule: summary.matchingRule,
  },
  summary,
  data: candidateDocument.data.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    title: candidate.title,
    sourceTypes: candidate.sourceTypes,
    scopeClassification: candidate.scopeClassification,
    aihubMatch: candidate.aihubMatch,
    records: candidate.records.map((record) => ({
      source: record.source,
      UC_SEQ: record.UC_SEQ,
      MAIN_TITLE: record.MAIN_TITLE,
      PLACE: record.PLACE,
      ADDR1: record.ADDR1,
      LAT: record.LAT,
      LNG: record.LNG,
    })),
  })),
};
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
