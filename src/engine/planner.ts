// 시간-적합 플래너 (결정적). 스파이크 engine_spike.mjs 로직 이식.
import { Course, LatLon, Mode, MobilityOption, PlanInput, PlanResult, RoadMode, Spot, Strategy } from './types';
import { resolveBusanDwell } from './data';
import { detailIntro, isOpenDuring, locationBased } from './tourapi';
import { haversineMin, precompute, precomputeTransit, transitMeta, travelGeo, travelMin, travelSrc } from './travel';

const ROAD_MODES: RoadMode[] = ['walk', 'car'];
const DEFAULT_MIN_STAY_MIN = 30;
const HARD_DETOUR_RATIO = 1.8;
const INITIAL_TMAP_REFINE_COUNT = 0;
const INITIAL_RESULT_COUNT = 10;
const TRANSIT_REFINE_COUNT = 18;
const RANKING_VARIATION_WINDOW = 0.035;
const STRATEGY_LABEL: Record<Strategy, string> = {
  origin_area: '출발지 근처',
  destination_area: '약속지 근처',
  route_area: '가는 길 중간',
};

export async function planTimeFit(input: PlanInput): Promise<PlanResult> {
  const primaryMode = input.mode;
  const radiusM = input.radiusM ?? radiusFor(primaryMode, input.remainingMin);
  const buffer = Math.max(10, Math.round(input.remainingMin * 0.12));
  const budget = input.remainingMin - buffer;
  const target: LatLon = input.destination ?? input.origin;

  // 1) 후보: 출발지 근처 + 약속지 근처 + 이동 중간 후보를 함께 수집
  const cands: Spot[] = [];
  const seenCand = new Map<string, Spot>();
  for (const center of searchCenters(input.origin, input.destination ?? null)) {
    const raw = await locationBased(center.lat, center.lon, radiusM);
    for (const it of raw) {
      const d = resolveBusanDwell(it.contentid, input.dayType, input.hourBucket);
      if (!d) continue;
      const lat = parseFloat(it.mapy), lon = parseFloat(it.mapx);
      if (isNaN(lat) || isNaN(lon)) continue;
      const contentId = String(it.contentid);
      const spot: Spot = {
        title: it.title, contentId, typeId: it.contenttypeid, category: d.category, subCategory: d.subCategory,
        lat, lon, dwell: d.eff, dwellBase: d.base, dwellSrc: d.src, mult: d.mult,
        dwellSourceName: d.dwellSourceName,
        openingHoursSourceName: d.openingHoursSourceName,
        openingHoursReliability: d.openingHoursReliability,
        matchScope: d.matchScope,
        mapVerificationStatus: d.mapVerificationStatus,
        mapVerificationName: d.mapVerificationName,
        mapVerificationDistanceM: d.mapVerificationDistanceM,
        openNote: '', confidence: d.confidence, strategy: center.strategy,
      };
      const prev = seenCand.get(contentId);
      if (!prev || strategyPriority(center.strategy) < strategyPriority(prev.strategy)) seenCand.set(contentId, spot);
    }
  }
  cands.push(...seenCand.values());

  // 2) haversine 프리필터: 짧은 자투리 시간에는 카페/상업지구/가벼운 구경 장소를 더 유연하게 유지
  const pre = cands.filter((c) => hasStayOpportunity([c], input.origin, target, !!input.destination, budget, primaryMode, input.remainingMin));
  pre.sort((a, b) => moveOnlyMin([a], input.origin, target, primaryMode, !!input.destination) - moveOnlyMin([b], input.origin, target, primaryMode, !!input.destination));

  // 3) 운영시간 게이트 (상위만 detailIntro2)
  const gated: Spot[] = [];
  for (const s of pre.slice(0, gateLimitFor(primaryMode, input.remainingMin))) {
    const intro = await detailIntro(s.contentId, s.typeId);
    const start = input.nowMin + Math.min(haversineMin(input.origin, s, 'walk'), haversineMin(input.origin, s, 'car'));
    const g = isOpenDuring(intro, s.typeId, start, s.dwell);
    if (g.ok) gated.push({ ...s, openNote: g.note });
  }

  // 4) 시간적응형 코스 조립 — 이 단계는 haversine 추정만 사용 (TMAP 미호출)
  //    지연 정밀화: 상위 후보에만 TMAP 호출(5단계) → 추천 1회 ~54건 → ~10여건 (합산 1,000/일 한도 대응)
  const courses: Course[] = [];
  const pool = gated.slice(0, 12);
  for (const s of gated) {
    const c = buildCourse([s], input.origin, target, !!input.destination, input.remainingMin, primaryMode);
    if (c) courses.push({ ...c, type: '단일', strategy: s.strategy });
  }
  for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
    if (i === j) continue;
    const base = buildCourse([pool[i]], input.origin, target, !!input.destination, input.remainingMin, primaryMode);
    if (!base || slackOf(base, primaryMode) < 35) continue;
    if (!isAllowedPairDistance(pool[i], pool[j], primaryMode, input.remainingMin, slackOf(base, primaryMode))) continue;
    if (!isAllowedPair(pool[i], pool[j])) continue;
    const c = buildCourse([pool[i], pool[j]], input.origin, target, !!input.destination, input.remainingMin, primaryMode);
    if (c) {
      courses.push({ ...c, type: '미니코스', strategy: pool[i].strategy });
    }
  }

  // 랭킹 v1 — 결정적 점수 함수 + 그리디 다양성 (추천로직.md §4)
  const ranked = stabilizeVisibleMix(rankCourses(courses, budget, input.hourBucket, primaryMode, input.remainingMin), input.remainingMin);

  // 5) 지연 정밀화 — API 사용량 보호를 위해 추천 목록에서는 TMAP 경로 API를 호출하지 않는다.
  //    나머지는 haversine 추정값으로 먼저 보여주고, 상세/확정 단계에서 정밀화하는 구조로 확장한다.
  const r = primaryMode === 'transit'
    ? await refineTransitCandidates(ranked, input.origin, input.destination ?? null, input.remainingMin, input.hourBucket, budget)
    : await refineCourses(ranked, input.origin, input.destination ?? null, input.mode, input.remainingMin, INITIAL_TMAP_REFINE_COUNT);
  const visibleCourses = [...r.courses, ...r.rest.slice(0, Math.max(0, INITIAL_RESULT_COUNT - r.courses.length))];
  const pendingCourses = r.rest.slice(Math.max(0, INITIAL_RESULT_COUNT - r.courses.length));

  return {
    budgetMin: budget, bufferMin: buffer, candidateCount: cands.length,
    gatedCount: gated.length, tmapOk: r.ok, tmapFail: r.fail, courses: visibleCourses, pending: pendingCourses,
  };
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
  const reranked = stabilizeVisibleMix(rankCourses(refined.courses, budget, hourBucket, 'transit', remainingMin, refined.courses.length), remainingMin);
  return {
    courses: reranked.slice(0, INITIAL_RESULT_COUNT),
    rest: [...reranked.slice(INITIAL_RESULT_COUNT), ...refined.rest],
    ok: refined.ok,
    fail: refined.fail,
  };
}

// ───────────────── 랭킹 v1 (결정적·설명가능) ─────────────────
// score = 0.4·체류비율 + 0.3·시간활용 + 0.3·시간대적합 + 0.05·(스팟수−1) − 0.15·카테고리중복(그리디)
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

function searchCenters(origin: LatLon, destination: LatLon | null): Array<LatLon & { strategy: Strategy }> {
  const centers: Array<LatLon & { strategy: Strategy }> = [{ ...origin, strategy: 'origin_area' }];
  if (!destination) return centers;
  centers.push({ ...destination, strategy: 'destination_area' });
  centers.push({
    lat: (origin.lat + destination.lat) / 2,
    lon: (origin.lon + destination.lon) / 2,
    strategy: 'route_area',
  });
  return centers;
}

function strategyPriority(strategy: Strategy): number {
  return strategy === 'destination_area' ? 0 : strategy === 'route_area' ? 1 : 2;
}

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

function rankCourses(courses: Course[], budget: number, bucket: PlanInput['hourBucket'], primaryMode: Mode, remainingMin: number, cap = 24): Course[] {
  const scored = courses.map((c) => {
    const primary = c.mobility?.[primaryMode];
    const bestStay = primary?.stayMin ?? 0;
    const bestMove = primary?.moveMin ?? Infinity;
    const dwell = Math.min(c.spots.reduce((n, s) => n + s.dwell, 0), bestStay);
    const ratio = dwell / Math.max(bestMove + dwell, 1);                // 체류비율(이동낭비 벌점)
    const use = Math.min(1, (bestMove + dwell) / budget);               // 시간활용(알차게)
    const fit = c.spots.reduce((n, s) => n + timeFitOf(bucket, s.category), 0) / c.spots.length; // 시간대적합
    const conf = c.spots.reduce((n, s) => n + confidenceScore(s.confidence), 0) / c.spots.length;
    const compact = c.spots.length === 1 ? 0.7 : Math.max(0, 1 - haversineMin(c.spots[0], c.spots[1], 'walk') / 12);
    const minStay = minStayForCourse(c.spots, remainingMin);
    const carOnlyPenalty = primaryMode === 'walk' && (c.mobility?.walk?.stayMin ?? 0) < minStay && (c.mobility?.car?.stayMin ?? 0) >= minStay ? 0.12 : 0;
    const fallbackOnlyPenalty = c.spots.every((s) => s.confidence === 'category_fallback') ? 0.12 : 0;
    const openingReliabilityPenalty = c.spots.reduce((n, s) => n + openingReliabilityPenaltyOf(s.openingHoursReliability), 0) / c.spots.length;
    const mapVerificationPenalty = c.spots.reduce((n, s) => n + mapVerificationPenaltyOf(s.mapVerificationStatus), 0) / c.spots.length;
    const duplicatePairPenalty = c.spots.length === 2 && c.spots[0].category === c.spots[1].category ? 0.08 : 0;
    const strategyBonus = c.strategy === 'destination_area' ? 0.04 : c.strategy === 'route_area' ? 0.03 : 0;
    const shortGapBonus = budget <= 60 ? shortGapCategoryBonus(c) : 0;
    const transitRailBonus = primaryMode === 'transit' && hasSubwayLeg(c) ? 0.06 : 0;
    const transitReliabilityPenalty = primaryMode === 'transit' ? transitFallbackPenalty(c) : 0;
    const score = 0.3 * Math.min(1, bestStay / 60) + 0.2 * ratio + 0.2 * fit + 0.15 * conf + 0.15 * compact
      + strategyBonus + shortGapBonus + transitRailBonus
      - carOnlyPenalty - fallbackOnlyPenalty - openingReliabilityPenalty - mapVerificationPenalty - duplicatePairPenalty - transitReliabilityPenalty;
    const modeLabel = primaryMode === 'car' ? '차량' : primaryMode === 'transit' ? '대중교통' : '도보';
    const why = `${c.strategy ? STRATEGY_LABEL[c.strategy] + ' · ' : ''}${modeLabel} 기준 체류가능 ${bestStay}분 · ${bucket} 적합 ${Math.round(fit * 100)}%`;
    return { c: { ...c, why }, score };
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
function gateLimitFor(mode: Mode, remainingMin: number): number {
  if (mode === 'walk' && remainingMin <= 60) return 28;
  if (remainingMin <= 90) return 22;
  return 16;
}

function hasStayOpportunity(spots: Spot[], origin: LatLon, target: LatLon, viaAppointment: boolean, budget: number, mode: Mode, remainingMin: number): boolean {
  return moveOnlyMin(spots, origin, target, mode, viaAppointment) <= budget - minStayForCourse(spots, remainingMin);
}

function isAllowedPair(a: Spot, b: Spot): boolean {
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

function moveOnlyMin(spots: Spot[], origin: LatLon, target: LatLon, mode: Mode, _viaAppointment: boolean): number {
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
  const buffer = Math.max(10, Math.round(remainingMin * 0.12));
  const budget = remainingMin - buffer;
  const minStay = minStayForCourse(spots, remainingMin);
  const modes = Array.from(new Set<Mode>([...ROAD_MODES, primaryMode]));
  const mobility = Object.fromEntries(modes.map((mode) => {
    const moveMin = moveOnlyMin(spots, origin, target, mode, viaAppointment);
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
  if (viaAppointment && detourRatio(spots, origin, target, bestMode) >= HARD_DETOUR_RATIO) return null;
  return { spots, totalMin: best.totalMin, legs: best.legs, bufferLeftMin: best.bufferLeftMin, bestMode, mobility };
}

function minStayForCourse(spots: Spot[], remainingMin: number): number {
  if (spots.length > 1) return DEFAULT_MIN_STAY_MIN;
  const category = spots[0]?.category;
  if (remainingMin <= 60) {
    if (category === '카페' || category === '상업지구') return 20;
    if (category === '문화시설' || category === '자연관광지') return 25;
  }
  if (remainingMin <= 90 && (category === '카페' || category === '상업지구')) return 25;
  return DEFAULT_MIN_STAY_MIN;
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

function detourRatio(spots: Spot[], origin: LatLon, target: LatLon, mode: Mode): number {
  const direct = travelMin(origin, target, mode);
  if (direct <= 0) return 1;
  return moveOnlyMin(spots, origin, target, mode, true) / direct;
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
    if (!rebuilt) continue; // 정밀화 후 두 수단 모두 체류 30분 미만이면 탈락
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
