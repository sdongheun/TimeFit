#!/usr/bin/env node
// 소수의 의미 있는 생활권 거점↔대표 장소 실제 TMAP 도보 경로를 수동 감사 스냅샷으로 보존한다.
import fs from 'node:fs';
const OUTPUT = 'data/processed/review/장소쌍_실경로_스냅샷.json';
const key = process.env.EXPO_PUBLIC_TMAP_APP_KEY || process.env.TMAP_APP_KEY;
if (!key) throw new Error('TMAP key required');
const basePairs = [
  { id: 'PAIR-NAMPO-JAGALCHI-DEMOCRACY', area: '중구', from: { id: 'poi_13', title: '부산 자갈치시장(관광·상권 진입점)', lat: 35.0966511661, lon: 129.0306042201 }, to: { id: 'poi_165', title: '민주공원(관광 거점)', lat: 35.1093802515, lon: 129.0281096457 } },
  { id: 'PAIR-SEOMYEON-COFFEE-JEONPO', area: '부산진구', from: { id: 'poi_1051', title: '커피스가모 인 서면(서면 약속 거점)', lat: 35.15878, lon: 129.05403 }, to: { id: 'poi_213', title: '전포 삼거리(전포 상권 진입점)', lat: 35.1536149962, lon: 129.071940736 } },
  { id: 'PAIR-HAEUNDAE-MOVIE-DONGBACK', area: '해운대구', from: { id: 'poi_174', title: '부산 영화의 거리(관광 거점)', lat: 35.1549495207, lon: 129.1444371716 }, to: { id: 'poi_19', title: '동백공원(관광 거점)', lat: 35.1536609221, lon: 129.1523226328 } },
  { id: 'PAIR-YEONGDO-MARKET-JEOLYEONG', area: '영도구', from: { id: 'poi_107', title: '영도봉래시장(상권 진입점)', lat: 35.0927462941, lon: 129.0439559432 }, to: { id: 'poi_214', title: '절영해안산책로(관광 거점)', lat: 35.0812475294, lon: 129.0411870536 } },
  { id: 'PAIR-NAMPO-DEMOCRACY-YOUNGJU', area: '중구', from: { id: 'poi_165', title: '민주공원(관광 거점)', lat: 35.1093802515, lon: 129.0281096457 }, to: { id: 'poi_203', title: '영주하늘눈전망대(야외 전망 거점)', lat: 35.1146102693, lon: 129.0307259427 } },
  { id: 'PAIR-NAMPO-YOUNGJU-JAGALCHI', area: '중구', from: { id: 'poi_203', title: '영주하늘눈전망대(야외 전망 거점)', lat: 35.1146102693, lon: 129.0307259427 }, to: { id: 'poi_13', title: '부산 자갈치시장(관광·상권 진입점)', lat: 35.0966511661, lon: 129.0306042201 } },
  { id: 'PAIR-NAMPO-YOUNGJU-DAECHEONG', area: '중구', from: { id: 'poi_203', title: '영주하늘눈전망대(야외 전망 거점)', lat: 35.1146102693, lon: 129.0307259427 }, to: { id: 'poi_745', title: '대청스카이전망대(야외 전망 거점)', lat: 35.107513, lon: 129.02963 } },
  { id: 'PAIR-NAMPO-DAECHEONG-JAGALCHI', area: '중구', from: { id: 'poi_745', title: '대청스카이전망대(야외 전망 거점)', lat: 35.107513, lon: 129.02963 }, to: { id: 'poi_13', title: '부산 자갈치시장(관광·상권 진입점)', lat: 35.0966511661, lon: 129.0306042201 } },
  { id: 'PAIR-NAMPO-DEMOCRACY-HISTORY', area: '중구', from: { id: 'poi_165', title: '민주공원(관광 거점)', lat: 35.1093802515, lon: 129.0281096457 }, to: { id: 'poi_92', title: '부산근현대역사관 본관(별도 약속 거점)', lat: 35.1027616225, lon: 129.032190027 } },
  { id: 'PAIR-NAMPO-YOUNGJU-HISTORY', area: '중구', from: { id: 'poi_203', title: '영주하늘눈전망대(야외 전망 거점)', lat: 35.1146102693, lon: 129.0307259427 }, to: { id: 'poi_92', title: '부산근현대역사관 본관(별도 약속 거점)', lat: 35.1027616225, lon: 129.032190027 } },
  { id: 'PAIR-NAMPO-DAECHEONG-HISTORY', area: '중구', from: { id: 'poi_745', title: '대청스카이전망대(야외 전망 거점)', lat: 35.107513, lon: 129.02963 }, to: { id: 'poi_92', title: '부산근현대역사관 본관(별도 약속 거점)', lat: 35.1027616225, lon: 129.032190027 } },
];
const pairs = basePairs.flatMap((pair) => [pair, { ...pair, id: `${pair.id}-RETURN`, from: pair.to, to: pair.from }]);
async function query(pair) {
  const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', { method: 'POST', headers: { appKey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ startX: pair.from.lon, startY: pair.from.lat, endX: pair.to.lon, endY: pair.to.lat, reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO', startName: '출발', endName: '도착' }) });
  if (!res.ok) return { ...pair, fromId: pair.from.id, toId: pair.to.id, status: 'failed', httpStatus: res.status };
  const json = await res.json(); const prop = json?.features?.[0]?.properties ?? {};
  return { ...pair, fromId: pair.from.id, toId: pair.to.id, status: Number.isFinite(prop.totalTime) ? 'ok' : 'invalid_response', mode: 'walk', totalMoveMin: Math.round(prop.totalTime / 60), totalDistanceM: prop.totalDistance ?? null, provider: 'TMAP pedestrian routes', retrievedAt: new Date().toISOString(), responseSummary: { featureCount: json?.features?.length ?? 0, totalTimeSec: prop.totalTime ?? null, totalDistance: prop.totalDistance ?? null } };
}
const data=[]; for (const pair of pairs) { data.push(await query(pair)); await new Promise((r) => setTimeout(r, 150)); }
fs.writeFileSync(OUTPUT, `${JSON.stringify({ meta: { generatedAt: new Date().toISOString(), purpose: 'route_verified_measurement에 연결 가능한 실제 TMAP 도보 장소쌍 스냅샷', calls: data.length }, summary: { ok: data.filter((x) => x.status === 'ok').length, failed: data.filter((x) => x.status !== 'ok').length }, data }, null, 2)}\n`);
console.log(`실경로 스냅샷: ${data.filter((x) => x.status === 'ok').length}/${data.length}`);
