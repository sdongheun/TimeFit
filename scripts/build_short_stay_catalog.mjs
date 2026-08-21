#!/usr/bin/env node
// 기존 부산 카탈로그를 덮어쓰지 않고 자투리 활동 후보를 병렬로 분류한다.
// 자동 분류 결과는 승인 근거가 충분한 장소만 approved, 나머지는 review로 남긴다.
import fs from 'node:fs';

const MATCHED_FILE = 'data/processed/부산_최종매칭장소.json';
const UNMATCHED_FILE = 'data/processed/부산_최종미매칭장소.json';
const TRADITIONAL_MARKET_FILE = 'data/전국전통시장표준데이터.json';
const OUTPUT_FILE = 'data/processed/review/부산_자투리장소_카탈로그_초안.json';
const DECISION_FILE = 'data/processed/review/부산_자투리장소_보류및제외.json';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => {
  fs.mkdirSync(new URL('.', `file://${process.cwd()}/${file}`).pathname, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const normalizeName = (value = '') => String(value)
  .toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  .replace(/[\s·ㆍ,.'"`~!@#$%^&*()_+\-=|\\/:;<>?]/g, '');

function distanceM(first, second) {
  if (![first?.lat, first?.lon, second?.lat, second?.lon].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radians = (value) => value * Math.PI / 180;
  const lat = radians(second.lat - first.lat);
  const lon = radians(second.lon - first.lon);
  const a = Math.sin(lat / 2) ** 2
    + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(lon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a));
}

const templates = {
  scenic_pause: { min: 10, recommended: 15, max: 25, weatherDependency: 'high' },
  walk_break: { min: 15, recommended: 25, max: 45, weatherDependency: 'moderate' },
  quick_browse: { min: 15, recommended: 25, max: 40, weatherDependency: 'none' },
  compact_culture: { min: 20, recommended: 35, max: 60, weatherDependency: 'none' },
  quick_rest: { min: 15, recommended: 25, max: 45, weatherDependency: 'none' },
};

const GENERAL_FOOD = /식당|음식|맛집|분식|국밥|밀면|횟집|복국|갈비|곰탕|칼국수|고기|전복|해장|돼지|라멘|만게츠|텐푸라|포차|주점/;
const QUICK_REST = /카페|커피|제과|베이커리|로스터리|파티세리|디저트/;
const LONG_ACTIVITY = /롯데월드|놀이공원|아쿠아리움|크루즈|케이블카|키자니아|온천|스파|찜질|레포츠|서핑|다이빙|요트|승마|골프|낚시|캠핑|체육공원|빙상장|인라인|무장애숲길|둘레길|등산|연대봉|금정산|아홉산숲/;
const EXCLUDED_FACILITY = /호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|호스텔|콘도|병원|주차장|여객터미널|버스터미널|철도역|기차역|지하철역|교회|성당|사찰|암\(|사\(/;
const OUTDOOR_SCENIC = /해수욕장|해변|수변|해안|동백섬|공원|기찻길|그린레일웨이|산책로|구름산책로|낙조분수|항|바위|전망|광장/;
const BROWSE_AREA = /시장|거리|골목|상가|아울렛|백화점|마켓타운|패션거리|지하도상가|전자종합시장|서점|책방|소품|문구|선물|기념품/;
const CULTURE = /미술관|박물관|역사관|도서관|갤러리|문화|영화의 전당|상상마당|전시|자료실|아트|놀이마루|창비|벡스코|F1963|유적|성지/;
const INVALID_ENTITY = new Set(['그런고로']);

function hasUsableOperatingHours(hours) {
  const text = (hours ?? []).join(' ');
  if (!text || /행사별\s*상이|프로그램별\s*상이|매장별\s*상이|홈페이지\s*참조/.test(text)) return false;
  return /24시간|상시|(?:\d{1,2}:\d{2}|\d{1,2}시)\s*(?:~|∼|-)\s*(?:\d{1,2}:\d{2}|\d{1,2}시)/.test(text);
}

function isFoodCentricArea(place) {
  return ['시장', '거리·골목', '문화마을'].includes(place.scope?.kind)
    && /먹자|양곱창|건어물|수산물|농산물|어묵|먹거리/.test(place.title ?? '');
}

function isExactAihubMatch(place) {
  if (place.aihubMatch?.matchType !== 'name+coord') return false;
  if (!Number.isFinite(place.aihubMatch?.distanceM) || place.aihubMatch.distanceM > 100) return false;
  const aihub = normalizeName(place.aihubMatch.name);
  if (!aihub) return false;
  return [place.title, ...(place.aliases ?? [])].some((name) => normalizeName(name) === aihub);
}

function classify(place) {
  const title = place.title ?? '';
  const text = `${title} ${(place.aliases ?? []).join(' ')}`;
  if (INVALID_ENTITY.has(title)) return { status: 'excluded', reason: 'invalid_or_ambiguous_entity_name' };
  if (isFoodCentricArea(place)) return { status: 'excluded', reason: 'food_centric_area_not_short_stay_activity' };
  if (place.category === '식당' || GENERAL_FOOD.test(text)) return { status: 'excluded', reason: 'general_food_or_queue_risk' };
  if (EXCLUDED_FACILITY.test(text)) return { status: 'excluded', reason: 'non_visit_or_long_term_facility' };
  if (LONG_ACTIVITY.test(text)) return { status: 'excluded', reason: 'long_or_reservation_prone_activity' };
  if (CULTURE.test(text)) return { type: 'compact_culture' };
  if (BROWSE_AREA.test(text)) return { type: 'quick_browse' };
  if (OUTDOOR_SCENIC.test(text)) return { type: 'scenic_pause' };
  if (place.category === '카페' || QUICK_REST.test(text)) return { type: 'quick_rest' };
  return { status: 'review', reason: 'activity_type_not_determinable_from_name_or_official_category' };
}

function dwellRange(place, shortStayType, directAihub) {
  const template = templates[shortStayType];
  if (directAihub && place.dwell?.median > 0) {
    // AIHub 원본에 분위값이 없는 현재 데이터에서는 중앙값만 권장값으로 쓰고,
    // 최소/최대는 활동 유형의 안전한 범위 안에서 정한다.
    const recommended = Math.min(template.max, Math.max(template.min, Math.round(place.dwell.median)));
    return {
      minStayMin: Math.min(template.min, recommended),
      recommendedStayMin: recommended,
      maxStayMin: Math.max(recommended, template.max),
      dwellBasis: 'aihub_exact_name_coord_median_plus_activity_template',
    };
  }
  return {
    minStayMin: template.min,
    recommendedStayMin: template.recommended,
    maxStayMin: template.max,
    dwellBasis: 'activity_template_only',
  };
}

function profile(place, sourceGroup, parentBySiteGroup) {
  const classification = classify(place);
  const directAihub = sourceGroup === 'matched' && isExactAihubMatch(place);
  const hasHours = hasUsableOperatingHours(place.operatingHours);
  const base = {
    id: place.id,
    title: place.title,
    aliases: place.aliases ?? [],
    address: place.address ?? '',
    lat: place.lat,
    lon: place.lon,
    category: place.category,
    sourceGroup,
    sourceEvidence: place.sourceEvidence ?? [],
    scope: place.scope ?? null,
    aihubMatch: place.aihubMatch ?? null,
    operatingHours: place.operatingHours ?? [],
    selectionEvidence: {
      exactAihubMatch: directAihub,
      sourceGroup,
      hasOperatingHours: hasHours,
      checkedAt: new Date().toISOString().slice(0, 10),
    },
  };

  // 시장·거리·공원 등의 내부 지점은 상위 권역이 추천 단위다.
  // 다만 좌표 근접만으로 부모를 추정하지 않고, 기존 정제 데이터의 siteGroup 관계만 사용한다.
  if (place.scope?.type === '내부장소') {
    const parent = place.siteGroupId ? parentBySiteGroup.get(place.siteGroupId) : null;
    if (parent) {
      return {
        ...base,
        selectionStatus: 'excluded',
        decisionReasons: ['represented_by_parent_area'],
        representedBy: { id: parent.id, title: parent.title, category: parent.category },
      };
    }
    return {
      ...base,
      selectionStatus: 'review',
      decisionReasons: ['parent_area_not_found_for_internal_place'],
    };
  }

  if (classification.status === 'excluded') {
    return { ...base, selectionStatus: 'excluded', decisionReasons: [classification.reason] };
  }
  if (!classification.type) {
    return {
      ...base,
      selectionStatus: 'review',
      decisionReasons: [classification.reason ?? 'activity_type_not_determinable'],
    };
  }
  const shortStayType = classification.type;
  const range = dwellRange(place, shortStayType, directAihub);
  const outdoor = shortStayType === 'scenic_pause' || shortStayType === 'walk_break';
  const isParentArea = place.scope?.type === '포괄장소';
  const isQuickRest = shortStayType === 'quick_rest';
  const approve = (directAihub || (isQuickRest && hasHours))
    && (outdoor || hasHours)
    && (shortStayType !== 'quick_browse' || isParentArea || hasHours)
    && classification.status !== 'review';
  const reasons = [];
  if (!directAihub && !isQuickRest) reasons.push('exact_aihub_name_coord_match_required');
  if (isQuickRest && !hasHours) reasons.push('quick_rest_needs_parseable_official_opening_hours');
  if (!outdoor && !hasHours) reasons.push('facility_or_indoor_candidate_needs_opening_hours');
  if (shortStayType === 'quick_browse' && !isParentArea && !hasHours) reasons.push('commercial_area_needs_parent_or_hours_evidence');
  if (classification.status === 'review') reasons.push(classification.reason);
  if (!approve && reasons.length === 0) reasons.push('manual_short_stay_review_required');

  return {
    ...base,
    selectionStatus: approve ? 'approved' : 'review',
    decisionReasons: approve ? ['exact_aihub_name_coord_match', outdoor ? 'outdoor_short_visit_policy' : 'operating_hours_available'] : reasons,
    shortStayType,
    ...range,
    entryExitFriction: shortStayType === 'compact_culture' ? 'medium' : 'low',
    queueRisk: 'not_considered',
    reservationRequired: shortStayType === 'compact_culture' ? 'unknown' : false,
    weatherDependency: templates[shortStayType].weatherDependency,
  };
}

const sourceRows = [
  ...read(MATCHED_FILE).data.map((place) => ({ place, sourceGroup: 'matched' })),
  ...read(UNMATCHED_FILE).data.map((place) => ({ place, sourceGroup: 'unmatched' })),
];
const knownPlaces = sourceRows.map(({ place }) => place);
const knownByCanonicalName = new Map();
for (const place of knownPlaces) {
  for (const name of [place.title, ...(place.aliases ?? [])]) {
    const canonical = normalizeName(name);
    if (!canonical) continue;
    knownByCanonicalName.set(canonical, [...(knownByCanonicalName.get(canonical) ?? []), place]);
  }
}

const marketRows = read(TRADITIONAL_MARKET_FILE).records ?? [];
const additionalMarketRows = marketRows
  .filter((row) => String(row.소재지도로명주소 ?? row.소재지지번주소 ?? row.제공기관명 ?? '').includes('부산'))
  .map((row) => ({
    title: String(row.시장명 ?? '').trim(),
    address: String(row.소재지도로명주소 ?? row.소재지지번주소 ?? '').trim(),
    lat: Number(row.위도),
    lon: Number(row.경도),
    marketType: String(row.시장유형 ?? '').trim(),
    marketCycle: String(row.시장개설주기 ?? '').trim(),
    goods: String(row.취급품목 ?? '').trim(),
  }))
  .filter((market) => market.title && Number.isFinite(market.lat) && Number.isFinite(market.lon))
  .filter((market) => {
    const sameName = knownByCanonicalName.get(normalizeName(market.title)) ?? [];
    return !sameName.some((place) => distanceM(market, place) <= 300);
  })
  .map((market, index) => ({
    place: {
      id: `traditional_market_${String(index + 1).padStart(3, '0')}`,
      title: market.title,
      aliases: [market.title],
      address: market.address,
      lat: market.lat,
      lon: market.lon,
      category: '상업지구',
      sourceEvidence: [{
        source: 'traditional_market_standard',
        sourceId: `${normalizeName(market.title)}:${market.lat.toFixed(6)}:${market.lon.toFixed(6)}`,
      }],
      operatingHours: [],
      holidays: [],
      scope: { type: '포괄장소', kind: '시장', parent: null },
      marketMetadata: { type: market.marketType, cycle: market.marketCycle, goods: market.goods },
    },
    sourceGroup: 'traditional_market_reference',
  }));
sourceRows.push(...additionalMarketRows);
const parentBySiteGroup = new Map(sourceRows
  .filter(({ place }) => place.siteGroupId && place.siteRole === 'parent')
  .map(({ place }) => [place.siteGroupId, place]));
const rows = sourceRows.map(({ place, sourceGroup }) => profile(place, sourceGroup, parentBySiteGroup));
const countBy = (items, selector) => items.reduce((acc, item) => {
  const key = selector(item) ?? 'unknown';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
const approved = rows.filter((item) => item.selectionStatus === 'approved');
const review = rows.filter((item) => item.selectionStatus === 'review');
const excluded = rows.filter((item) => item.selectionStatus === 'excluded');
// 장소 부족을 완화하되, 근거 수준을 숨기지 않는다. 활동 유형과 좌표가 있는 보류만
// 지도 탐색용 조건부 후보로 승격하고, 활동 자체를 설명할 수 없는 후보는 계속 보류한다.
const conditional = review
  .filter((item) => item.shortStayType && Number.isFinite(item.lat) && Number.isFinite(item.lon))
  .map((item) => ({
    ...item,
    selectionStatus: 'conditional',
    candidateTier: 'conditional',
    initialSelectionStatus: 'review',
    availabilityNotice: item.selectionEvidence?.hasOperatingHours
      ? '운영시간은 확인됐지만 개별 체류 근거가 부족합니다.'
      : '운영시간을 카카오맵에서 확인한 뒤 선택하세요.',
    mapSearchUrl: `https://map.kakao.com/link/search/${encodeURIComponent(item.title)}`,
  }));
const remainingReview = review.filter((item) => !conditional.some((candidate) => candidate.id === item.id));

const meta = {
  generatedAt: new Date().toISOString(),
  status: 'parallel_draft_not_used_by_runtime',
  source: '부산_최종매칭장소 + 부산_최종미매칭장소',
  policy: '일반 식당·카페/베이커리 자동추천 제외, 100m 이내 유사명·좌표 단독 AIHub 매칭 불인정, 정확한 이름+좌표 매칭과 활동 적합성 근거를 분리한다.',
};
write(OUTPUT_FILE, {
  meta,
  summary: {
    sourceTotal: rows.length,
    existingSourceTotal: knownPlaces.length,
    addedTraditionalMarketCandidates: additionalMarketRows.length,
    approved: approved.length,
    conditional: conditional.length,
    review: remainingReview.length,
    excluded: excluded.length,
    approvedByType: countBy(approved, (item) => item.shortStayType),
    conditionalByType: countBy(conditional, (item) => item.shortStayType),
    reviewByReason: countBy(remainingReview, (item) => item.decisionReasons?.[0]),
    excludedByReason: countBy(excluded, (item) => item.decisionReasons?.[0]),
  },
  data: [...approved, ...conditional],
});
write(DECISION_FILE, {
  meta,
  summary: { conditional: conditional.length, review: remainingReview.length, excluded: excluded.length },
  conditional,
  review: remainingReview,
  excluded,
});
console.log(`자투리 장소 초안: 승인 ${approved.length}, 조건부 ${conditional.length}, 보류 ${remainingReview.length}, 제외 ${excluded.length}`);
