// 시간-적합 플래너 (결정적). 스파이크 engine_spike.mjs 로직 이식.
import { Course, LatLon, PlanInput, PlanResult, Spot } from './types';
import { effectiveDwell, mapCategory } from './data';
import { detailIntro, isOpenDuring, locationBased } from './tourapi';
import { haversineMin, precompute, travelGeo, travelMin, travelSrc } from './travel';

export async function planTimeFit(input: PlanInput): Promise<PlanResult> {
  const radiusM = input.radiusM ?? 1500;
  const mode = input.mode;
  const buffer = Math.max(10, Math.round(input.remainingMin * 0.12));
  const budget = input.remainingMin - buffer;
  const target: LatLon = input.destination ?? input.origin;

  // 1) 후보
  const raw = await locationBased(input.origin.lat, input.origin.lon, radiusM);
  const cands: Spot[] = [];
  for (const it of raw) {
    const cat = mapCategory(it.contenttypeid, it.title);
    if (!cat) continue;
    const lat = parseFloat(it.mapy), lon = parseFloat(it.mapx);
    if (isNaN(lat) || isNaN(lon)) continue;
    const d = effectiveDwell(it.title, cat, input.dayType, input.hourBucket);
    cands.push({
      title: it.title, contentId: it.contentid, typeId: it.contenttypeid, category: cat,
      lat, lon, dwell: d.eff, dwellBase: d.base, dwellSrc: d.src, mult: d.mult, openNote: '',
    });
  }

  // 2) haversine 프리필터(왕복)
  const pre = cands.filter((c) => haversineMin(input.origin, c, mode) * 2 + c.dwell <= budget);
  pre.sort((a, b) => haversineMin(input.origin, a, mode) - haversineMin(input.origin, b, mode));

  // 3) 운영시간 게이트 (상위만 detailIntro2)
  const gated: Spot[] = [];
  for (const s of pre.slice(0, 16)) {
    const intro = await detailIntro(s.contentId, s.typeId);
    const start = input.nowMin + haversineMin(input.origin, s, mode);
    const g = isOpenDuring(intro, s.typeId, start, s.dwell);
    if (g.ok) gated.push({ ...s, openNote: g.note });
  }

  // 4) 시간적응형 코스 조립 — 이 단계는 haversine 추정만 사용 (TMAP 미호출)
  //    지연 정밀화: 상위 후보에만 TMAP 호출(5단계) → 추천 1회 ~54건 → ~10여건 (합산 1,000/일 한도 대응)
  const courses: Course[] = [];
  const pool = gated.slice(0, 8);
  for (const s of gated) {
    const { legs, total } = buildCourseLegs([s], input.origin, target, mode, !!input.destination);
    if (total <= budget) courses.push({ type: '단일', spots: [s], totalMin: total, legs, bufferLeftMin: input.remainingMin - total });
  }
  if (input.remainingMin >= 60) {
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j || pool[i].category === pool[j].category) continue;
      const { legs, total } = buildCourseLegs([pool[i], pool[j]], input.origin, target, mode, !!input.destination);
      if (total <= budget && total >= budget * 0.6) {
        courses.push({ type: '미니코스', spots: [pool[i], pool[j]], totalMin: total, legs, bufferLeftMin: input.remainingMin - total });
      }
    }
  }

  // 랭킹 v1 — 결정적 점수 함수 + 그리디 다양성 (추천로직.md §4)
  const ranked = rankCourses(courses, budget, input.hourBucket);

  // 5) 지연 정밀화 — 첫 배치 5개 확정, 나머지는 pending(새로고침용, haversine 추정치)
  const r = await refineCourses(ranked, input.origin, input.destination ?? null, mode, input.remainingMin, 5);

  return {
    budgetMin: budget, bufferMin: buffer, candidateCount: cands.length,
    gatedCount: gated.length, tmapOk: r.ok, tmapFail: r.fail, courses: r.courses, pending: r.rest,
  };
}

// ───────────────── 랭킹 v1 (결정적·설명가능) ─────────────────
// score = 0.4·체류비율 + 0.3·시간활용 + 0.3·시간대적합 + 0.05·(스팟수−1) − 0.15·카테고리중복(그리디)
// · 체류비율: 이동 낭비 벌점 — "멀리 걷게 하는 코스가 상위" 왜곡 제거 (A2)
// · 시간대적합: 오후 3시 뷔페 같은 부조화 감점 (A4)
// · 그리디 다양성: 위에서부터 뽑을 때 이미 뽑힌 카테고리는 감점 → 상위 5개 골고루 (A3)
const TIMEFIT: Record<PlanInput['hourBucket'], Record<string, number>> = {
  아침: { 카페: 1.0, 자연관광지: 0.9, '레저/스포츠': 0.7, 문화시설: 0.6, 식당: 0.4 },
  점심: { 식당: 1.0, 카페: 0.7, 문화시설: 0.6, 자연관광지: 0.6, 상업지구: 0.6 },
  오후: { 자연관광지: 1.0, 문화시설: 1.0, 상업지구: 0.9, '레저/스포츠': 0.9, '지역축제/행사': 0.9, 카페: 0.8, 식당: 0.4 },
  저녁: { 식당: 1.0, '지역축제/행사': 0.9, 카페: 0.8, 상업지구: 0.8, 자연관광지: 0.6 },
  야간: { 카페: 0.8, 상업지구: 0.8, '지역축제/행사': 0.8, 식당: 0.7, 자연관광지: 0.6 },
};
const timeFitOf = (bucket: PlanInput['hourBucket'], category: string) => TIMEFIT[bucket]?.[category] ?? 0.6;

function rankCourses(courses: Course[], budget: number, bucket: PlanInput['hourBucket'], cap = 24): Course[] {
  const scored = courses.map((c) => {
    const dwell = c.spots.reduce((n, s) => n + s.dwell, 0);
    const ratio = dwell / c.totalMin;                                   // 체류비율(이동낭비 벌점)
    const use = Math.min(1, c.totalMin / budget);                       // 시간활용(알차게)
    const fit = c.spots.reduce((n, s) => n + timeFitOf(bucket, s.category), 0) / c.spots.length; // 시간대적합
    const score = 0.4 * ratio + 0.3 * use + 0.3 * fit + 0.05 * (c.spots.length - 1);
    const why = `체류 ${Math.round(ratio * 100)}% · ${bucket} 적합 ${Math.round(fit * 100)}%`;
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

// 구간 시간/경로 조립 — precompute 이후 호출하면 TMAP 정밀값+실경로, 아니면 haversine 추정
function buildCourseLegs(
  spots: Spot[], origin: LatLon, target: LatLon, mode: PlanInput['mode'], viaAppointment: boolean,
): { legs: Course['legs']; total: number } {
  const legs: Course['legs'] = [];
  let cur: LatLon = origin, total = 0;
  spots.forEach((s, k) => {
    const t = travelMin(cur, s, mode); total += t + s.dwell;
    legs.push({ label: `${k === 0 ? '출발' : '이동'} → ${s.title}`, min: t, src: travelSrc(cur, s, mode), geo: travelGeo(cur, s, mode) });
    legs.push({ label: `체류 · ${s.title}`, min: s.dwell, src: s.dwellSrc });
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
  const buffer = Math.max(10, Math.round(remainingMin * 0.12));
  const budget = remainingMin - buffer;
  const target = destination ?? origin;
  const out: Course[] = [];
  let ok = 0, fail = 0, i = 0;
  for (; i < cands.length && out.length < want; i++) {
    const c = cands[i];
    const pairs: [LatLon, LatLon][] = [];
    let cur: LatLon = origin;
    for (const s of c.spots) { pairs.push([cur, s]); cur = s; }
    pairs.push([cur, target]);
    const st = await precompute(pairs, mode); // 캐시된 쌍은 재호출 없음
    ok += st.ok; fail += st.fail;
    const { legs, total } = buildCourseLegs(c.spots, origin, target, mode, !!destination);
    if (total > budget) continue; // 정밀화 후 예산 초과 → 탈락
    out.push({ ...c, legs, totalMin: total, bufferLeftMin: remainingMin - total });
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
