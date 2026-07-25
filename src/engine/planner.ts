// 시간-적합 플래너 (결정적). 스파이크 engine_spike.mjs 로직 이식.
import { Course, LatLon, Mode, MobilityOption, PlanInput, PlanResult, Spot, Strategy } from './types';
import { resolveBusanDwell } from './data';
import { detailIntro, isOpenDuring, locationBased } from './tourapi';
import { haversineMin, precompute, travelGeo, travelMin, travelSrc } from './travel';

const MODES: Mode[] = ['walk', 'car'];
const MIN_STAY_MIN = 30;
const HARD_DETOUR_RATIO = 1.8;
const INITIAL_TMAP_REFINE_COUNT = 0;
const INITIAL_RESULT_COUNT = 10;
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
        title: it.title, contentId, typeId: it.contenttypeid, category: d.category,
        lat, lon, dwell: d.eff, dwellBase: d.base, dwellSrc: d.src, mult: d.mult,
        openNote: '', confidence: d.confidence, strategy: center.strategy,
      };
      const prev = seenCand.get(contentId);
      if (!prev || strategyPriority(center.strategy) < strategyPriority(prev.strategy)) seenCand.set(contentId, spot);
    }
  }
  cands.push(...seenCand.values());

  // 2) haversine 프리필터: 사용자가 선택한 이동수단으로 30분 이상 머물 수 있으면 유지
  const pre = cands.filter((c) => hasStayOpportunity([c], input.origin, target, !!input.destination, budget, primaryMode));
  pre.sort((a, b) => moveOnlyMin([a], input.origin, target, primaryMode, !!input.destination) - moveOnlyMin([b], input.origin, target, primaryMode, !!input.destination));

  // 3) 운영시간 게이트 (상위만 detailIntro2)
  const gated: Spot[] = [];
  for (const s of pre.slice(0, 16)) {
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
  const ranked = stabilizeVisibleMix(rankCourses(courses, budget, input.hourBucket, primaryMode), input.remainingMin);

  // 5) 지연 정밀화 — API 사용량 보호를 위해 추천 목록에서는 TMAP 경로 API를 호출하지 않는다.
  //    나머지는 haversine 추정값으로 먼저 보여주고, 상세/확정 단계에서 정밀화하는 구조로 확장한다.
  const r = await refineCourses(ranked, input.origin, input.destination ?? null, input.mode, input.remainingMin, INITIAL_TMAP_REFINE_COUNT);
  const visibleCourses = [...r.courses, ...r.rest.slice(0, Math.max(0, INITIAL_RESULT_COUNT - r.courses.length))];
  const pendingCourses = r.rest.slice(Math.max(0, INITIAL_RESULT_COUNT - r.courses.length));

  return {
    budgetMin: budget, bufferMin: buffer, candidateCount: cands.length,
    gatedCount: gated.length, tmapOk: r.ok, tmapFail: r.fail, courses: visibleCourses, pending: pendingCourses,
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
  if (mode === 'walk') {
    if (remainingMin <= 60) return 700;
    if (remainingMin <= 120) return 1000;
    return 1500;
  }
  if (remainingMin <= 60) return 2000;
  if (remainingMin <= 120) return 4000;
  return 8000;
}

function rankCourses(courses: Course[], budget: number, bucket: PlanInput['hourBucket'], primaryMode: Mode, cap = 24): Course[] {
  const scored = courses.map((c) => {
    const primary = c.mobility?.[primaryMode];
    const bestStay = primary?.stayMin ?? 0;
    const bestMove = primary?.moveMin ?? Infinity;
    const dwell = Math.min(c.spots.reduce((n, s) => n + s.dwell, 0), bestStay);
    const ratio = dwell / Math.max(bestMove + dwell, 1);                // 체류비율(이동낭비 벌점)
    const use = Math.min(1, (bestMove + dwell) / budget);               // 시간활용(알차게)
    const fit = c.spots.reduce((n, s) => n + timeFitOf(bucket, s.category), 0) / c.spots.length; // 시간대적합
    const conf = c.spots.reduce((n, s) => n + (s.confidence === 'direct_match' ? 1 : 0.7), 0) / c.spots.length;
    const compact = c.spots.length === 1 ? 0.7 : Math.max(0, 1 - haversineMin(c.spots[0], c.spots[1], 'walk') / 12);
    const carOnlyPenalty = primaryMode === 'walk' && (c.mobility?.walk.stayMin ?? 0) < MIN_STAY_MIN && (c.mobility?.car.stayMin ?? 0) >= MIN_STAY_MIN ? 0.12 : 0;
    const fallbackOnlyPenalty = c.spots.every((s) => s.confidence === 'category_fallback') ? 0.12 : 0;
    const duplicatePairPenalty = c.spots.length === 2 && c.spots[0].category === c.spots[1].category ? 0.08 : 0;
    const strategyBonus = c.strategy === 'destination_area' ? 0.04 : c.strategy === 'route_area' ? 0.03 : 0;
    const score = 0.3 * Math.min(1, bestStay / 60) + 0.2 * ratio + 0.2 * fit + 0.15 * conf + 0.15 * compact
      + strategyBonus - carOnlyPenalty - fallbackOnlyPenalty - duplicatePairPenalty;
    const modeLabel = primaryMode === 'car' ? '차량' : '도보';
    const why = `${c.strategy ? STRATEGY_LABEL[c.strategy] + ' · ' : ''}${modeLabel} 기준 체류가능 ${bestStay}분 · ${bucket} 적합 ${Math.round(fit * 100)}%`;
    return { c: { ...c, why }, score };
  });
  // 그리디 선택: 매 단계 (점수 − 이미 뽑힌 카테고리 중복 벌점) 최대를 뽑음
  const ranked: Course[] = [];
  const catCnt: Record<string, number> = {};
  const seen = new Set<string>();
  while (ranked.length < cap && scored.length) {
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < scored.length; i++) {
      const pen = scored[i].c.spots.reduce((p, s) => p + (catCnt[s.category] ?? 0), 0) * 0.15;
      const v = scored[i].score - pen;
      if (v > bv) { bv = v; bi = i; }
    }
    const { c } = scored.splice(bi, 1)[0];
    const k = c.spots.map((s) => s.title).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    ranked.push(c);
    c.spots.forEach((s) => { catCnt[s.category] = (catCnt[s.category] ?? 0) + 1; });
  }
  return ranked;
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
function hasStayOpportunity(spots: Spot[], origin: LatLon, target: LatLon, viaAppointment: boolean, budget: number, mode: Mode): boolean {
  return moveOnlyMin(spots, origin, target, mode, viaAppointment) <= budget - MIN_STAY_MIN;
}

function isAllowedPair(a: Spot, b: Spot): boolean {
  if (a.category === '식당' && b.category === '식당') return false;
  if (a.category === '카페' && b.category === '카페') return false;
  return true;
}

function isAllowedPairDistance(a: Spot, b: Spot, mode: Mode, remainingMin: number, singleSlack: number): boolean {
  const min = haversineMin(a, b, mode);
  if (mode === 'walk') {
    const limit = remainingMin >= 180 || singleSlack >= 60 ? 18 : 12;
    return min <= limit;
  }
  const limit = remainingMin >= 180 || singleSlack >= 60 ? 25 : 15;
  return min <= limit;
}

function slackOf(course: Omit<Course, 'type'>, mode: Mode): number {
  return course.mobility?.[mode].stayMin ?? 0;
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
  const mobility = Object.fromEntries(MODES.map((mode) => {
    const moveMin = moveOnlyMin(spots, origin, target, mode, viaAppointment);
    const stayMin = Math.max(0, budget - moveMin);
    const allocatedStay = Math.min(sumDwell(spots), stayMin);
    const { legs } = buildCourseLegs(spots, origin, target, mode, viaAppointment, allocatedStay);
    return [mode, {
      mode, moveMin, stayMin, totalMin: moveMin + allocatedStay,
      bufferLeftMin: remainingMin - moveMin - allocatedStay,
      ok: stayMin >= MIN_STAY_MIN,
      legs,
    } satisfies MobilityOption];
  })) as Record<Mode, MobilityOption>;
  const bestMode = primaryMode;
  const best = mobility[bestMode];
  if (!best.ok) return null;
  if (viaAppointment && detourRatio(spots, origin, target, bestMode) >= HARD_DETOUR_RATIO) return null;
  return { spots, totalMin: best.totalMin, legs: best.legs, bufferLeftMin: best.bufferLeftMin, bestMode, mobility };
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
    legs.push({ label: `${k === 0 ? '출발' : '이동'} → ${s.title}`, min: t, src: travelSrc(cur, s, mode), geo: travelGeo(cur, s, mode) });
    legs.push({ label: `체류 가능 · ${s.title}`, min: dwell, src: s.dwellSrc });
    cur = s;
  });
  const back = travelMin(cur, target, mode); total += back;
  legs.push({ label: viaAppointment ? '다음 스케줄로' : '출발지로 복귀', min: back, src: travelSrc(cur, target, mode), geo: travelGeo(cur, target, mode) });
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
    for (const m of MODES) {
      const st = await precompute(pairs, m); // 캐시된 쌍은 재호출 없음
      ok += st.ok; fail += st.fail;
    }
    const rebuilt = buildCourse(c.spots, origin, target, !!destination, remainingMin, mode);
    if (!rebuilt) continue; // 정밀화 후 두 수단 모두 체류 30분 미만이면 탈락
    out.push({ ...c, ...rebuilt });
  }
  return { courses: out, rest: cands.slice(i), ok, fail };
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
