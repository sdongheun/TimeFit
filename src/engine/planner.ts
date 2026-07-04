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

  // 미니 우선 + 시간 알차게, 중복 제거 → 정밀화 대기열 (배치 5개씩 소비)
  courses.sort((a, b) => (b.spots.length - a.spots.length) || (b.totalMin - a.totalMin));
  const ranked: Course[] = [];
  const seen = new Set<string>();
  for (const c of courses) {
    const k = c.spots.map((s) => s.title).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k); ranked.push(c);
    if (ranked.length >= 24) break; // "다른 코스 보기" 여유분까지 보관
  }

  // 5) 지연 정밀화 — 첫 배치 5개 확정, 나머지는 pending(새로고침용, haversine 추정치)
  const r = await refineCourses(ranked, input.origin, input.destination ?? null, mode, input.remainingMin, 5);

  return {
    budgetMin: budget, bufferMin: buffer, candidateCount: cands.length,
    gatedCount: gated.length, tmapOk: r.ok, tmapFail: r.fail, courses: r.courses, pending: r.rest,
  };
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
