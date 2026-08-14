#!/usr/bin/env node
// TourAPI 원본 ID가 없는 권역형 장소의 지자체·상인회 후속 조사 대기열을 만든다.
import fs from 'node:fs';

const REVIEW = 'data/processed/review/권역형장소_운영시간근거_검토.json';
const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/권역형장소_공식출처조사_대기열.json';

const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const byContentId = new Map([...catalog.matched.data, ...catalog.unmatched.data].map((place) => [place.contentId, place]));

const initialFindings = {
  poi_618: {
    sourceUrl: 'https://www.busan.go.kr/futureheritage/future02/view?bbsNo=11&curPage=1&dataNo=5733',
    sourceName: '부산미래유산 - 보수동 책방골목',
    finding: '부산시 미래유산이자 2020년 전통시장 등록 장소임을 확인했으나, 전체 골목의 운영시간은 제공하지 않음.',
    timeEvidence: '없음',
  },
  poi_755: {
    sourceUrl: 'https://www.gijang.go.kr/tour/index.gijang?menuCd=DOM_000000306003000000',
    sourceName: '기장군 문화관광 - 오시리아 관광단지',
    finding: '기장군 공식 관광 페이지에 오시리아 해안산책로의 위치가 수록됐으나, 접근 또는 이용 시간은 제공하지 않음.',
    timeEvidence: '없음',
  },
  poi_704: {
    sourceUrl: 'https://www.suyeong.go.kr/board/view.suyeong?boardId=LIFE&dataSid=532&menuCd=DOM_000000113003000000&startPage=1',
    sourceName: '수영구청 - 광안종합시장 전통시장 정보',
    finding: '구청 전통시장 페이지에 10:00~20:00이 명시됐지만 최종 수정일이 2019-10-16이다. 최신성 확인 전까지 추천 시간대에 사용하지 않음.',
    timeEvidence: '시간 범위 있음, 갱신 필요',
  },
  poi_781: {
    sourceUrl: 'https://www.busan.go.kr/nbtnewsBU/1516232?curPage=751&srchBeginDt=&srchCtgry=&srchEndDt=&srchKey=&srchText=',
    sourceName: '부산광역시 보도자료 - 충무동 새벽·해안시장 현장 방문',
    finding: '새벽 시간대에 시장 활동이 있었던 과거 행사 기록이며, 반복 운영시간 근거가 아니므로 추천 시간대에 사용하지 않음.',
    timeEvidence: '행사·현장 기록만 있음',
  },
};

function districtFromAddress(address) {
  const match = address.match(/부산(?:광역시)?\s+([^\s]+(?:구|군))/);
  return match?.[1] ?? '확인 필요';
}

function requiredSource(subCategory) {
  if (subCategory === '시장') return '상인회·전통시장 공식 채널 또는 구청 전통시장 담당 부서';
  if (subCategory === '문화마을') return '구·군 문화관광 부서 또는 마을 운영 주체';
  return '구·군 문화관광 부서 또는 공식 관광 안내 페이지';
}

const rows = review.data
  .filter((row) => row.priority === '1순위')
  .map((row) => ({ row, place: byContentId.get(row.contentId) }))
  .filter(({ place }) => place && !place.tourapiContentId)
  .map(({ row, place }) => {
    const initialFinding = initialFindings[row.contentId] ?? null;
    return {
      contentId: row.contentId,
      title: row.title,
      subCategory: row.subCategory,
      address: place.addr1,
      district: districtFromAddress(place.addr1),
      requiredSource: requiredSource(row.subCategory),
      status: initialFinding?.timeEvidence === '시간 범위 있음, 갱신 필요'
        ? '공식시간근거확인_갱신필요'
        : initialFinding ? '공식장소근거확인_시간근거없음' : '공식시간근거조사대기',
      initialFinding,
    };
  });

fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    purpose: '권역형 장소를 시간대 근거 없이 자동 추천하지 않기 위한 공식 출처 조사 대기열',
    acceptanceRule: '전체 장소 또는 권역의 반복 이용 가능 시간이 명시된 공식 출처만 area_availability_policy.json에 추가한다.',
  },
  summary: {
    total: rows.length,
    byStatus: Object.fromEntries([...rows.reduce((counts, row) => {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      return counts;
    }, new Map()).entries()]),
  },
  data: rows,
}, null, 2)}\n`);

console.log(`권역형 공식 출처 조사 대기열: ${rows.length}건 -> ${OUTPUT}`);
