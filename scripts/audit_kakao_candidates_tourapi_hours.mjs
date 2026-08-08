#!/usr/bin/env node
// 카카오 C 후보가 현재 TourAPI에 존재하는지, 존재하면 운영시간 필드가 있는지 점검한다.
import fs from 'node:fs';

const KEY = process.env.TOURAPI_KEY ?? process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!KEY) throw new Error('TOURAPI_KEY 또는 EXPO_PUBLIC_TOURAPI_KEY가 필요합니다.');

const CANDIDATE_FILE = 'data/processed/review/서면전포_카카오_관광맥락후보.json';
const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const CONTENT_TYPES = ['12', '14', '28', '38', '39'];
const USETIME_FIELD = { '12': 'usetime', '14': 'usetimeculture', '28': 'usetimeleports', '38': 'opentime', '39': 'opentimefood' };

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function haversineM(a, b) {
  const rad = (degree) => degree * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

async function call(operation, params) {
  const query = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    ...params,
  });
  const response = await fetch(`${BASE}/${operation}?${query}`);
  if (!response.ok) throw new Error(`${operation}: HTTP ${response.status}`);
  const body = await response.json();
  let items = body?.response?.body?.items?.item ?? [];
  if (!Array.isArray(items)) items = [items];
  return items;
}

async function loadCurrentBusanTourApi() {
  const rows = [];
  for (const contentTypeId of CONTENT_TYPES) {
    let pageNo = 1;
    while (true) {
      const items = await call('areaBasedList2', { areaCode: '6', contentTypeId, numOfRows: '1000', pageNo: String(pageNo), arrange: 'A' });
      rows.push(...items.map((item) => ({
        contentId: String(item.contentid),
        contentTypeId: String(item.contenttypeid ?? contentTypeId),
        title: String(item.title ?? '').trim(),
        lat: Number(item.mapy),
        lon: Number(item.mapx),
      })).filter((item) => item.title && Number.isFinite(item.lat) && Number.isFinite(item.lon)));
      if (items.length < 1000) break;
      pageNo += 1;
    }
  }
  return rows;
}

const candidates = JSON.parse(fs.readFileSync(CANDIDATE_FILE, 'utf8')).data;
const tourApiRows = await loadCurrentBusanTourApi();
const overlaps = [];

for (const candidate of candidates) {
  const candidateName = normalize(candidate.title);
  for (const tour of tourApiRows) {
    const tourName = normalize(tour.title);
    const sameName = candidateName && tourName && (
      candidateName === tourName
      || (candidateName.length >= 4 && tourName.length >= 4 && (candidateName.includes(tourName) || tourName.includes(candidateName)))
    );
    if (!sameName || haversineM(candidate, tour) > 300) continue;
    overlaps.push({ candidate, tour });
  }
}

const result = [];
for (const { candidate, tour } of overlaps) {
  const [intro] = await call('detailIntro2', { contentId: tour.contentId, contentTypeId: tour.contentTypeId });
  const hours = String(intro?.[USETIME_FIELD[tour.contentTypeId]] ?? '').trim();
  result.push({
    candidate: candidate.title,
    tourapiTitle: tour.title,
    contentId: tour.contentId,
    contentTypeId: tour.contentTypeId,
    distanceM: Math.round(haversineM(candidate, tour)),
    hasOpeningHours: Boolean(hours),
    openingHours: hours || null,
  });
}

console.log(JSON.stringify({
  candidates: candidates.length,
  currentTourApiRows: tourApiRows.length,
  matchedTourApiPlaces: result.length,
  withOpeningHours: result.filter((item) => item.hasOpeningHours).length,
  rows: result,
}, null, 2));
