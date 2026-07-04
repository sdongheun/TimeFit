// 지연 정밀화 엔진 라이브 검증 (규칙4)
// 사용: export $(grep -E '^EXPO_PUBLIC' .env | xargs) && npx tsx scripts/test_lazy_engine.ts
import { planTimeFit, refineCourses } from '../src/engine';

const assert = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};

async function run(name: string, input: Parameters<typeof planTimeFit>[0]) {
  console.log(`\n━━ ${name} ━━`);
  const r = await planTimeFit(input);
  const calls = r.tmapOk + r.tmapFail;
  console.log(`후보 ${r.candidateCount} · 게이트 ${r.gatedCount} · TMAP ${r.tmapOk}/${calls} · 코스 ${r.courses.length} · 대기열 ${r.pending.length}`);
  for (const c of r.courses) {
    const geoPts = c.legs.reduce((n, l) => n + (l.geo?.length ?? 0), 0);
    console.log(`  [${c.type}] ${c.spots.map((s) => `${s.title}(${s.category})`).join(' + ')} · 총 ${c.totalMin}분 · ${c.why} · 경로 ${geoPts}pt`);
  }
  // 1) 지연 정밀화: 호출 수 급감 (기존 ~54건, 배치 5개)
  assert('TMAP 호출 ≤ 25', calls <= 25, `${calls}건`);
  // 2) 배치 크기: 1~5개
  assert('코스 1~5개', r.courses.length >= 1 && r.courses.length <= 5, `${r.courses.length}개`);
  // 3) 정밀화 후 예산 재검증 통과
  assert('전 코스 예산 내', r.courses.every((c) => c.totalMin <= r.budgetMin), r.courses.map((c) => c.totalMin).join(','));
  // 4) 실경로 geometry (TMAP 성공 시)
  const withGeo = r.courses.filter((c) => c.legs.some((l) => (l.geo?.length ?? 0) > 1));
  assert('실경로 geometry 코스 ≥ 1', r.tmapOk === 0 || withGeo.length >= 1, `${withGeo.length}/${r.courses.length}`);
  // 5) TMAP 정밀 구간 반영
  const tmapLegs = r.courses.flatMap((c) => c.legs).filter((l) => l.src === 'TMAP').length;
  assert('TMAP 정밀 구간 존재', r.tmapOk === 0 || tmapLegs > 0, `${tmapLegs}개 구간`);
  // 6) 혼잡배수 완화: 0.9~1.2 범위
  const mults = r.courses.flatMap((c) => c.spots.map((s) => s.mult));
  assert('혼잡배수 0.9~1.2', mults.every((m) => m >= 0.9 && m <= 1.2), mults.join(','));
  // 8) 랭킹 v1: 카테고리 다양성 — 상위 배치에서 같은 카테고리 3개 초과 금지
  const catCount: Record<string, number> = {};
  r.courses.forEach((c) => c.spots.forEach((s) => { catCount[s.category] = (catCount[s.category] ?? 0) + 1; }));
  const maxCat = Math.max(...Object.values(catCount));
  assert('동일 카테고리 ≤ 3', maxCat <= 3, JSON.stringify(catCount));
  // 9) 랭킹 근거(why) 부착
  assert('전 코스 why 보유', r.courses.every((c) => !!c.why), r.courses[0]?.why ?? '');
  // 7) "다른 코스 보기" 시뮬레이션 — 대기열에서 다음 배치, 기존과 중복 없음
  if (r.pending.length) {
    const dest = (input.destination ?? null) as { lat: number; lon: number } | null;
    const nx = await refineCourses(r.pending, input.origin, dest, input.mode, input.remainingMin, 5);
    const key = (c: typeof r.courses[0]) => c.spots.map((s) => s.title).sort().join('|');
    const dup = nx.courses.filter((c) => r.courses.some((o) => key(o) === key(c)));
    console.log(`  ↻ 새로고침: +${nx.courses.length}개 (호출 ${nx.ok + nx.fail}건, 잔여 ${nx.rest.length})`);
    assert('새로고침 배치 중복 없음', dup.length === 0, `중복 ${dup.length}`);
    assert('새로고침 호출 ≤ 25', nx.ok + nx.fail <= 25, `${nx.ok + nx.fail}건`);
  }
}

async function main() {
  const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
  const BUSAN_STN = { lat: 35.1151, lon: 129.0413 };
  // A) 도보 · 왕복 (가장 흔한 케이스)
  await run('A. 도보 120분 왕복 (서면)', {
    origin: SEOMYEON, destination: null, remainingMin: 120, mode: 'walk',
    nowMin: 14 * 60, dayType: '주말', hourBucket: '오후',
  });
  // B) 자차 · 약속 경유 (서면 → 부산역)
  await run('B. 자차 120분 약속 경유 (서면→부산역)', {
    origin: SEOMYEON, destination: BUSAN_STN, remainingMin: 120, mode: 'car',
    nowMin: 14 * 60, dayType: '주말', hourBucket: '오후',
  });
  console.log('\n검증 종료');
}
main();
