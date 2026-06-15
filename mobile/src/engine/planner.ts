// 시간-적합 플래너 (결정적). 스파이크 engine_spike.mjs 로직 이식.
import { Course, LatLon, PlanInput, PlanResult, Spot } from './types';
import { effectiveDwell, mapCategory } from './data';
import { detailIntro, isOpenDuring, locationBased } from './tourapi';
import { haversineMin, precompute, travelMin, travelSrc } from './travel';

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

  // 4) TMAP 정밀 이동(게이트 풀: origin↔spot + 상위 pair)
  const pool = gated.slice(0, 8);
  const pairs: [LatLon, LatLon][] = [];
  for (const s of gated) { pairs.push([input.origin, s]); pairs.push([s, target]); }
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
  const stat = await precompute(pairs, mode);

  // 5) 시간적응형 코스
  const courses: Course[] = [];
  const buildLegs = (spots: Spot[]): { legs: Course['legs']; total: number } => {
    const legs: Course['legs'] = [];
    let cur: LatLon = input.origin, total = 0;
    spots.forEach((s, k) => {
      const t = travelMin(cur, s, mode); total += t + s.dwell;
      legs.push({ label: `${k === 0 ? '출발' : '이동'} → ${s.title}`, min: t, src: travelSrc(cur, s) });
      legs.push({ label: `체류 · ${s.title}`, min: s.dwell, src: s.dwellSrc });
      cur = s;
    });
    const back = travelMin(cur, target, mode); total += back;
    legs.push({ label: input.destination ? '다음 스케줄로' : '출발지로 복귀', min: back, src: travelSrc(cur, target) });
    return { legs, total };
  };

  for (const s of gated) {
    const { legs, total } = buildLegs([s]);
    if (total <= budget) courses.push({ type: '단일', spots: [s], totalMin: total, legs, bufferLeftMin: input.remainingMin - total });
  }
  if (input.remainingMin >= 60) {
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j || pool[i].category === pool[j].category) continue;
      const { legs, total } = buildLegs([pool[i], pool[j]]);
      if (total <= budget && total >= budget * 0.6) {
        courses.push({ type: '미니코스', spots: [pool[i], pool[j]], totalMin: total, legs, bufferLeftMin: input.remainingMin - total });
      }
    }
  }

  // 미니 우선 + 시간 알차게, 중복 제거
  courses.sort((a, b) => (b.spots.length - a.spots.length) || (b.totalMin - a.totalMin));
  const top: Course[] = [];
  const seen = new Set<string>();
  for (const c of courses) {
    const k = c.spots.map((s) => s.title).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k); top.push(c);
    if (top.length >= 3) break;
  }

  return {
    budgetMin: budget, bufferMin: buffer, candidateCount: cands.length,
    gatedCount: gated.length, tmapOk: stat.ok, tmapFail: stat.fail, courses: top,
  };
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
