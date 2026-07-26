import fs from 'node:fs';
import path from 'node:path';
import { Course, DayType, getOdsayTransitUsage, HourBucket, LatLon, planTimeFit } from '../src/engine';

type Place = LatLon & { label: string };
type Scenario = {
  id: string;
  title: string;
  origin: Place;
  destination: Place;
  remainingMin: number;
  dayType: DayType;
  hourBucket: HourBucket;
  nowMin: number;
};
type Issue = { level: 'fail' | 'warn'; code: string; message: string; penalty: number };
type CourseAudit = {
  status: 'PASS' | 'WARN' | 'FAIL';
  score: number;
  course: Course;
  issues: Issue[];
  metrics: {
    moveMin: number;
    stayMin: number;
    odsayLegs: number;
    walkShortLegs: number;
    fallbackLegs: number;
    subwayLegs: number;
    movementLegs: number;
    moveRatio: number;
    pairWalkShort: boolean | null;
  };
};
type ScenarioAudit = {
  scenario: Scenario;
  candidateCount: number;
  gatedCount: number;
  odsayCalls: number;
  odsayOk: number;
  odsayFail: number;
  courses: CourseAudit[];
  error?: string;
};

const OUT = path.resolve('docs/reports/transit_recommendation_audit.html');
const MIN_STAY_MIN = 30;

const RULES = [
  { code: 'no_odsay_verified_leg', level: 'FAIL', penalty: 45, desc: '약속장소가 있는 대중교통 코스인데 ODsay 확인 구간이 없음' },
  { code: 'transit_fallback_leg', level: 'WARN', penalty: 18, desc: 'ODsay 실패 후 대중교통 근사값으로 남은 구간 존재' },
  { code: 'low_stay_margin', level: 'WARN', penalty: 20, desc: '대중교통 기준 체류 가능 시간이 40분 미만' },
  { code: 'move_over_stay', level: 'WARN', penalty: 14, desc: '이동시간이 체류 가능 시간보다 김' },
  { code: 'high_move_ratio', level: 'WARN', penalty: 14, desc: '남은 시간 대비 이동시간 비율이 높음' },
  { code: 'far_two_spot_pair', level: 'FAIL', penalty: 35, desc: '2곳 코스인데 장소 간 이동이 도보권이 아님' },
  { code: 'same_food_pair', level: 'FAIL', penalty: 45, desc: '식당 2곳 코스' },
  { code: 'same_cafe_pair', level: 'WARN', penalty: 20, desc: '카페 2곳 코스' },
  { code: 'lodging_keyword', level: 'FAIL', penalty: 100, desc: '숙박성 키워드 포함' },
  { code: 'utility_keyword', level: 'FAIL', penalty: 90, desc: '주차장/병원/주유소 등 부적합 시설 키워드 포함' },
] as const;

const P = {
  seomyeon: { label: '서면역', lat: 35.1578, lon: 129.0594 },
  sasang: { label: '사상역', lat: 35.1622, lon: 128.9847 },
  busanStation: { label: '부산역', lat: 35.1151, lon: 129.0413 },
  haeundae: { label: '해운대역', lat: 35.1630, lon: 129.1580 },
  bexco: { label: '벡스코', lat: 35.1690, lon: 129.1365 },
  gwangalli: { label: '광안리해수욕장', lat: 35.1532, lon: 129.1186 },
  centum: { label: '센텀시티역', lat: 35.1689, lon: 129.1317 },
  nampo: { label: '남포역', lat: 35.0986, lon: 129.0341 },
  dongnae: { label: '동래역', lat: 35.2055, lon: 129.0785 },
  pnu: { label: '부산대역', lat: 35.2301, lon: 129.0881 },
  gimhaeAirport: { label: '김해공항', lat: 35.1796, lon: 128.9382 },
} satisfies Record<string, Place>;

const scenarios: Scenario[] = [
  s('T01', '서면 -> 사상역 120분', P.seomyeon, P.sasang, 120, '주말', '오후', 14),
  s('T02', '서면 -> 부산역 120분', P.seomyeon, P.busanStation, 120, '평일', '오후', 14),
  s('T03', '해운대 -> 벡스코 90분', P.haeundae, P.bexco, 90, '평일', '오후', 15),
  s('T04', '광안리 -> 센텀 120분', P.gwangalli, P.centum, 120, '주말', '오후', 15),
  s('T05', '부산역 -> 남포 90분', P.busanStation, P.nampo, 90, '평일', '오후', 14),
  s('T06', '동래 -> 부산대 120분', P.dongnae, P.pnu, 120, '주말', '오후', 15),
  s('T07', '사상역 -> 김해공항 150분', P.sasang, P.gimhaeAirport, 150, '평일', '오후', 15),
];

function s(
  id: string,
  title: string,
  origin: Place,
  destination: Place,
  remainingMin: number,
  dayType: DayType,
  hourBucket: HourBucket,
  hour: number,
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

function walkApproxMin(a: LatLon, b: LatLon): number {
  return Math.round((haversineKm(a, b) * 1.25) / 4.5 * 60);
}

function auditCourse(sc: Scenario, course: Course): CourseAudit {
  const transit = course.mobility?.transit;
  const moveMin = transit?.moveMin ?? course.totalMin;
  const stayMin = transit?.stayMin ?? 0;
  const movementLegs = course.legs.filter((leg) => !leg.label.startsWith('체류'));
  const odsayLegs = movementLegs.filter((leg) => leg.src === 'ODsay').length;
  const walkShortLegs = movementLegs.filter((leg) => leg.src === 'walk_short').length;
  const fallbackLegs = movementLegs.filter((leg) => leg.src === 'transit_fallback').length;
  const subwayLegs = movementLegs.filter((leg) => leg.src === 'ODsay' && /지하철|부산\s*\d호선|호선/.test(leg.label)).length;
  const pairWalkShort = course.spots.length === 2 ? walkApproxMin(course.spots[0], course.spots[1]) <= 10 : null;
  const issues: Issue[] = [];
  const add = (level: Issue['level'], code: string, message: string, penalty: number) => {
    issues.push({ level, code, message, penalty });
  };
  const titles = course.spots.map((p) => p.title).join(' + ');
  const categories = course.spots.map((p) => p.category);

  if (odsayLegs === 0) add('fail', 'no_odsay_verified_leg', 'ODsay로 확인된 대중교통 구간이 없습니다.', 45);
  if (fallbackLegs > 0) add('warn', 'transit_fallback_leg', `대중교통 근사 구간이 ${fallbackLegs}개 남아 있습니다.`, 18);
  if (stayMin < MIN_STAY_MIN) add('fail', 'below_min_stay', `체류 가능 시간이 ${stayMin}분입니다.`, 60);
  else if (stayMin < 40) add('warn', 'low_stay_margin', `체류 가능 시간이 ${stayMin}분입니다.`, 20);
  if (moveMin > stayMin) add('warn', 'move_over_stay', `이동 ${moveMin}분, 체류 가능 ${stayMin}분입니다.`, 14);
  if (moveMin / Math.max(sc.remainingMin, 1) >= 0.45) add('warn', 'high_move_ratio', `이동시간이 입력 시간의 ${Math.round((moveMin / sc.remainingMin) * 100)}%입니다.`, 14);
  if (course.spots.length === 2 && pairWalkShort === false) add('fail', 'far_two_spot_pair', '2곳 코스의 장소 간 이동이 도보 10분을 넘습니다.', 35);
  if (course.spots.length === 2 && categories.every((x) => x === '식당')) add('fail', 'same_food_pair', '식당 2곳 코스입니다.', 45);
  if (course.spots.length === 2 && categories.every((x) => x === '카페')) add('warn', 'same_cafe_pair', '카페 2곳 코스입니다.', 20);
  if (/호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|여인숙|호스텔|콘도/i.test(titles)) {
    add('fail', 'lodging_keyword', '숙박성 키워드가 포함됐습니다.', 100);
  }
  if (/주차장|병원|의원|진료소|약국|주유소|충전소|정비소/i.test(titles)) {
    add('fail', 'utility_keyword', '자투리 시간 추천에 부적합한 시설 키워드가 포함됐습니다.', 90);
  }

  const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + issue.penalty, 0));
  const status = issues.some((issue) => issue.level === 'fail') || score < 60 ? 'FAIL' : issues.length ? 'WARN' : 'PASS';
  return {
    status,
    score,
    course,
    issues,
    metrics: {
      moveMin,
      stayMin,
      odsayLegs,
      walkShortLegs,
      fallbackLegs,
      subwayLegs,
      movementLegs: movementLegs.length,
      moveRatio: Math.round((moveMin / Math.max(sc.remainingMin, 1)) * 100),
      pairWalkShort,
    },
  };
}

async function runScenario(sc: Scenario): Promise<ScenarioAudit> {
  const before = await getOdsayTransitUsage();
  try {
    const result = await planTimeFit({
      origin: sc.origin,
      destination: sc.destination,
      remainingMin: sc.remainingMin,
      mode: 'transit',
      nowMin: sc.nowMin,
      dayType: sc.dayType,
      hourBucket: sc.hourBucket,
    });
    const after = await getOdsayTransitUsage();
    return {
      scenario: sc,
      candidateCount: result.candidateCount,
      gatedCount: result.gatedCount,
      odsayCalls: after.total - before.total,
      odsayOk: after.ok - before.ok,
      odsayFail: after.fail - before.fail,
      courses: result.courses.map((course) => auditCourse(sc, course)),
    };
  } catch (e: any) {
    const after = await getOdsayTransitUsage();
    return {
      scenario: sc,
      candidateCount: 0,
      gatedCount: 0,
      odsayCalls: after.total - before.total,
      odsayOk: after.ok - before.ok,
      odsayFail: after.fail - before.fail,
      courses: [],
      error: e?.message ?? String(e),
    };
  }
}

function statusCounts(courses: CourseAudit[]): Record<string, number> {
  return courses.reduce((out, course) => {
    out[course.status] = (out[course.status] ?? 0) + 1;
    return out;
  }, {} as Record<string, number>);
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtTime(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

function renderHtml(audits: ScenarioAudit[]): string {
  const all = audits.flatMap((audit) => audit.courses);
  const counts = statusCounts(all);
  const calls = audits.reduce((sum, audit) => sum + audit.odsayCalls, 0);
  const ok = audits.reduce((sum, audit) => sum + audit.odsayOk, 0);
  const fail = audits.reduce((sum, audit) => sum + audit.odsayFail, 0);
  const issueCounts = all.flatMap((course) => course.issues).reduce((out, issue) => {
    out[issue.code] = (out[issue.code] ?? 0) + 1;
    return out;
  }, {} as Record<string, number>);
  const legTotals = all.reduce((out, course) => {
    out.odsay += course.metrics.odsayLegs;
    out.walkShort += course.metrics.walkShortLegs;
    out.fallback += course.metrics.fallbackLegs;
    out.subway += course.metrics.subwayLegs;
    return out;
  }, { odsay: 0, walkShort: 0, fallback: 0, subway: 0 });

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TimeFit 대중교통 추천 자동진단</title>
  <style>
    :root { --bg:#0f1419; --panel:#171d26; --line:#2a3340; --txt:#e6edf3; --muted:#9aa7b4; --pass:#2ea043; --warn:#d29922; --fail:#f85149; --accent:#4cc2ff; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--txt); font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif; }
    header { position:sticky; top:0; background:rgba(15,20,25,.96); border-bottom:1px solid var(--line); padding:18px 22px; z-index:2; }
    h1 { margin:0; font-size:22px; }
    main { padding:18px 22px 40px; max-width:1280px; margin:0 auto; }
    .sub, .meta, .small { color:var(--muted); font-size:12px; line-height:1.55; }
    .summary { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin:14px 0 18px; }
    .tile, .scenario, .course, .rules { background:var(--panel); border:1px solid var(--line); border-radius:10px; }
    .tile { padding:13px; }
    .tile b { display:block; font-size:22px; margin-bottom:2px; }
    .scenario { margin:16px 0; overflow:hidden; }
    .shead { padding:14px 16px; border-bottom:1px solid var(--line); display:flex; gap:12px; justify-content:space-between; align-items:flex-start; }
    .shead h2 { margin:0; font-size:17px; }
    .courses { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:10px; padding:12px; }
    .course { padding:12px; }
    .top { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:8px; }
    .title { font-weight:800; line-height:1.35; }
    .status { font-weight:800; font-size:12px; border-radius:999px; padding:4px 8px; white-space:nowrap; }
    .PASS { color:white; background:var(--pass); }
    .WARN { color:#111; background:var(--warn); }
    .FAIL { color:white; background:var(--fail); }
    .metric { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin:9px 0; }
    .metric div { background:#10161d; border:1px solid rgba(42,51,64,.7); border-radius:8px; padding:7px; font-size:12px; color:var(--muted); line-height:1.55; }
    .spots { margin:8px 0; }
    .spot { padding:7px 0; border-top:1px solid rgba(42,51,64,.7); }
    .spot:first-child { border-top:0; }
    .issues { margin:8px 0 0; padding:0; list-style:none; }
    .issues li { margin-top:5px; font-size:12px; line-height:1.4; }
    .issues b.fail { color:var(--fail); }
    .issues b.warn { color:var(--warn); }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 14px; }
    .chip { border:1px solid var(--line); border-radius:999px; color:var(--muted); padding:5px 8px; font-size:12px; }
    .rules { padding:14px; margin:16px 0; }
    .rules h2 { margin:0 0 8px; font-size:16px; }
    .rulesGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:8px; }
    .rule { border:1px solid rgba(42,51,64,.8); border-radius:8px; padding:9px; background:#10161d; }
    .err { color:var(--fail); padding:14px 16px; }
    @media (max-width: 760px) { .summary { grid-template-columns:repeat(2,minmax(0,1fr)); } .shead { display:block; } }
  </style>
</head>
<body>
  <header>
    <h1>TimeFit 대중교통 추천 자동진단</h1>
    <div class="sub">생성: ${esc(new Date().toLocaleString('ko-KR'))} · ODsay 호출량과 추천 품질을 함께 점검합니다.</div>
  </header>
  <main>
    <section class="summary">
      <div class="tile"><b>${audits.length}</b><span class="small">시나리오</span></div>
      <div class="tile"><b>${all.length}</b><span class="small">추천 코스</span></div>
      <div class="tile"><b>${counts.PASS ?? 0}</b><span class="small">PASS</span></div>
      <div class="tile"><b>${counts.WARN ?? 0}</b><span class="small">WARN</span></div>
      <div class="tile"><b>${counts.FAIL ?? 0}</b><span class="small">FAIL</span></div>
      <div class="tile"><b>${calls}</b><span class="small">ODsay 호출</span></div>
    </section>
    <div class="chips">
      <span class="chip">ODsay 성공 ${ok}</span>
      <span class="chip">ODsay 실패 ${fail}</span>
      <span class="chip">ODsay 구간 ${legTotals.odsay}</span>
      <span class="chip">지하철 구간 ${legTotals.subway}</span>
      <span class="chip">walk_short ${legTotals.walkShort}</span>
      <span class="chip">transit_fallback ${legTotals.fallback}</span>
    </div>
    <div class="chips">${Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip">${esc(k)} ${v}</span>`).join('')}</div>
    <section class="rules">
      <h2>판정 기준</h2>
      <div class="sub">100점에서 이슈별 penalty를 차감합니다. fail 이슈가 하나라도 있거나 60점 미만이면 FAIL, warn 이슈만 있으면 WARN, 이슈가 없으면 PASS입니다.</div>
      <div class="rulesGrid">${RULES.map((rule) => `<div class="rule">
        <b class="${rule.level === 'FAIL' ? 'fail' : 'warn'}">${esc(rule.code)} · ${rule.level} · -${rule.penalty}</b>
        <div class="small">${esc(rule.desc)}</div>
      </div>`).join('')}</div>
    </section>
    ${audits.map(renderScenario).join('')}
  </main>
</body>
</html>`;
}

function renderScenario(audit: ScenarioAudit): string {
  const sc = audit.scenario;
  const counts = statusCounts(audit.courses);
  return `<section class="scenario">
    <div class="shead">
      <div>
        <h2>${esc(sc.id)}. ${esc(sc.title)}</h2>
        <div class="meta">${esc(sc.origin.label)} -> ${esc(sc.destination.label)} · ${sc.remainingMin}분 · ${sc.dayType} ${fmtTime(sc.nowMin)} ${sc.hourBucket}</div>
      </div>
      <div class="meta">후보 ${audit.candidateCount} · 영업 ${audit.gatedCount}<br />ODsay ${audit.odsayCalls}건 · 성공 ${audit.odsayOk} · 실패 ${audit.odsayFail}<br />PASS ${counts.PASS ?? 0} · WARN ${counts.WARN ?? 0} · FAIL ${counts.FAIL ?? 0}</div>
    </div>
    ${audit.error ? `<div class="err">${esc(audit.error)}</div>` : `<div class="courses">${audit.courses.map(renderCourse).join('')}</div>`}
  </section>`;
}

function renderCourse(audit: CourseAudit): string {
  const c = audit.course;
  const m = audit.metrics;
  return `<article class="course">
    <div class="top">
      <div class="title">${esc(c.type)} · ${esc(c.spots.map((spot) => spot.title).join(' + '))}</div>
      <span class="status ${audit.status}">${audit.status} ${audit.score}</span>
    </div>
    <div class="small">${esc(c.why ?? '')}</div>
    <div class="spots">${c.spots.map((spot) => `<div class="spot">
      <div>${esc(spot.title)}</div>
      <div class="small">${esc(spot.category)} · 권장 ${spot.dwell}분 · ${spot.confidence}</div>
    </div>`).join('')}</div>
    <div class="metric">
      <div>이동 ${m.moveMin}분<br />체류 가능 ${m.stayMin}분</div>
      <div>ODsay ${m.odsayLegs}/${m.movementLegs}<br />walk_short ${m.walkShortLegs}</div>
      <div>fallback ${m.fallbackLegs}<br />지하철 ${m.subwayLegs}</div>
      <div>이동 비율 ${m.moveRatio}%<br />장소간 도보권 ${m.pairWalkShort ?? '-'}</div>
      <div>타입 ${esc(c.type)}<br />전략 ${esc(c.strategy ?? '')}</div>
      <div>여유 ${c.bufferLeftMin}분<br />총 ${c.totalMin}분</div>
    </div>
    <div class="small">${c.legs.filter((leg) => !leg.label.startsWith('체류')).map((leg) => `${leg.label} ${leg.min}분 [${leg.src}]`).map(esc).join('<br />')}</div>
    ${audit.issues.length ? `<ul class="issues">${audit.issues.map((issue) => `<li><b class="${issue.level}">${esc(issue.code)}</b> ${esc(issue.message)}</li>`).join('')}</ul>` : '<div class="small">자동 진단 이슈 없음</div>'}
  </article>`;
}

async function main() {
  const limit = Number.parseInt(process.env.AUDIT_LIMIT ?? '', 10);
  const pick = Number.isFinite(limit) && limit > 0 ? scenarios.slice(0, limit) : scenarios;
  const audits: ScenarioAudit[] = [];
  for (const [idx, scenario] of pick.entries()) {
    process.stdout.write(`[${idx + 1}/${pick.length}] ${scenario.title} ... `);
    const audit = await runScenario(scenario);
    audits.push(audit);
    const counts = statusCounts(audit.courses);
    console.log(`courses=${audit.courses.length} pass=${counts.PASS ?? 0} warn=${counts.WARN ?? 0} fail=${counts.FAIL ?? 0} odsay=${audit.odsayCalls} ok=${audit.odsayOk} failApi=${audit.odsayFail}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, renderHtml(audits));

  const all = audits.flatMap((audit) => audit.courses);
  const counts = statusCounts(all);
  const calls = audits.reduce((sum, audit) => sum + audit.odsayCalls, 0);
  console.log(`\nreport: ${OUT}`);
  console.log(`summary: scenarios=${audits.length} courses=${all.length} PASS=${counts.PASS ?? 0} WARN=${counts.WARN ?? 0} FAIL=${counts.FAIL ?? 0} ODsay=${calls}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
