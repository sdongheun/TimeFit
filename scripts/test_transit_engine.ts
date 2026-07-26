import { getOdsayTransitUsage, planTimeFit } from '../src/engine';

async function main() {
  const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
  const SASANG = { lat: 35.1622, lon: 128.9847 };
  const result = await planTimeFit({
    origin: SEOMYEON,
    destination: SASANG,
    remainingMin: 120,
    mode: 'transit',
    nowMin: 14 * 60,
    dayType: '주말',
    hourBucket: '오후',
  });

  const usage = await getOdsayTransitUsage();
  console.log(`후보 ${result.candidateCount} · 게이트 ${result.gatedCount} · 코스 ${result.courses.length}`);
  console.log(`ODsay 오늘 누적 ${usage.total}건 · 성공 ${usage.ok} · 실패 ${usage.fail}`);
  for (const c of result.courses.slice(0, 10)) {
    const transit = c.mobility?.transit;
    console.log(`[${c.type}] ${c.spots.map((s) => s.title).join(' + ')} · 대중교통 이동 ${transit?.moveMin ?? 0}분 · 체류가능 ${transit?.stayMin ?? 0}분 · ${c.why}`);
    for (const leg of c.legs.filter((l) => !l.label.startsWith('체류'))) {
      console.log(`  - ${leg.label}: ${leg.min}분 [${leg.src}] geo=${leg.geo?.length ?? 0}`);
    }
  }

  if (result.courses.length < 1) throw new Error('대중교통 추천 코스가 없습니다.');
  if (!result.courses.some((c) => c.legs.some((l) => l.src === 'ODsay'))) throw new Error('ODsay 기반 대중교통 구간이 없습니다.');
  if (!result.courses.every((c) => c.bestMode === 'transit')) throw new Error('대중교통 기준 추천이 아닙니다.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
