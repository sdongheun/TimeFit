// 시간-적합 플래너 (결정적). 스파이크 engine_spike.mjs 로직 이식.
import { Course, LatLon, Mode, MobilityOption, PlanInput, PlanResult, RoadMode, Spot, Strategy } from './types';
import { listBusanPoiCandidates } from './data';
import { detailIntro, isOpenDuring, isOpenDuringText } from './tourapi';
import { haversineMin, precompute, precomputeTransit, transitMeta, travelGeo, travelMin, travelSrc } from './travel';
import { hasBalancedPaidVisit, isPaidFacilityLike, isTravelHeavyBrowse, minimumStayForCourse, safetyBufferMin } from './recommendationPolicy';
import { areaAvailabilityDuring } from './areaAvailability';
import { automaticLegMode } from './mixedTravel';
import { createActualRouteSearchScope, isPointInActualRouteSearchScope, strategyForActualRoutePoint } from './actualRouteSearchScope';
import { passesLocalOpeningGate } from './localOpeningGate';

const ROAD_MODES: RoadMode[] = ['walk', 'car'];
const INITIAL_TMAP_REFINE_COUNT = 0;
const INITIAL_RESULT_COUNT = 10;
const TRANSIT_REFINE_COUNT = 18;
const RANKING_VARIATION_WINDOW = 0.035;
// 추천 목록은 경로 API를 호출하지 않으므로, 근사 이동시간 오차를 운영시간 판단에 보수적으로 반영한다.
const CANDIDATE_OPENING_MARGIN_MIN = 10;
const STRATEGY_LABEL: Record<Strategy, string> = {
  origin_area: '출발지 근처',
  destination_area: '약속지 근처',
  route_area: '가는 길 중간',
};
export async function planTimeFit(input: PlanInput): Promise<PlanResult> {
  const primaryMode = input.mode;
  const candidateModes = normalizedCandidateModes(input.candidateModes, primaryMode);
  const radiusM = input.radiusM ?? radiusFor(primaryMode, input.remainingMin);
  const buffer = safetyBufferMin(primaryMode);
  const budget = input.remainingMin - buffer;
  const target: LatLon = input.destination ?? input.origin;

  // 1) 후보: 실제 기준 경로 주변(또는 왕복/전체실패 생활권)만 수집한다.
  // 철회한 직선 중간점·넓은 원 범위는 여기서 사용하지 않는다.
  const cands: Spot[] = [];
  const seenCand = new Map<string, Spot>();
  const seenTourApi = new Set<string>();
  const searchScope = createActualRouteSearchScope({
    origin: input.origin,
    destination: input.destination ?? null,
    radiusM,
    baselines: input.routeBaselines,
  });
  for (const { place, dwell: d } of listBusanPoiCandidates()) {
    if (!isPointInActualRouteSearchScope(place, searchScope)) continue;
    if (place.tourapiContentId) seenTourApi.add(place.tourapiContentId);
    const contentId = place.contentId;
    const spot: Spot = {
      title: place.title, contentId, typeId: place.contentTypeId, category: d.category, subCategory: d.subCategory, availabilityProfile: d.availabilityProfile,
      siteGroupId: d.siteGroupId, siteRole: d.siteRole,
      lat: place.lat, lon: place.lon, dwell: d.eff, dwellBase: d.base, dwellSrc: d.src, mult: d.mult,
      dwellSourceName: d.dwellSourceName,
      openingHoursSourceName: d.openingHoursSourceName,
      openingHoursReliability: d.openingHoursReliability,
      matchScope: d.matchScope,
      mapVerificationStatus: d.mapVerificationStatus,
      kakaoPlaceId: d.kakaoPlaceId,
      kakaoPlaceUrl: d.kakaoPlaceUrl,
      mapVerificationName: d.mapVerificationName,
      mapVerificationDistanceM: d.mapVerificationDistanceM,
      tourapiContentId: d.tourapiContentId,
      tourapiContentTypeId: d.tourapiContentTypeId,
      operatingHours: d.operatingHours,
      imageUrl: d.imageUrl,
      openNote: '', confidence: d.confidence, strategy: strategyForActualRoutePoint(place, searchScope),
    };
    seenCand.set(contentId, spot);
  }
  cands.push(...seenCand.values());

  // 지도 탐색은 최대 공간 후보 중 시간·로컬 운영시간을 통과한 장소만 전달한다.
  // 외부 TourAPI 상세 호출은 하지 않으며, 장바구니 추가 시 실제 경로·운영시간으로 다시 확정한다.
  if (input.mapExploration) {
    const visibleCandidates = cands.filter((spot) => candidateModes.some((mode) =>
      isTimeFeasibleForMode(spot, input.origin, target, input.remainingMin, mode)
      && passesLocalOpeningGate({
        spot,
        origin: input.origin,
        mode,
        nowMin: input.nowMin,
        arrivalMarginMin: CANDIDATE_OPENING_MARGIN_MIN,
      }),
    ));
    return {
      budgetMin: budget,
      bufferMin: buffer,
      tourApiCount: seenTourApi.size,
      candidateCount: cands.length,
      eligibleCount: visibleCandidates.length,
      openingCheckCount: cands.length,
      gatedCount: visibleCandidates.length,
      tmapOk: 0,
      tmapFail: 0,
      courses: [],
      pending: [],
      spatialCandidates: visibleCandidates,
      routeBaselines: input.routeBaselines ?? [],
      searchRadiusM: radiusM,
    };
  }

  // 2) haversine 프리필터: 짧은 자투리 시간에는 카페/상업지구/가벼운 구경 장소를 더 유연하게 유지
  const pre = cands.flatMap((spot) => {
    const mode = firstFeasibleMode([spot], input.origin, target, input.remainingMin, candidateModes);
    return mode ? [{ spot, mode }] : [];
  });
  const gateQueue = prioritizeOpeningGate(pre, input.origin, input.destination ?? null, input.hourBucket, input.remainingMin);

  // 3) 운영시간 게이트 (TourAPI 원본이 있는 상위 후보만 detailIntro2)
  const gated: CandidateSeed[] = [];
  const openingTargets = gateQueue.slice(0, gateLimitFor(candidateModes, input.remainingMin));
  if (input.deferOpeningGate) {
    // 후보 풀 비교용. 실제 앱 추천에서는 항상 아래 상세 운영시간 게이트를 사용한다.
    gated.push(...openingTargets.map(({ spot, mode }) => ({ spot: { ...spot, openNote: '운영시간 자동진단 생략' }, mode })));
  } else {
    for (const { spot: s, mode } of openingTargets) {
      const start = input.nowMin + haversineMin(input.origin, s, mode) + CANDIDATE_OPENING_MARGIN_MIN;
      const areaAvailability = areaAvailabilityDuring(s, start, s.dwell);
      if (areaAvailability) {
        if (areaAvailability.ok) gated.push({ spot: { ...s, openNote: areaAvailability.note }, mode });
        continue;
      }
      if (!s.tourapiContentId || !s.tourapiContentTypeId) {
        const officialHours = s.operatingHours?.[0];
        const g = isOpenDuringText(officialHours, start, s.dwell, isPaidFacilityLike(s));
        if (g.ok) gated.push({ spot: { ...s, openNote: officialHours ? `공식 운영시간: ${g.note}` : g.note }, mode });
        continue;
      }
      const intro = await detailIntro(s.tourapiContentId, s.tourapiContentTypeId);
      const g = isOpenDuring(intro, s.tourapiContentTypeId, start, s.dwell, undefined, isPaidFacilityLike(s));
      if (g.ok) gated.push({ spot: { ...s, openNote: g.note }, mode });
    }
  }

  // 4) 시간적응형 코스 조립 — 이 단계는 haversine 추정만 사용 (TMAP 미호출)
  //    지연 정밀화: 상위 후보에만 TMAP 호출(5단계) → 추천 1회 ~54건 → ~10여건 (합산 1,000/일 한도 대응)
  const courses: Course[] = [];
  const pool = gated.slice(0, 12);
  for (const { spot, mode } of gated) {
    const c = buildCourse([spot], input.origin, target, !!input.destination, input.remainingMin, mode);
    if (c) courses.push({ ...c, type: '단일', strategy: spot.strategy });
  }
  // 지도 우선 탐색은 사용자가 장바구니에서 조합한다. 여기서 특정 수단의
  // 미니코스를 먼저 만들면 후보 풀이 다시 단일 수단에 묶이므로 생략한다.
  if (candidateModes.length === 1) for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
    if (i === j) continue;
    const first = pool[i];
    const second = pool[j];
    const base = buildCourse([first.spot], input.origin, target, !!input.destination, input.remainingMin, first.mode);
    if (!base || slackOf(base, first.mode) < 35) continue;
    if (!isAllowedPairDistance(first.spot, second.spot, first.mode, input.remainingMin, slackOf(base, first.mode))) continue;
    if (!isAllowedPair(first.spot, second.spot)) continue;
    const c = buildCourse([first.spot, second.spot], input.origin, target, !!input.destination, input.remainingMin, first.mode);
    if (c) {
      courses.push({ ...c, type: '미니코스', strategy: first.spot.strategy });
    }
  }

  // 랭킹 v1 — 결정적 점수 함수 + 그리디 다양성 (추천로직.md §4)
  const ranked = stabilizeVisibleMix(
    rankCourses(courses, budget, input.hourBucket, primaryMode, input.remainingMin, input.origin, input.destination ?? null),
    input.remainingMin,
  );

  // 5) 지연 정밀화 — API 사용량 보호를 위해 추천 목록에서는 TMAP 경로 API를 호출하지 않는다.
  //    나머지는 haversine 추정값으로 먼저 보여주고, 상세/확정 단계에서 정밀화하는 구조로 확장한다.
  const r = candidateModes.length === 1 && primaryMode === 'transit' && !input.deferTransitRefinement
    ? await refineTransitCandidates(ranked, input.origin, input.destination ?? null, input.remainingMin, input.hourBucket, budget)
    : await refineCourses(ranked, input.origin, input.destination ?? null, input.mode, input.remainingMin, INITIAL_TMAP_REFINE_COUNT);
  const visibleCourses = [...r.courses, ...r.rest.slice(0, Math.max(0, INITIAL_RESULT_COUNT - r.courses.length))];
  const pendingCourses = r.rest.slice(Math.max(0, INITIAL_RESULT_COUNT - r.courses.length));

  return {
    budgetMin: budget, bufferMin: buffer, tourApiCount: seenTourApi.size, candidateCount: cands.length,
    eligibleCount: pre.length,
    openingCheckCount: openingTargets.length,
    gatedCount: gated.length, tmapOk: r.ok, tmapFail: r.fail, courses: visibleCourses, pending: pendingCourses,
    spatialCandidates: cands,
    routeBaselines: input.routeBaselines ?? [],
    searchRadiusM: radiusM,
  };
}

export type CourseOpeningValidation = {
  ok: boolean;
  exactRoute: boolean;
  reason?: string;
};

// 장바구니 확정 직전: 이미 정밀화한 선택 구간의 실제 이동시간을 누적해 각 장소의 체류 종료시각을 다시 검사한다.
export async function validateCourseOpening(
  spots: Spot[], origin: LatLon, target: LatLon, mode: Mode | Mode[], startMin: number, stayMins: number[],
): Promise<CourseOpeningValidation> {
  let current = origin;
  let visitStart = startMin;
  let exactRoute = true;

  for (let index = 0; index < spots.length; index++) {
    const spot = spots[index];
    const legMode = Array.isArray(mode) ? mode[index] ?? 'transit' : mode;
    const src = travelSrc(current, spot, legMode);
    const isExact = legMode === 'transit'
      ? src === 'ODsay' || src === 'walk_short'
      : src === 'TMAP';
    if (!isExact) exactRoute = false;

    visitStart += travelMin(current, spot, legMode);
    const dwell = Math.max(0, stayMins[index] ?? spot.dwell);
    const areaAvailability = areaAvailabilityDuring(spot, visitStart, dwell);
    if (areaAvailability) {
      if (!areaAvailability.ok) return { ok: false, exactRoute, reason: `${spot.title}: ${areaAvailability.note}` };
      current = spot;
      visitStart += dwell;
      continue;
    }

    if (!spot.tourapiContentId || !spot.tourapiContentTypeId) {
      const checked = isOpenDuringText(spot.operatingHours?.[0], visitStart, dwell, isPaidFacilityLike(spot));
      if (!checked.ok) return { ok: false, exactRoute, reason: `${spot.title}: ${checked.note}` };
    } else {
      const intro = await detailIntro(spot.tourapiContentId, spot.tourapiContentTypeId);
      const checked = isOpenDuring(intro, spot.tourapiContentTypeId, visitStart, dwell, undefined, isPaidFacilityLike(spot));
      if (!checked.ok) return { ok: false, exactRoute, reason: `${spot.title}: ${checked.note}` };
    }

    current = spot;
    visitStart += dwell;
  }

  // 약속 장소(또는 왕복 출발지)까지의 마지막 구간도 실제 경로 응답이 있어야 전체 시간 예산을 확정할 수 있다.
  const finalMode = Array.isArray(mode) ? mode[spots.length] ?? 'transit' : mode;
  const finalSrc = travelSrc(current, target, finalMode);
  const finalIsExact = finalMode === 'transit'
    ? finalSrc === 'ODsay' || finalSrc === 'walk_short'
    : finalSrc === 'TMAP';
  if (!finalIsExact) exactRoute = false;

  return { ok: true, exactRoute };
}

async function refineTransitCandidates(
  ranked: Course[],
  origin: LatLon,
  destination: LatLon | null,
  remainingMin: number,
  hourBucket: PlanInput['hourBucket'],
  budget: number,
): Promise<{ courses: Course[]; rest: Course[]; ok: number; fail: number }> {
  const refined = await refineCourses(ranked, origin, destination, 'transit', remainingMin, TRANSIT_REFINE_COUNT);
  const reranked = stabilizeVisibleMix(
    rankCourses(refined.courses, budget, hourBucket, 'transit', remainingMin, origin, destination, refined.courses.length),
    remainingMin,
  );
  return {
    courses: reranked.slice(0, INITIAL_RESULT_COUNT),
    rest: [...reranked.slice(INITIAL_RESULT_COUNT), ...refined.rest],
    ok: refined.ok,
    fail: refined.fail,
  };
}

// ───────────────── 랭킹 v1 (결정적·설명가능) ─────────────────
// score = 0.30·체류여유 + 0.20·체류비율 + 0.20·시간대적합 + 0.15·신뢰도 + 0.15·밀집도 + 보너스/감점
// · 체류비율: 이동 낭비 벌점 — "멀리 걷게 하는 코스가 상위" 왜곡 제거 (A2)
// · 시간대적합: 오후 3시 뷔페 같은 부조화 감점 (A4)
// · 그리디 다양성: 위에서부터 뽑을 때 이미 뽑힌 카테고리는 감점 → 상위 10개 골고루 (A3)
const TIMEFIT: Record<PlanInput['hourBucket'], Record<string, number>> = {
  아침: { 카페: 1.0, 자연관광지: 0.9, '레저/스포츠': 0.7, 문화시설: 0.6, 식당: 0.4 },
  점심: { 식당: 1.0, 카페: 0.7, 문화시설: 0.6, 자연관광지: 0.6, 상업지구: 0.6 },
  오후: { 자연관광지: 1.0, 문화시설: 1.0, 상업지구: 0.9, '레저/스포츠': 0.9, '지역축제/행사': 0.9, 카페: 0.8, 식당: 0.4 },
  저녁: { 식당: 1.0, '지역축제/행사': 0.9, 카페: 0.8, 상업지구: 0.8, 자연관광지: 0.6 },
  야간: { 카페: 0.8, 상업지구: 0.8, '지역축제/행사': 0.8, 식당: 0.7, 자연관광지: 0.6 },
};
const timeFitOf = (bucket: PlanInput['hourBucket'], category: string) => TIMEFIT[bucket]?.[category] ?? 0.6;

function radiusFor(mode: Mode, remainingMin: number): number {
  if (mode === 'transit') {
    if (remainingMin <= 60) return 1500;
    if (remainingMin <= 120) return 3000;
    return 6000;
  }
  if (mode === 'walk') {
    if (remainingMin <= 60) return 1000;
    if (remainingMin <= 120) return 1000;
    return 1500;
  }
  if (remainingMin <= 60) return 2000;
  if (remainingMin <= 120) return 4000;
  return 8000;
}

function rankCourses(
  courses: Course[], budget: number, bucket: PlanInput['hourBucket'], primaryMode: Mode, remainingMin: number,
  origin: LatLon, destination: LatLon | null, cap = 24,
): Course[] {
  const scored = courses.map((c) => {
    const scoreMode = c.bestMode ?? primaryMode;
    const primary = c.mobility?.[scoreMode];
    const bestStay = primary?.stayMin ?? 0;
    const bestMove = primary?.moveMin ?? Infinity;
    const dwell = Math.min(c.spots.reduce((n, s) => n + s.dwell, 0), bestStay);
    const ratio = dwell / Math.max(bestMove + dwell, 1);                // 체류비율(이동낭비 벌점)
    const fit = c.spots.reduce((n, s) => n + timeFitOf(bucket, s.category), 0) / c.spots.length; // 시간대적합
    const conf = c.spots.reduce((n, s) => n + confidenceScore(s.confidence), 0) / c.spots.length;
    const compact = c.spots.length === 1 ? 0.7 : Math.max(0, 1 - haversineMin(c.spots[0], c.spots[1], 'walk') / 12);
    const minStay = minimumStayForCourse(c.spots, approachMins(c.spots, origin, scoreMode));
    const carOnlyPenalty = scoreMode === 'walk' && (c.mobility?.walk?.stayMin ?? 0) < minStay && (c.mobility?.car?.stayMin ?? 0) >= minStay ? 0.12 : 0;
    const fallbackOnlyPenalty = c.spots.every((s) => s.confidence === 'category_fallback') ? 0.12 : 0;
    const openingReliabilityPenalty = c.spots.reduce((n, s) => n + openingReliabilityPenaltyOf(s.openingHoursReliability), 0) / c.spots.length;
    const mapVerificationPenalty = c.spots.reduce((n, s) => n + mapVerificationPenaltyOf(s.mapVerificationStatus), 0) / c.spots.length;
    const duplicatePairPenalty = c.spots.length === 2 && c.spots[0].category === c.spots[1].category ? 0.08 : 0;
    const strategyBonus = c.strategy === 'destination_area' ? 0.04 : c.strategy === 'route_area' ? 0.03 : 0;
    const shortGapBonus = budget <= 60 ? shortGapCategoryBonus(c) : 0;
    const transitRailBonus = scoreMode === 'transit' && hasSubwayLeg(c) ? 0.06 : 0;
    const transitReliabilityPenalty = scoreMode === 'transit' ? transitFallbackPenalty(c) : 0;
    const movement = routeMovementOverhead(c.spots, origin, destination, scoreMode, budget);
    // 이동 효율은 후보를 제외하지 않는다. 전체 시간에서 추가 이동이 차지하는 비중만 순위에 반영한다.
    const movementPenalty = movement.addedShare * 0.14;
    const browseImbalancePenalty = isTravelHeavyBrowse(c.spots, dwell, movement.addedMove) ? 0.05 : 0;
    const score = 0.3 * Math.min(1, bestStay / 60) + 0.2 * ratio + 0.2 * fit + 0.15 * conf + 0.15 * compact
      + strategyBonus + shortGapBonus + transitRailBonus
      - carOnlyPenalty - fallbackOnlyPenalty - openingReliabilityPenalty - mapVerificationPenalty - duplicatePairPenalty - transitReliabilityPenalty - movementPenalty - browseImbalancePenalty;
    const modeLabel = scoreMode === 'car' ? '차량' : scoreMode === 'transit' ? '대중교통' : '도보';
    const movementNote = movement.addedMove > 0 ? ` · 추가 이동 ${movement.addedMove}분` : '';
    const why = `${c.strategy ? STRATEGY_LABEL[c.strategy] + ' · ' : ''}${modeLabel} 기준 체류가능 ${bestStay}분 · ${bucket} 적합 ${Math.round(fit * 100)}%${movementNote}`;
    return { c: { ...c, rankingScore: score, why }, score };
  });
  // 그리디 선택: 매 단계 (점수 − 이미 뽑힌 카테고리 중복 벌점) 최대를 뽑음
  const ranked: Course[] = [];
  const catCnt: Record<string, number> = {};
  const seen = new Set<string>();
  while (ranked.length < cap && scored.length) {
    let bv = -Infinity;
    const values = scored.map((item) => {
      const pen = item.c.spots.reduce((p, s) => p + (catCnt[s.category] ?? 0), 0) * 0.15;
      const v = item.score - pen;
      if (v > bv) bv = v;
      return v;
    });
    const nearBest = values
      .map((v, i) => ({ v, i }))
      .filter((x) => bv - x.v <= RANKING_VARIATION_WINDOW);
    const bi = nearBest[Math.floor(Math.random() * nearBest.length)]?.i ?? 0;
    const { c } = scored.splice(bi, 1)[0];
    const k = c.spots.map((s) => s.title).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    ranked.push(c);
    c.spots.forEach((s) => { catCnt[s.category] = (catCnt[s.category] ?? 0) + 1; });
  }
  return ranked;
}

function confidenceScore(confidence: Spot['confidence']): number {
  if (confidence === 'direct_match') return 1;
  if (confidence === 'area_context_match') return 0.85;
  return 0.7;
}

function openingReliabilityPenaltyOf(reliability: Spot['openingHoursReliability']): number {
  if (reliability === 'area_uncertain') return 0.03;
  if (reliability === 'unknown') return 0.04;
  return 0;
}

function mapVerificationPenaltyOf(status: Spot['mapVerificationStatus']): number {
  if (status === 'weak') return 0.05;
  if (status === 'unverified') return 0.08;
  return 0;
}

function transitFallbackPenalty(course: Course): number {
  const movement = course.legs.filter((leg) => !leg.label.startsWith('체류'));
  if (!movement.length) return 0;
  const fallback = movement.filter((leg) => leg.src === 'transit_fallback').length;
  const odsay = movement.filter((leg) => leg.src === 'ODsay').length;
  if (!fallback) return 0;
  return Math.min(0.08, fallback * 0.035 + (odsay === 0 ? 0.035 : 0));
}

function stabilizeVisibleMix(ranked: Course[], remainingMin: number): Course[] {
  if (remainingMin < 90) return ranked;
  const visible = ranked.slice(0, INITIAL_RESULT_COUNT);
  if (visible.some((c) => c.type === '미니코스')) return ranked;
  const miniIdx = ranked.findIndex((c, i) => i >= INITIAL_RESULT_COUNT && c.type === '미니코스');
  if (miniIdx < 0) return ranked;
  const mini = ranked[miniIdx];
  return [
    ...ranked.slice(0, INITIAL_RESULT_COUNT - 1),
    mini,
    ...ranked.slice(INITIAL_RESULT_COUNT, miniIdx),
    ...ranked.slice(miniIdx + 1),
  ];
}

// 구간 시간/경로 조립 — precompute 이후 호출하면 TMAP 정밀값+실경로, 아니면 haversine 추정
type CandidateSeed = { spot: Spot; mode: Mode };

function normalizedCandidateModes(modes: Mode[] | undefined, fallback: Mode): Mode[] {
  const allowed: Mode[] = ['walk', 'transit', 'car'];
  const unique = [...new Set((modes?.length ? modes : [fallback]).filter((mode): mode is Mode => allowed.includes(mode)))];
  return unique.length ? unique : [fallback];
}

function firstFeasibleMode(
  spots: Spot[], origin: LatLon, target: LatLon, remainingMin: number, modes: Mode[],
): Mode | null {
  // 도보 -> 대중교통 -> 차량 순서: 차량 보유를 앱이 임의로 가정하지 않는다.
  // 후보·장바구니가 같은 규칙을 쓰도록, 진입 구간만 사용자가 고르고
  // 다음 구간은 ResultsScreen과 동일한 자동 수단으로 계산한다.
  return modes.find((mode) => isTimeFeasibleForMode(spots, origin, target, remainingMin, mode)) ?? null;
}

function isTimeFeasibleForMode(
  spots: Spot | Spot[], origin: LatLon, target: LatLon, remainingMin: number, mode: Mode,
): boolean {
  const list = Array.isArray(spots) ? spots : [spots];
  let current = origin;
  let moveMin = 0;
  let minStay = 0;
  for (const spot of list) {
    const legMode = current === origin ? mode : automaticLegMode(current, spot);
    const approachMin = travelMin(current, spot, legMode);
    moveMin += approachMin;
    minStay += minimumStayForCourse([spot], [approachMin]);
    current = spot;
  }
  const onwardMode = automaticLegMode(current, target);
  moveMin += travelMin(current, target, onwardMode);
  const buffer = Math.max(safetyBufferMin(mode), safetyBufferMin(onwardMode));
  const stayPool = Math.max(0, remainingMin - buffer - moveMin);
  const allocatedStay = Math.min(sumDwell(list), stayPool);
  const directMode = automaticLegMode(origin, target);
  const directMove = origin === target ? 0 : travelMin(origin, target, directMode);
  return stayPool >= minStay
    && hasBalancedPaidVisit(list, allocatedStay, Math.max(0, moveMin - directMove));
}

function gateLimitFor(modes: Mode[], remainingMin: number): number {
  if (modes.length === 1 && modes[0] === 'walk' && remainingMin <= 60) return 28;
  if (remainingMin <= 90) return 22;
  return 16;
}

function prioritizeOpeningGate(
  candidates: CandidateSeed[], origin: LatLon, destination: LatLon | null,
  bucket: PlanInput['hourBucket'], remainingMin: number,
): CandidateSeed[] {
  const scored = candidates.map(({ spot, mode }) => {
    const budget = remainingMin - safetyBufferMin(mode);
    const moveMin = moveOnlyMin([spot], origin, destination ?? origin, mode);
    const minStay = minimumStayForCourse([spot], [travelMin(origin, spot, mode)]);
    const stayMargin = Math.max(0, Math.min(1, (budget - moveMin - minStay) / 60));
    const confidence = confidenceScore(spot.confidence);
    const verification = spot.mapVerificationStatus === 'verified' ? 1 : spot.mapVerificationStatus === 'weak' ? 0.75 : 0.55;
    const openingReliability = spot.openingHoursReliability === 'direct' ? 1 : spot.openingHoursReliability === 'area_uncertain' ? 0.8 : 0.7;
    const movement = routeMovementOverhead([spot], origin, destination, mode, budget);
    const score = 0.3 * stayMargin + 0.2 * timeFitOf(bucket, spot.category)
      + 0.14 * confidence + 0.07 * verification + 0.05 * openingReliability;
    const adjustedScore = score - movement.addedShare * 0.14;
    return { spot, mode, score: adjustedScore };
  });

  const ordered: CandidateSeed[] = [];
  const categoryCount: Record<string, number> = {};
  while (scored.length) {
    scored.sort((a, b) => {
      const aValue = a.score - (categoryCount[a.spot.category] ?? 0) * 0.08;
      const bValue = b.score - (categoryCount[b.spot.category] ?? 0) * 0.08;
      return bValue - aValue || b.score - a.score || a.spot.title.localeCompare(b.spot.title, 'ko');
    });
    const next = scored.shift();
    if (!next) break;
    ordered.push({ spot: next.spot, mode: next.mode });
    categoryCount[next.spot.category] = (categoryCount[next.spot.category] ?? 0) + 1;
  }
  return ordered;
}

function hasStayOpportunity(spots: Spot[], origin: LatLon, target: LatLon, budget: number, mode: Mode): boolean {
  return moveOnlyMin(spots, origin, target, mode) <= budget - minimumStayForCourse(spots, approachMins(spots, origin, mode));
}

function approachMins(spots: Spot[], origin: LatLon, mode: Mode): number[] {
  let current = origin;
  return spots.map((spot) => {
    const min = travelMin(current, spot, mode);
    current = spot;
    return min;
  });
}

function isAllowedPair(a: Spot, b: Spot): boolean {
  if (a.siteGroupId && a.siteGroupId === b.siteGroupId) return false;
  if (a.category === '식당' && b.category === '식당') return false;
  if (a.category === '카페' && b.category === '카페') return false;
  return true;
}

function isAllowedPairDistance(a: Spot, b: Spot, mode: Mode, remainingMin: number, singleSlack: number): boolean {
  const min = haversineMin(a, b, mode);
  if (mode === 'transit') {
    const limit = remainingMin >= 180 || singleSlack >= 60 ? 35 : 24;
    return min <= limit;
  }
  if (mode === 'walk') {
    const limit = remainingMin >= 180 || singleSlack >= 60 ? 18 : 12;
    return min <= limit;
  }
  const limit = remainingMin >= 180 || singleSlack >= 60 ? 25 : 15;
  return min <= limit;
}

function slackOf(course: Omit<Course, 'type'>, mode: Mode): number {
  return course.mobility?.[mode]?.stayMin ?? 0;
}

function moveOnlyMin(spots: Spot[], origin: LatLon, target: LatLon, mode: Mode): number {
  let cur: LatLon = origin, total = 0;
  for (const s of spots) {
    total += travelMin(cur, s, mode);
    cur = s;
  }
  total += travelMin(cur, target, mode);
  return total;
}

function buildCourse(
  spots: Spot[], origin: LatLon, target: LatLon, viaAppointment: boolean, remainingMin: number, primaryMode: Mode,
): Omit<Course, 'type'> | null {
  const buffer = safetyBufferMin(primaryMode);
  const budget = remainingMin - buffer;
  const minStay = minimumStayForCourse(spots, approachMins(spots, origin, primaryMode));
  const modes = Array.from(new Set<Mode>([...ROAD_MODES, primaryMode]));
  const mobility = Object.fromEntries(modes.map((mode) => {
    const moveMin = moveOnlyMin(spots, origin, target, mode);
    const stayMin = Math.max(0, budget - moveMin);
    const allocatedStay = Math.min(sumDwell(spots), stayMin);
    const { legs } = buildCourseLegs(spots, origin, target, mode, viaAppointment, allocatedStay);
    return [mode, {
      mode, moveMin, stayMin, totalMin: moveMin + allocatedStay,
      bufferLeftMin: remainingMin - moveMin - allocatedStay,
      ok: stayMin >= minStay,
      legs,
    } satisfies MobilityOption];
  })) as Record<Mode, MobilityOption>;
  const bestMode = primaryMode;
  const best = mobility[bestMode];
  if (!best.ok) return null;
  const directMove = viaAppointment ? travelMin(origin, target, bestMode) : 0;
  const addedMove = Math.max(0, best.moveMin - directMove);
  const allocatedStay = Math.min(sumDwell(spots), best.stayMin);
  if (!hasBalancedPaidVisit(spots, allocatedStay, addedMove)) return null;
  return { spots, totalMin: best.totalMin, legs: best.legs, bufferLeftMin: best.bufferLeftMin, bestMode, mobility };
}

function shortGapCategoryBonus(course: Course): number {
  if (course.spots.length > 1) return -0.03;
  const category = course.spots[0]?.category;
  if (category === '카페') return 0.08;
  if (category === '상업지구') return 0.06;
  if (category === '문화시설') return 0.04;
  if (category === '자연관광지') return 0.03;
  if (category === '식당') return -0.03;
  return 0;
}

type RouteMovementOverhead = { directMove: number; totalMove: number; addedMove: number; addedShare: number };

// 후보 수집 위치와 무관하게 같은 이동 효율 지표를 쓴다.
// 직행시간을 분모로 쓰지 않아, 가까운 약속장소에서도 정상적으로 동작한다.
function routeMovementOverhead(
  spots: Spot[], origin: LatLon, destination: LatLon | null, mode: Mode, budget: number,
): RouteMovementOverhead {
  const target = destination ?? origin;
  const directMove = destination ? travelMin(origin, destination, mode) : 0;
  const totalMove = moveOnlyMin(spots, origin, target, mode);
  const addedMove = Math.max(0, totalMove - directMove);
  return { directMove, totalMove, addedMove, addedShare: Math.min(1, addedMove / Math.max(budget, 1)) };
}

function sumDwell(spots: Spot[]): number {
  return spots.reduce((n, s) => n + s.dwell, 0);
}

function buildCourseLegs(
  spots: Spot[], origin: LatLon, target: LatLon, mode: PlanInput['mode'], viaAppointment: boolean, allocatedStay?: number,
): { legs: Course['legs']; total: number } {
  const legs: Course['legs'] = [];
  let cur: LatLon = origin, total = 0;
  const dwellTotal = sumDwell(spots);
  let allocatedLeft = allocatedStay ?? dwellTotal;
  spots.forEach((s, k) => {
    const t = travelMin(cur, s, mode);
    const dwell = allocatedStay == null
      ? s.dwell
      : k === spots.length - 1
        ? Math.max(0, allocatedLeft)
        : Math.min(allocatedLeft, Math.round(allocatedStay * (s.dwell / Math.max(dwellTotal, 1))));
    allocatedLeft -= dwell;
    total += t + dwell;
    const meta = mode === 'transit' ? transitMeta(cur, s) : undefined;
    legs.push({ label: `${k === 0 ? '출발' : '이동'} → ${s.title}${meta?.summary ? ` · ${meta.summary}` : ''}`, min: t, src: travelSrc(cur, s, mode), geo: travelGeo(cur, s, mode) });
    legs.push({ label: `체류 가능 · ${s.title}`, min: dwell, src: s.dwellSrc });
    cur = s;
  });
  const back = travelMin(cur, target, mode); total += back;
  const meta = mode === 'transit' ? transitMeta(cur, target) : undefined;
  legs.push({ label: `${viaAppointment ? '다음 스케줄로' : '출발지로 복귀'}${meta?.summary ? ` · ${meta.summary}` : ''}`, min: back, src: travelSrc(cur, target, mode), geo: travelGeo(cur, target, mode) });
  return { legs, total };
}

// 후보 코스 배치 정밀화 — "다른 코스 보기"에서 pending을 이어서 소비 (want개 확정될 때까지)
export async function refineCourses(
  cands: Course[], origin: LatLon, destination: LatLon | null, mode: PlanInput['mode'], remainingMin: number, want = 5,
): Promise<{ courses: Course[]; rest: Course[]; ok: number; fail: number }> {
  const target = destination ?? origin;
  const out: Course[] = [];
  let ok = 0, fail = 0, i = 0;
  for (; i < cands.length && out.length < want; i++) {
    const c = cands[i];
    const pairs: [LatLon, LatLon][] = [];
    let cur: LatLon = origin;
    for (const s of c.spots) { pairs.push([cur, s]); cur = s; }
    pairs.push([cur, target]);
    if (mode === 'transit') {
      const st = await precomputeTransit(pairs);
      ok += st.ok; fail += st.fail;
    } else {
      for (const m of ROAD_MODES) {
        const st = await precompute(pairs, m); // 캐시된 쌍은 재호출 없음
        ok += st.ok; fail += st.fail;
      }
    }
    const rebuilt = buildCourse(c.spots, origin, target, !!destination, remainingMin, mode);
    if (!rebuilt) continue; // 정밀화 후 선택 수단의 최소 체류·이동 대비 체류 규칙을 충족하지 못하면 탈락
    out.push({ ...c, ...rebuilt });
  }
  return { courses: out, rest: cands.slice(i), ok, fail };
}

function hasSubwayLeg(course: Course): boolean {
  return course.legs.some((leg) => leg.src === 'ODsay' && /지하철|부산\s*\d호선|호선/.test(leg.label));
}

// 시각(시) → 시간대 버킷
function hourBucketOf(h: number): PlanInput['hourBucket'] {
  return h < 11 ? '아침' : h < 14 ? '점심' : h < 17 ? '오후' : h < 21 ? '저녁' : '야간';
}
type TimeCtx = { nowMin: number; dayType: PlanInput['dayType']; hourBucket: PlanInput['hourBucket'] };

// 실제 현재 시각
export function timeContext(d: Date): TimeCtx {
  const h = d.getHours();
  const wd = d.getDay();
  return { nowMin: h * 60 + d.getMinutes(), dayType: wd === 0 || wd === 6 ? '주말' : '평일', hourBucket: hourBucketOf(h) };
}

// 테스트용 수동 시각 (시 + 평일/주말 직접 지정)
export function timeContextManual(hour: number, dayType: PlanInput['dayType']): TimeCtx {
  return { nowMin: hour * 60, dayType, hourBucket: hourBucketOf(hour) };
}
