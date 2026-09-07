#!/usr/bin/env node
import fs from 'node:fs';

const SOURCE_CATALOG = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/사진_이용허락_허용목록.json';
const TOURAPI_IMAGE_AUDIT = 'data/processed/review/현재사용_TourAPI_대표이미지_감사.json';
const TOURAPI_IMAGE_VALIDATIONS = [
  'data/processed/review/현재사용_TourAPI_대표이미지_HTTPS검증.json',
  'data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증결과.json',
];
const OFFICIAL_FILES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
};
const SERVICE_PERMISSIONS = {
  busan_attraction: {
    permissionBasis: 'api_service',
    serviceName: '부산광역시_부산명소정보 서비스',
    status: 'verified',
    rightsHolder: '부산광역시',
    sourcePageUrl: 'https://www.data.go.kr/data/15063481/openapi.do',
    licenseName: '이용허락범위 제한 없음',
    licenseUrl: 'https://www.data.go.kr/data/15063481/openapi.do',
    attribution: '사진 제공: 부산광역시 부산명소정보 서비스',
    attributionRequired: false,
    displayConditions: '공식 서비스는 이미지 URL을 제공하며 이용허락범위 제한 없음. 출처 정보는 장소 상세에서 표시 가능.',
    commercialUseAllowed: true,
    modificationAllowed: true,
    verifiedAt: '2026-09-07',
  },
  busan_food: {
    permissionBasis: 'api_service',
    serviceName: '부산광역시_부산맛집정보 서비스',
    status: 'verified',
    rightsHolder: '부산광역시',
    sourcePageUrl: 'https://www.data.go.kr/data/15063472/openapi.do',
    licenseName: '이용허락범위 제한 없음',
    licenseUrl: 'https://www.data.go.kr/data/15063472/openapi.do',
    attribution: '사진 제공: 부산광역시 부산맛집정보 서비스',
    attributionRequired: false,
    displayConditions: '공식 서비스는 여행사진·이미지 정보를 제공하며 이용허락범위 제한 없음. 출처 정보는 장소 상세에서 표시 가능.',
    commercialUseAllowed: true,
    modificationAllowed: true,
    verifiedAt: '2026-09-07',
  },
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = (payload) => Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
const active = read(SOURCE_CATALOG).data.filter((place) => ['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification));
const officialBySource = Object.fromEntries(Object.entries(OFFICIAL_FILES).map(([source, file]) => [
  source,
  new Map(rows(read(file)).map((row) => [String(row.UC_SEQ), row])),
]));
const tourapiAudit = read(TOURAPI_IMAGE_AUDIT);
const tourapiAuditByPlace = new Map(tourapiAudit.samples.map((row) => [row.contentId, row]));
const acceptedTourapiByPlace = new Map(TOURAPI_IMAGE_VALIDATIONS.flatMap((file) => rows(read(file)))
  .filter((row) => row.accepted)
  .map((row) => [row.contentId, row]));

function officialCandidate(place) {
  for (const evidence of place.sourceEvidence ?? []) {
    const row = officialBySource[evidence.source]?.get(String(evidence.sourceId));
    const imageUrl = row?.MAIN_IMG_THUMB ?? row?.MAIN_IMG_NORMAL;
    if (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
      return { contentId: place.id, source: evidence.source, sourceId: String(evidence.sourceId), imageUrl };
    }
  }
  return null;
}

function hasTourapiCandidate(place) {
  const evidence = (place.sourceEvidence ?? []).find((row) => row.source === 'tourapi_aihub' || row.source === 'tourapi_fallback');
  if (!evidence) return false;
  const audit = tourapiAuditByPlace.get(place.id);
  const validation = acceptedTourapiByPlace.get(place.id);
  const originalUrl = validation?.originalUrl ?? validation?.image;
  return Boolean(audit && validation
    && String(audit.tourapiContentId) === String(evidence.sourceId)
    && String(validation.tourapiContentId) === String(evidence.sourceId)
    && audit.image === originalUrl
    && validation.finalUrl?.startsWith('https://'));
}

const allowed = [];
const held = { busan_shopping: 0, tourapi: 0 };
let noStoredCandidate = 0;
for (const place of active) {
  const official = officialCandidate(place);
  if (official) {
    const permission = SERVICE_PERMISSIONS[official.source];
    if (permission) allowed.push({ ...official, ...permission });
    else if (official.source === 'busan_shopping') held.busan_shopping += 1;
    continue;
  }
  if (hasTourapiCandidate(place)) held.tourapi += 1;
  else noStoredCandidate += 1;
}

allowed.sort((left, right) => left.contentId.localeCompare(right.contentId));
const allowedBySource = Object.fromEntries(Object.keys(SERVICE_PERMISSIONS).sort().map((source) => [source, allowed.filter((row) => row.source === source).length]));
const storedCandidatePhotos = allowed.length + held.busan_shopping + held.tourapi;
if (active.length !== 369 || allowed.length !== 101 || held.busan_shopping !== 29 || held.tourapi !== 73 || noStoredCandidate !== 166 || storedCandidatePhotos !== 203) {
  throw new Error(`unexpected photo inventory: ${JSON.stringify({ active: active.length, allowed: allowed.length, held, noStoredCandidate, storedCandidatePhotos })}`);
}

const output = {
  meta: {
    contractVersion: 2,
    status: 'partial_api_service_permission_verified',
    generatedAt: '2026-09-07',
    permissionPolicy: 'API 서비스 단위 이용허락을 공통 근거로 인정하되 contentId/source/sourceId/imageUrl을 정확히 연결한다. 서비스 조건이 미확인인 사진은 허용하지 않는다.',
    officialEvidencePages: Object.values(SERVICE_PERMISSIONS).map(({ serviceName, sourcePageUrl, licenseName, verifiedAt }) => ({ serviceName, sourcePageUrl, licenseName, verifiedAt })),
  },
  summary: {
    runtimePlaces: active.length,
    storedCandidatePhotos,
    allowed: allowed.length,
    allowedBySource,
    heldUnconfirmed: held.busan_shopping + held.tourapi,
    heldBySource: held,
    noStoredCandidate,
  },
  data: allowed,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`공식 API 사진 허용목록: 허용 ${allowed.length} (명소 ${allowedBySource.busan_attraction}, 맛집 ${allowedBySource.busan_food}) / 조건 미확인 ${output.summary.heldUnconfirmed} (쇼핑 ${held.busan_shopping}, TourAPI ${held.tourapi}) / 저장 사진 없음 ${noStoredCandidate}`);
