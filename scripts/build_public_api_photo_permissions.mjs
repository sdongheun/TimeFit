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
const OPERATOR_APPROVALS = {
  busan_shopping: {
    permissionBasis: 'operator_decision',
    status: 'operator_approved',
    sourceName: '부산광역시 부산쇼핑정보 서비스',
    attribution: '사진 출처: 부산광역시 부산쇼핑정보 서비스',
    displayConditions: '앱 운영자 표시 결정. 개별 권리·라이선스·변경 허용은 확인되지 않음.',
    approvedAt: '2026-09-16',
  },
  tourapi: {
    permissionBasis: 'operator_decision',
    status: 'operator_approved',
    sourceName: '한국관광공사 TourAPI',
    attribution: '사진 출처: 한국관광공사 TourAPI',
    displayConditions: 'HTTPS 도달성 확인 및 앱 운영자 표시 결정. 개별 사진의 공공누리 유형·권리자·변경 허용은 확인되지 않음.',
    approvedAt: '2026-09-16',
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

function tourapiCandidate(place) {
  const evidence = (place.sourceEvidence ?? []).find((row) => row.source === 'tourapi_aihub' || row.source === 'tourapi_fallback');
  if (!evidence) return null;
  const audit = tourapiAuditByPlace.get(place.id);
  const validation = acceptedTourapiByPlace.get(place.id);
  const originalUrl = validation?.originalUrl ?? validation?.image;
  if (!(audit && validation
    && String(audit.tourapiContentId) === String(evidence.sourceId)
    && String(validation.tourapiContentId) === String(evidence.sourceId)
    && audit.image === originalUrl
    && validation.finalUrl?.startsWith('https://'))) return null;
  return { contentId: place.id, source: 'tourapi', sourceId: String(evidence.sourceId), imageUrl: validation.finalUrl };
}

const allowed = [];
let noStoredCandidate = 0;
for (const place of active) {
  const official = officialCandidate(place);
  if (official) {
    const permission = SERVICE_PERMISSIONS[official.source];
    if (permission) allowed.push({ ...official, ...permission });
    else if (official.source === 'busan_shopping') allowed.push({ ...official, ...OPERATOR_APPROVALS.busan_shopping });
    continue;
  }
  const tourapi = tourapiCandidate(place);
  if (tourapi) allowed.push({ ...tourapi, ...OPERATOR_APPROVALS.tourapi });
  else noStoredCandidate += 1;
}

allowed.sort((left, right) => left.contentId.localeCompare(right.contentId));
const allowedBySource = Object.fromEntries([...Object.keys(SERVICE_PERMISSIONS), ...Object.keys(OPERATOR_APPROVALS)].sort()
  .map((source) => [source, allowed.filter((row) => row.source === source).length]));
const byStatus = Object.fromEntries(['verified', 'operator_approved'].map((status) => [status, allowed.filter((row) => row.status === status).length]));
const rightsUnconfirmedBySource = Object.fromEntries(Object.keys(OPERATOR_APPROVALS).sort()
  .map((source) => [source, allowed.filter((row) => row.source === source && row.status === 'operator_approved').length]));
const storedCandidatePhotos = allowed.length;
if (active.length !== 369 || allowed.length !== 203 || byStatus.verified !== 101 || byStatus.operator_approved !== 102
  || allowedBySource.busan_attraction !== 85 || allowedBySource.busan_food !== 16
  || allowedBySource.busan_shopping !== 29 || allowedBySource.tourapi !== 73 || noStoredCandidate !== 166) {
  throw new Error(`unexpected photo inventory: ${JSON.stringify({ active: active.length, allowed: allowed.length, allowedBySource, byStatus, noStoredCandidate })}`);
}

const output = {
  meta: {
    contractVersion: 3,
    status: 'verified_and_operator_approved',
    generatedAt: '2026-09-16',
    permissionPolicy: '기존 API 서비스 단위 verified 101개를 보존하고, 사용자 결정에 따른 operator_approved 102개를 별도 상태로 표시한다. 모든 행은 contentId/source/sourceId/imageUrl을 정확히 연결하며 operator_approved를 권리·라이선스 검증으로 승격하지 않는다.',
    officialEvidencePages: Object.values(SERVICE_PERMISSIONS).map(({ serviceName, sourcePageUrl, licenseName, verifiedAt }) => ({ serviceName, sourcePageUrl, licenseName, verifiedAt })),
  },
  summary: {
    runtimePlaces: active.length,
    storedCandidatePhotos,
    allowed: allowed.length,
    allowedBySource,
    byStatus,
    rightsUnconfirmed: byStatus.operator_approved,
    rightsUnconfirmedBySource,
    noStoredCandidate,
  },
  data: allowed,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`장소 사진 표시목록: ${allowed.length} (verified ${byStatus.verified}, operator_approved ${byStatus.operator_approved}; 명소 ${allowedBySource.busan_attraction}, 맛집 ${allowedBySource.busan_food}, 쇼핑 ${allowedBySource.busan_shopping}, TourAPI ${allowedBySource.tourapi}) / 기본 이미지 ${noStoredCandidate}`);
