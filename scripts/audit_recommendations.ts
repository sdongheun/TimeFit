import fs from 'node:fs';
import path from 'node:path';
import { Course, DayType, HourBucket, LatLon, Mode, planTimeFit } from '../src/engine';

type Place = LatLon & { label: string };
type Scenario = {
  id: string;
  title: string;
  origin: Place;
  destination: Place | null;
  remainingMin: number;
  dayType: DayType;
  hourBucket: HourBucket;
  nowMin: number;
};

type Issue = { level: 'fail' | 'warn'; code: string; message: string; penalty: number };
type CourseAudit = {
  status: 'PASS' | 'WARN' | 'FAIL';
  score: number;
  issues: Issue[];
  course: Course;
  metrics: {
    bestMode: string;
    bestMoveMin: number;
    bestStayMin: number;
    walkMoveMin: number;
    walkStayMin: number;
    carMoveMin: number;
    carStayMin: number;
    detourRatio: number | null;
    pairWalkMin: number | null;
    strategy: string;
  };
};

type ScenarioAudit = {
  scenario: Scenario;
  tourApiCount: number;
  candidateCount: number;
  eligibleCount: number;
  openingCheckCount: number;
  gatedCount: number;
  tmapCalls: number;
  courses: CourseAudit[];
  candidateDiagnosis: CandidateDiagnosis;
  error?: string;
};

type CandidateHealth = 'SUFFICIENT' | 'LIMITED' | 'SCARCE';
type CandidateDiagnosis = {
  health: CandidateHealth;
  uniqueCount: number;
  visibleCount: number;
  categoryCounts: Record<string, number>;
  strategyCounts: Record<string, number>;
  directMatchCount: number;
  categoryFallbackCount: number;
  directHoursCount: number;
  weakMapCount: number;
  bottleneck: 'none' | 'time_feasibility' | 'opening_hours' | 'course_build';
  note: string;
  top: Array<{ title: string; category: string; strategy: string }>;
};

const modeInput = process.env.AUDIT_MODE ?? 'walk';
const auditMode: Mode = modeInput === 'car' || modeInput === 'transit' ? modeInput : 'walk';
const modeKorean: Record<Mode, string> = { walk: '도보', car: '차량', transit: '대중교통' };
const coverageOnly = process.env.AUDIT_COVERAGE_ONLY === '1';
const OUT = path.resolve(process.env.AUDIT_OUT ?? `docs/reports/recommendation_audit_${auditMode}.html`);
const DEFAULT_MIN_STAY_MIN = 30;

const RULES = [
  { code: 'lodging_keyword', level: 'FAIL', penalty: 100, desc: '숙박성 키워드 포함' },
  { code: 'utility_keyword', level: 'FAIL', penalty: 90, desc: '주차장/병원/주유소 등 부적합 시설 키워드 포함' },
  { code: 'same_food_pair', level: 'FAIL', penalty: 45, desc: '식당 2곳 코스' },
  { code: 'far_pair', level: 'FAIL', penalty: 60, desc: '2개 장소 사이 도보 12분 초과' },
  { code: 'detour_high', level: 'FAIL', penalty: 45, desc: '직행 대비 우회율 1.8배 이상' },
  { code: 'same_cafe_pair', level: 'WARN', penalty: 25, desc: '카페 2곳 코스' },
  { code: 'duplicate_category_pair', level: 'WARN', penalty: 15, desc: '같은 카테고리 2곳 코스' },
  { code: 'detour_medium', level: 'WARN', penalty: 20, desc: '직행 대비 우회율 1.45배 이상' },
  { code: 'walk_too_long', level: 'WARN', penalty: 15, desc: '도보 총 이동시간 60분 초과' },
  { code: 'car_only', level: 'WARN', penalty: 20, desc: '자동차로만 30분 이상 체류 가능' },
  { code: 'low_stay_margin', level: 'WARN', penalty: 20, desc: '최선 수단 체류 가능 시간 40분 미만' },
  { code: 'move_over_stay', level: 'WARN', penalty: 15, desc: '이동시간이 체류 가능 시간보다 김' },
  { code: 'fallback_only_course', level: 'WARN', penalty: 10, desc: '모든 장소가 카테고리 폴백 데이터' },
];

const P = {
  seomyeon: { label: '서면역', lat: 35.1578, lon: 129.0594 },
  busanStation: { label: '부산역', lat: 35.1151, lon: 129.0413 },
  haeundae: { label: '해운대역', lat: 35.1630, lon: 129.1580 },
  bexco: { label: '벡스코', lat: 35.1690, lon: 129.1365 },
  gwangalli: { label: '광안리해수욕장', lat: 35.1532, lon: 129.1186 },
  centum: { label: '센텀시티역', lat: 35.1689, lon: 129.1317 },
  nampo: { label: '남포역', lat: 35.0986, lon: 129.0341 },
  jagalchi: { label: '자갈치역', lat: 35.0973, lon: 129.0267 },
  sasang: { label: '사상역', lat: 35.1623, lon: 128.9847 },
  gimhaeAirport: { label: '김해공항', lat: 35.1796, lon: 128.9382 },
  dongnae: { label: '동래역', lat: 35.2055, lon: 129.0785 },
  oncheonjang: { label: '온천장역', lat: 35.2200, lon: 129.0865 },
  pnu: { label: '부산대역', lat: 35.2301, lon: 129.0881 },
  suyeong: { label: '수영역', lat: 35.1667, lon: 129.1151 },
  kyungsung: { label: '경성대부경대역', lat: 35.1375, lon: 129.1005 },
  yeongdo: { label: '영도대교', lat: 35.0965, lon: 129.0375 },
  songjeong: { label: '송정해수욕장', lat: 35.1786, lon: 129.1998 },
  dadepo: { label: '다대포해수욕장역', lat: 35.0487, lon: 128.9656 },
  gijang: { label: '기장역', lat: 35.2448, lon: 129.2186 },
  osiria: { label: '오시리아역', lat: 35.1964, lon: 129.2087 },
} satisfies Record<string, Place>;

const scenarios: Scenario[] = [
  s('S01', '서면 -> 부산역 60분', P.seomyeon, P.busanStation, 60, '평일', '오후', 14),
  s('S02', '서면 -> 부산역 120분', P.seomyeon, P.busanStation, 120, '평일', '오후', 14),
  s('S03', '서면 왕복 90분', P.seomyeon, null, 90, '주말', '오후', 14),
  s('S04', '해운대 -> 벡스코 90분', P.haeundae, P.bexco, 90, '평일', '오후', 15),
  s('S05', '광안리 -> 센텀 120분', P.gwangalli, P.centum, 120, '주말', '오후', 15),
  s('S06', '부산역 -> 남포 90분', P.busanStation, P.nampo, 90, '평일', '오후', 14),
  s('S07', '남포 -> 자갈치 60분', P.nampo, P.jagalchi, 60, '주말', '점심', 12),
  s('S08', '사상 -> 김해공항 120분', P.sasang, P.gimhaeAirport, 120, '평일', '오후', 15),
  s('S09', '동래 -> 온천장 90분', P.dongnae, P.oncheonjang, 90, '평일', '오후', 14),
  s('S10', '부산대 -> 동래 120분', P.pnu, P.dongnae, 120, '주말', '오후', 15),
  s('S11', '수영 -> 광안리 75분', P.suyeong, P.gwangalli, 75, '평일', '저녁', 18),
  s('S12', '경성대 -> 광안리 90분', P.kyungsung, P.gwangalli, 90, '주말', '저녁', 18),
  s('S13', '영도 -> 부산역 90분', P.yeongdo, P.busanStation, 90, '평일', '오후', 14),
  s('S14', '송정 -> 해운대 120분', P.songjeong, P.haeundae, 120, '주말', '오후', 15),
  s('S15', '다대포 왕복 120분', P.dadepo, null, 120, '주말', '오후', 15),
  s('S16', '기장 -> 오시리아 120분', P.gijang, P.osiria, 120, '평일', '오후', 14),
  s('S17', '센텀 -> 벡스코 60분', P.centum, P.bexco, 60, '평일', '아침', 10),
  s('S18', '부산역 -> 서면 180분', P.busanStation, P.seomyeon, 180, '평일', '오후', 14),
  s('S19', '해운대 왕복 150분', P.haeundae, null, 150, '주말', '오후', 15),
  s('S20', '광안리 -> 부산역 180분', P.gwangalli, P.busanStation, 180, '주말', '오후', 15),
];

function s(
  id: string, title: string, origin: Place, destination: Place | null,
  remainingMin: number, dayType: DayType, hourBucket: HourBucket, hour: number,
): Scenario {
  return { id, title, origin, destination, remainingMin, dayType, hourBucket, nowMin: hour * 60 };
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const t = (d: number) => (d * Math.PI) / 180;
  const dLat = t(b.lat - a.lat);
  const dLon = t(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function approxMin(a: LatLon, b: LatLon, mode: 'walk' | 'car'): number {
  const km = haversineKm(a, b);
  const cfg = km < 0.8
    ? { circ: 1.25, kmh: 4.5, fix: 0 }
    : mode === 'walk'
      ? { circ: 1.25, kmh: 4.5, fix: 0 }
      : { circ: 1.3, kmh: 25, fix: 3 };
  return Math.round((km * cfg.circ) / cfg.kmh * 60 + cfg.fix);
}

function routeDirectApprox(sc: Scenario, mode: 'walk' | 'car'): number | null {
  if (!sc.destination) return null;
  return approxMin(sc.origin, sc.destination, mode);
}

function pairWalkMin(c: Course): number | null {
  if (c.spots.length < 2) return null;
  return approxMin(c.spots[0], c.spots[1], 'walk');
}

function auditCourse(sc: Scenario, c: Course): CourseAudit {
  const issues: Issue[] = [];
  const walk = c.mobility?.walk;
  const car = c.mobility?.car;
  const transit = c.mobility?.transit;
  const bestMode = c.bestMode ?? 'walk';
  const best = bestMode === 'car' ? car : bestMode === 'transit' ? transit : walk;
  const bestMoveMin = best?.moveMin ?? c.totalMin;
  const bestStayMin = best?.stayMin ?? Math.max(0, sc.remainingMin - c.totalMin);
  const direct = bestMode === 'transit' ? routeDirectApprox(sc, 'car') : routeDirectApprox(sc, bestMode);
  const detourRatio = direct && direct > 0 ? round1(bestMoveMin / direct) : null;
  const pair = pairWalkMin(c);
  const titles = c.spots.map((p) => p.title).join(' + ');
  const categories = c.spots.map((p) => p.category);

  const add = (level: Issue['level'], code: string, message: string, penalty: number) => {
    issues.push({ level, code, message, penalty });
  };

  if (/호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|여인숙|호스텔|콘도/i.test(titles)) {
    add('fail', 'lodging_keyword', '숙박성 키워드가 포함된 장소입니다.', 100);
  }
  if (/주차장|병원|의원|진료소|약국|주유소|충전소|정비소/i.test(titles)) {
    add('fail', 'utility_keyword', '자투리 시간 추천에 부적합한 시설 키워드가 포함됐습니다.', 90);
  }
  if (c.spots.length === 2 && categories.every((x) => x === '식당')) {
    add('fail', 'same_food_pair', '식당 2곳을 한 코스로 묶었습니다.', 45);
  }
  if (c.spots.length === 2 && categories.every((x) => x === '카페')) {
    add('warn', 'same_cafe_pair', '카페 2곳을 한 코스로 묶었습니다.', 25);
  }
  if (c.spots.length === 2 && categories[0] === categories[1] && !['식당', '카페'].includes(categories[0])) {
    add('warn', 'duplicate_category_pair', '같은 카테고리 2곳 코스입니다.', 15);
  }
  if (pair != null && pair > 12) {
    add('fail', 'far_pair', `두 장소 사이 도보 추정이 ${pair}분입니다.`, 60);
  }
  if (detourRatio != null && detourRatio >= 1.8) {
    add('fail', 'detour_high', `직행 대비 우회율이 ${detourRatio}배입니다.`, 45);
  } else if (detourRatio != null && detourRatio >= 1.45) {
    add('warn', 'detour_medium', `직행 대비 우회율이 ${detourRatio}배입니다.`, 20);
  }
  if ((walk?.moveMin ?? 0) > 60) {
    add('warn', 'walk_too_long', `도보 총 이동이 ${walk?.moveMin}분입니다.`, 15);
  }
  const minStay = minStayForAudit(c, sc.remainingMin);
  if ((walk?.stayMin ?? 0) < minStay && (car?.stayMin ?? 0) >= minStay) {
    add('warn', 'car_only', `자동차로만 최소 체류 ${minStay}분 이상 가능한 코스입니다.`, 20);
  }
  if (bestStayMin < 40) {
    add('warn', 'low_stay_margin', `최선 수단 기준 체류 가능 시간이 ${bestStayMin}분입니다.`, 20);
  }
  if (bestMoveMin > bestStayMin) {
    add('warn', 'move_over_stay', '이동시간이 체류 가능 시간보다 깁니다.', 15);
  }
  if (c.spots.length > 0 && c.spots.every((p) => p.confidence === 'category_fallback')) {
    add('warn', 'fallback_only_course', '모든 장소가 카테고리 폴백 데이터입니다.', 10);
  }

  const score = Math.max(0, 100 - issues.reduce((n, x) => n + x.penalty, 0));
  const status = issues.some((x) => x.level === 'fail') || score < 60 ? 'FAIL' : issues.length ? 'WARN' : 'PASS';
  return {
    status,
    score,
    issues,
    course: c,
    metrics: {
      bestMode,
      bestMoveMin,
      bestStayMin,
      walkMoveMin: walk?.moveMin ?? 0,
      walkStayMin: walk?.stayMin ?? 0,
      carMoveMin: car?.moveMin ?? 0,
      carStayMin: car?.stayMin ?? 0,
      detourRatio,
      pairWalkMin: pair,
      strategy: c.strategy ?? 'origin_area',
    },
  };
}

function minStayForAudit(course: Course, remainingMin: number): number {
  if (course.spots.length > 1) return DEFAULT_MIN_STAY_MIN;
  const category = course.spots[0]?.category;
  if (remainingMin <= 60) {
    if (category === '카페' || category === '상업지구') return 20;
    if (category === '문화시설' || category === '자연관광지') return 25;
  }
  if (remainingMin <= 90 && (category === '카페' || category === '상업지구')) return 25;
  return DEFAULT_MIN_STAY_MIN;
}

function diagnoseCandidates(
  courses: Course[],
  stages: { tourApi: number; catalog: number; eligible: number; openingChecked: number; gated: number },
): CandidateDiagnosis {
  const unique = new Map<string, { title: string; category: string; strategy: string; confidence: string; opening: string; map: string }>();
  for (const course of courses) {
    for (const spot of course.spots) {
      if (unique.has(spot.contentId)) continue;
      unique.set(spot.contentId, {
        title: spot.title,
        category: spot.category,
        strategy: spot.strategy,
        confidence: spot.confidence,
        opening: spot.openingHoursReliability ?? 'unknown',
        map: spot.mapVerificationStatus ?? 'unverified',
      });
    }
  }
  const visible = [...unique.values()].slice(0, 10);
  const countBy = <T extends string>(values: T[]) => values.reduce((out, value) => {
    out[value] = (out[value] ?? 0) + 1;
    return out;
  }, {} as Record<string, number>);
  const categoryCounts = countBy(visible.map((spot) => spot.category));
  const strategyCounts = countBy(visible.map((spot) => spot.strategy));
  const categoryCount = Object.keys(categoryCounts).length;
  const dominantCategoryCount = Math.max(0, ...Object.values(categoryCounts));
  const health: CandidateHealth = visible.length < 3
    ? 'SCARCE'
    : visible.length < 5 || categoryCount < 3 || (visible.length >= 6 && dominantCategoryCount / visible.length >= 0.7)
      ? 'LIMITED'
      : 'SUFFICIENT';
  const bottleneck = visible.length > 0
    ? 'none'
    : stages.eligible === 0
      ? 'time_feasibility'
      : stages.gated === 0 && stages.openingChecked > 0
        ? 'opening_hours'
        : 'course_build';
  const note = bottleneck === 'time_feasibility'
    ? `TourAPI ${stages.tourApi}곳 중 카탈로그 후보 ${stages.catalog}곳은 있었지만 시간·최소 체류 1차 컷을 통과한 후보가 없습니다. 장소 데이터 부족이 아니라 입력 시간과 이동수단 제약을 확인해야 합니다.`
    : bottleneck === 'opening_hours'
      ? `시간·최소 체류 통과 ${stages.eligible}곳 중 운영시간 상세 확인 ${stages.openingChecked}곳이 모두 게이트에서 제외됐습니다. 운영시간·행사기간 데이터를 확인해야 합니다.`
      : bottleneck === 'course_build'
        ? `운영시간 통과 ${stages.gated}곳은 있었지만 코스 조립 결과가 없습니다. 최소 체류시간과 이동시간 배분 규칙을 확인해야 합니다.`
    : health === 'SCARCE'
      ? '시간 조건을 통과한 표시 후보가 3곳 미만입니다. 점수 조정보다 후보 데이터 범위·운영시간 게이트를 먼저 확인해야 합니다.'
    : health === 'LIMITED'
      ? '후보 수 또는 상단 카테고리 분포가 제한적입니다. 후보 풀 확대가 필요한지 확인 대상입니다.'
      : '후보 수와 상단 카테고리 분포가 기본 탐색에 충분합니다.';

  return {
    health,
    uniqueCount: unique.size,
    visibleCount: visible.length,
    categoryCounts,
    strategyCounts,
    directMatchCount: visible.filter((spot) => spot.confidence === 'direct_match').length,
    categoryFallbackCount: visible.filter((spot) => spot.confidence === 'category_fallback').length,
    directHoursCount: visible.filter((spot) => spot.opening === 'direct').length,
    weakMapCount: visible.filter((spot) => spot.map === 'weak' || spot.map === 'unverified').length,
    bottleneck,
    note,
    top: visible.map(({ title, category, strategy }) => ({ title, category, strategy })),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtTime(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function renderHtml(audits: ScenarioAudit[]): string {
  const totalCourses = audits.reduce((n, a) => n + a.courses.length, 0);
  const counts = audits.flatMap((a) => a.courses).reduce((o, c) => {
    o[c.status] = (o[c.status] ?? 0) + 1;
    return o;
  }, {} as Record<string, number>);
  const issueCounts = audits.flatMap((a) => a.courses.flatMap((c) => c.issues)).reduce((o, x) => {
    o[x.code] = (o[x.code] ?? 0) + 1;
    return o;
  }, {} as Record<string, number>);
  const healthCounts = audits.reduce((out, audit) => {
    out[audit.candidateDiagnosis.health] = (out[audit.candidateDiagnosis.health] ?? 0) + 1;
    return out;
  }, {} as Record<string, number>);
  const avgVisibleCandidates = audits.length
    ? (audits.reduce((sum, audit) => sum + audit.candidateDiagnosis.visibleCount, 0) / audits.length).toFixed(1)
    : '0';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TimeFit 추천 품질 감사</title>
  <style>
    :root { --bg:#0f1419; --panel:#171d26; --line:#2a3340; --txt:#e6edf3; --muted:#9aa7b4; --pass:#2ea043; --warn:#d29922; --fail:#f85149; --accent:#4cc2ff; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--txt); font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif; }
    header { position:sticky; top:0; background:rgba(15,20,25,.96); border-bottom:1px solid var(--line); padding:18px 22px; z-index:2; }
    h1 { margin:0; font-size:22px; }
    .sub { color:var(--muted); margin-top:6px; font-size:13px; }
    main { padding:18px 22px 40px; max-width:1280px; margin:0 auto; }
    .summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin:14px 0 18px; }
    .tile, .scenario, .course { background:var(--panel); border:1px solid var(--line); border-radius:10px; }
    .tile { padding:13px; }
    .tile b { display:block; font-size:22px; margin-bottom:2px; }
    .tile span { color:var(--muted); font-size:12px; }
    .scenario { margin:16px 0; overflow:hidden; }
    .shead { padding:14px 16px; border-bottom:1px solid var(--line); display:flex; gap:12px; justify-content:space-between; align-items:flex-start; }
    .shead h2 { margin:0; font-size:17px; }
    .meta { color:var(--muted); font-size:12px; margin-top:4px; }
    .courses { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:10px; padding:12px; }
    .course { padding:12px; }
    .top { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:8px; }
    .status { font-weight:800; font-size:12px; border-radius:999px; padding:4px 8px; }
    .PASS { color:white; background:var(--pass); }
    .WARN { color:#111; background:var(--warn); }
    .FAIL { color:white; background:var(--fail); }
    .title { font-weight:800; line-height:1.35; }
    .spots { margin:8px 0; }
    .spot { padding:7px 0; border-top:1px solid rgba(42,51,64,.7); }
    .spot:first-child { border-top:0; }
    .small { color:var(--muted); font-size:12px; line-height:1.55; }
    .metric { display:grid; grid-template-columns:1fr 1fr; gap:6px; color:var(--muted); font-size:12px; margin:8px 0; }
    .metric div { background:#10161d; border:1px solid rgba(42,51,64,.7); border-radius:8px; padding:7px; }
    .issues { margin:8px 0 0; padding:0; list-style:none; }
    .issues li { margin-top:5px; font-size:12px; line-height:1.4; }
    .issues b.fail { color:var(--fail); }
    .issues b.warn { color:var(--warn); }
    .issueTable { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
    .chip { border:1px solid var(--line); border-radius:999px; color:var(--muted); padding:5px 8px; font-size:12px; }
    .candidateDiag { margin:12px; padding:12px; border:1px solid rgba(76,194,255,.3); border-radius:9px; background:rgba(76,194,255,.05); }
    .candidateDiagHead { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .candidateDiagTitle { font-size:13px; font-weight:800; }
    .health { font-size:11px; font-weight:900; padding:4px 7px; border-radius:999px; white-space:nowrap; }
    .health.SUFFICIENT { color:#d7f9dc; background:rgba(46,160,67,.7); }
    .health.LIMITED { color:#211806; background:var(--warn); }
    .health.SCARCE { color:white; background:var(--fail); }
    .candidateList { color:var(--muted); font-size:12px; line-height:1.65; margin-top:8px; }
    .rules { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; margin:16px 0; }
    .rules h2 { margin:0 0 8px; font-size:16px; }
    .rulesGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:8px; }
    .rule { border:1px solid rgba(42,51,64,.8); border-radius:8px; padding:9px; background:#10161d; }
    .rule b { font-size:12px; }
    .rule .desc { color:var(--muted); font-size:12px; margin-top:4px; line-height:1.45; }
    .err { color:var(--fail); padding:14px 16px; }
  </style>
</head>
<body>
  <header>
    <h1>TimeFit 추천 품질 감사 · ${modeKorean[auditMode]}</h1>
    <div class="sub">생성: ${esc(new Date().toLocaleString('ko-KR'))} · 후보 풀 비교는 ${modeKorean[auditMode]} 근사 이동시간 기준입니다.${auditMode === 'transit' ? ' ODsay 정밀화는 호출하지 않습니다.' : ''}${coverageOnly ? ' TourAPI 운영시간 상세 게이트도 생략합니다.' : ''} PASS/WARN/FAIL은 휴리스틱 자동 진단입니다.</div>
  </header>
  <main>
    <section class="summary">
      <div class="tile"><b>${audits.length}</b><span>시나리오</span></div>
      <div class="tile"><b>${totalCourses}</b><span>추천 코스</span></div>
      <div class="tile"><b>${counts.PASS ?? 0}</b><span>PASS</span></div>
      <div class="tile"><b>${counts.WARN ?? 0}</b><span>WARN</span></div>
      <div class="tile"><b>${counts.FAIL ?? 0}</b><span>FAIL</span></div>
    </section>
    <div class="issueTable">
      <span class="chip">표시 후보 평균 ${avgVisibleCandidates}</span>
      <span class="chip">후보 충분 ${healthCounts.SUFFICIENT ?? 0}</span>
      <span class="chip">후보 제한 ${healthCounts.LIMITED ?? 0}</span>
      <span class="chip">후보 부족 ${healthCounts.SCARCE ?? 0}</span>
    </div>
    <div class="issueTable">${strategySummary(audits)}</div>
    <div class="issueTable">${Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip">${esc(k)} ${v}</span>`).join('')}</div>
    <section class="rules">
      <h2>판정 기준</h2>
      <div class="sub">100점에서 이슈별 penalty를 차감합니다. fail 이슈가 하나라도 있거나 60점 미만이면 FAIL, warn 이슈만 있으면 WARN, 이슈가 없으면 PASS입니다.</div>
      <div class="rulesGrid">
        ${RULES.map((r) => `<div class="rule">
          <b class="${r.level === 'FAIL' ? 'fail' : 'warn'}">${esc(r.code)} · ${r.level} · -${r.penalty}</b>
          <div class="desc">${esc(r.desc)}</div>
        </div>`).join('')}
      </div>
    </section>
    ${audits.map(renderScenario).join('')}
  </main>
</body>
</html>`;
}

function strategySummary(audits: ScenarioAudit[]): string {
  const counts = audits.flatMap((a) => a.courses).reduce((o, ca) => {
    const key = ca.metrics.strategy;
    o[key] = (o[key] ?? 0) + 1;
    return o;
  }, {} as Record<string, number>);
  const label: Record<string, string> = {
    origin_area: '출발지 근처',
    destination_area: '약속지 근처',
    route_area: '가는 길 중간',
  };
  return Object.entries(counts)
    .map(([k, v]) => `<span class="chip">${esc(label[k] ?? k)} ${v}</span>`)
    .join('');
}

function renderScenario(a: ScenarioAudit): string {
  const sc = a.scenario;
  return `<section class="scenario">
    <div class="shead">
      <div>
        <h2>${esc(sc.id)}. ${esc(sc.title)}</h2>
        <div class="meta">${esc(sc.origin.label)} -> ${esc(sc.destination?.label ?? '출발지 복귀')} · ${modeKorean[auditMode]} · ${sc.remainingMin}분 · ${sc.dayType} ${fmtTime(sc.nowMin)} ${sc.hourBucket}</div>
      </div>
      <div class="meta">TourAPI 운영확인 가능 ${a.tourApiCount} · 로컬 카탈로그 ${a.candidateCount} · 시간/최소 체류 ${a.eligibleCount} · ${coverageOnly ? '운영시간 생략' : `운영확인 ${a.openingCheckCount} · 영업 ${a.gatedCount}`} · 경로 API ${a.tmapCalls}</div>
    </div>
    ${a.error ? `<div class="err">${esc(a.error)}</div>` : `${renderCandidateDiagnosis(a.candidateDiagnosis)}<div class="courses">${a.courses.map(renderCourse).join('')}</div>`}
  </section>`;
}

function renderCandidateDiagnosis(d: CandidateDiagnosis): string {
  const label: Record<CandidateHealth, string> = { SUFFICIENT: '후보 충분', LIMITED: '후보 제한', SCARCE: '후보 부족' };
  const categoryChips = Object.entries(d.categoryCounts).map(([key, count]) => `${esc(key)} ${count}`).join(' · ') || '없음';
  const strategyChips = Object.entries(d.strategyCounts).map(([key, count]) => `${esc(strategyKorean(key))} ${count}`).join(' · ') || '없음';
  return `<div class="candidateDiag">
    <div class="candidateDiagHead">
      <div>
        <div class="candidateDiagTitle">후보 풀 진단 · 전체 ${d.uniqueCount}곳 / 목록 상단 ${d.visibleCount}곳${d.bottleneck !== 'none' ? ` · 병목 ${d.bottleneck === 'time_feasibility' ? '시간·최소 체류' : d.bottleneck === 'opening_hours' ? '운영시간' : '코스 조립'}` : ''}</div>
        <div class="meta">${esc(d.note)}</div>
      </div>
      <span class="health ${d.health}">${label[d.health]}</span>
    </div>
    <div class="candidateList">카테고리: ${categoryChips}<br />전략: ${strategyChips}<br />직접 매칭 ${d.directMatchCount} · 카테고리 폴백 ${d.categoryFallbackCount} · 운영시간 직접 근거 ${d.directHoursCount} · 지도 검증 약함 ${d.weakMapCount}</div>
    <div class="candidateList">상단 후보: ${d.top.map((spot, index) => `${index + 1}. ${esc(spot.title)} (${esc(spot.category)} · ${esc(strategyKorean(spot.strategy))})`).join(' / ')}</div>
  </div>`;
}

function renderCourse(ca: CourseAudit): string {
  const c = ca.course;
  return `<article class="course">
    <div class="top">
      <div class="title">${esc(c.type)} · ${esc(c.spots.map((s) => s.title).join(' + '))}</div>
      <span class="status ${ca.status}">${ca.status} ${ca.score}</span>
    </div>
    <div class="small">${esc(strategyKorean(ca.metrics.strategy))} · ${esc(c.why ?? '')}</div>
    <div class="spots">${c.spots.map((s) => `<div class="spot">
      <div>${esc(s.title)}</div>
      <div class="small">${esc(s.category)} · 권장 ${s.dwell}분 · ${s.confidence}</div>
    </div>`).join('')}</div>
    <div class="metric">
      <div>도보 이동 ${ca.metrics.walkMoveMin}분<br />체류 가능 ${ca.metrics.walkStayMin}분</div>
      <div>자동차 이동 ${ca.metrics.carMoveMin}분<br />체류 가능 ${ca.metrics.carStayMin}분</div>
      <div>최선 수단 ${esc(ca.metrics.bestMode === 'car' ? '자동차' : ca.metrics.bestMode === 'transit' ? '대중교통' : '도보')}<br />최선 체류 ${ca.metrics.bestStayMin}분</div>
      <div>우회율 ${ca.metrics.detourRatio ?? '-'}<br />장소간 도보 ${ca.metrics.pairWalkMin ?? '-'}분</div>
    </div>
    ${ca.issues.length ? `<ul class="issues">${ca.issues.map((i) => `<li><b class="${i.level}">${esc(i.code)}</b> ${esc(i.message)}</li>`).join('')}</ul>` : '<div class="small">자동 진단 이슈 없음</div>'}
  </article>`;
}

function strategyKorean(strategy: string): string {
  if (strategy === 'destination_area') return '약속지 근처';
  if (strategy === 'route_area') return '가는 길 중간';
  return '출발지 근처';
}

async function runScenario(sc: Scenario): Promise<ScenarioAudit> {
  try {
    const result = await planTimeFit({
      origin: sc.origin,
      destination: sc.destination,
      remainingMin: sc.remainingMin,
      mode: auditMode,
      deferTransitRefinement: auditMode === 'transit',
      deferOpeningGate: coverageOnly,
      nowMin: sc.nowMin,
      dayType: sc.dayType,
      hourBucket: sc.hourBucket,
    });
    return {
      scenario: sc,
      tourApiCount: result.tourApiCount,
      candidateCount: result.candidateCount,
      eligibleCount: result.eligibleCount,
      openingCheckCount: result.openingCheckCount,
      gatedCount: result.gatedCount,
      tmapCalls: result.tmapOk + result.tmapFail,
      courses: result.courses.map((c) => auditCourse(sc, c)),
      candidateDiagnosis: diagnoseCandidates([...result.courses, ...result.pending], {
        tourApi: result.tourApiCount,
        catalog: result.candidateCount,
        eligible: result.eligibleCount,
        openingChecked: result.openingCheckCount,
        gated: result.gatedCount,
      }),
    };
  } catch (e: any) {
    return {
      scenario: sc,
      tourApiCount: 0,
      candidateCount: 0,
      eligibleCount: 0,
      openingCheckCount: 0,
      gatedCount: 0,
      tmapCalls: 0,
      courses: [],
      candidateDiagnosis: diagnoseCandidates([], { tourApi: 0, catalog: 0, eligible: 0, openingChecked: 0, gated: 0 }),
      error: e?.message ?? String(e),
    };
  }
}

async function main() {
  const limit = Number.parseInt(process.env.AUDIT_LIMIT ?? '', 10);
  const ids = new Set((process.env.AUDIT_IDS ?? '').split(',').map((id: string) => id.trim()).filter(Boolean));
  const selected = ids.size ? scenarios.filter((scenario) => ids.has(scenario.id)) : scenarios;
  const pick = Number.isFinite(limit) && limit > 0 ? selected.slice(0, limit) : selected;
  const audits: ScenarioAudit[] = [];
  const originalRandom = Math.random;
  Math.random = seededRandom(20260808);
  try {
    for (const [i, sc] of pick.entries()) {
      process.stdout.write(`[${i + 1}/${pick.length}] ${sc.title} ... `);
      const audit = await runScenario(sc);
      audits.push(audit);
      const counts = audit.courses.reduce((o, c) => {
        o[c.status] = (o[c.status] ?? 0) + 1;
        return o;
      }, {} as Record<string, number>);
      console.log(`courses=${audit.courses.length} pass=${counts.PASS ?? 0} warn=${counts.WARN ?? 0} fail=${counts.FAIL ?? 0} routeApi=${audit.tmapCalls}`);
    }
  } finally {
    Math.random = originalRandom;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, renderHtml(audits));

  const all = audits.flatMap((a) => a.courses);
  const statusCounts = all.reduce((o, c) => {
    o[c.status] = (o[c.status] ?? 0) + 1;
    return o;
  }, {} as Record<string, number>);
  console.log(`\nreport: ${OUT}`);
  console.log(`summary: scenarios=${audits.length} courses=${all.length} PASS=${statusCounts.PASS ?? 0} WARN=${statusCounts.WARN ?? 0} FAIL=${statusCounts.FAIL ?? 0}`);
}

main();
