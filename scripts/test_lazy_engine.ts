// 지연 정밀화 엔진 라이브 검증 (규칙4)
// 사용: export $(grep -E '^EXPO_PUBLIC' .env | xargs) && npx tsx scripts/test_lazy_engine.ts
import { planTimeFit } from '../src/engine';

const assert = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};

async function run(name: string, input: Parameters<typeof planTimeFit>[0]) {
  console.log(`\n━━ ${name} ━━`);
  const r = await planTimeFit(input);
  const calls = r.tmapOk + r.tmapFail;
  console.log(`후보 ${r.candidateCount} · 게이트 ${r.gatedCount} · TMAP ${r.tmapOk}/${calls} · 코스 ${r.courses.length}`);
  for (const c of r.courses) {
    const geoPts = c.legs.reduce((n, l) => n + (l.geo?.length ?? 0), 0);
    console.log(`  [${c.type}] ${c.spots.map((s) => s.title).join(' + ')} · 총 ${c.totalMin}분 · 여유 ${c.bufferLeftMin}분 · 경로좌표 ${geoPts}개`);
  }
  // 1) 지연 정밀화: 호출 수 급감 (기존 ~54건)
  assert('TMAP 호출 ≤ 20', calls <= 20, `${calls}건`);
  // 2) 코스 산출
  assert('코스 ≥ 1개', r.courses.length >= 1);
  // 3) 정밀화 후 예산 재검증 통과
  assert('전 코스 예산 내', r.courses.every((c) => c.totalMin <= r.budgetMin), r.courses.map((c) => c.totalMin).join(','));
  // 4) 실경로 geometry (TMAP 성공 시)
  const withGeo = r.courses.filter((c) => c.legs.some((l) => (l.geo?.length ?? 0) > 1));
  assert('실경로 geometry 코스 ≥ 1', r.tmapOk === 0 || withGeo.length >= 1, `${withGeo.length}/${r.courses.length}`);
  // 5) TMAP 정밀 구간 반영
  const tmapLegs = r.courses.flatMap((c) => c.legs).filter((l) => l.src === 'TMAP').length;
  assert('TMAP 정밀 구간 존재', r.tmapOk === 0 || tmapLegs > 0, `${tmapLegs}개 구간`);
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
