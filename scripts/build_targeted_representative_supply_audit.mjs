#!/usr/bin/env node
// DATA-SUPPLY-01: 네 관찰 생활권의 기존 비대표 후보만 제한 감사한다.
// 네트워크를 호출하지 않는다. 공식 원문은 검토 시 확인한 URL·요약으로만 보존한다.
import fs from 'node:fs';

const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/생활권_대표후보_보강_감사.json';
const REVIEWED_AT = '2026-09-01';
const REVIEW_DUE_AT = '2026-11-21';

const CANDIDATES = [
  ['poi_41', '서면·전포', 'conditional_more', '교육청 문화예술 체험실은 강좌·대상·회차에 따라 운영되어 일반 20분 방문의 고정 접근 시간으로 구조화하지 못했다.'],
  ['poi_703', '서면·전포', 'conditional_more', '공식 운영 주체가 카페·갤러리·공연·숙박 등 공간별 이용 조건을 분리한다. 개별 전시도 기간·입장료가 달라 건물 전체를 자동 대표로 만들지 않는다.'],
  ['poi_791', '서면·전포', 'conditional_more', '권역 시장이며 점포별 시간이 달라 기존 conditionalVisit 외에 공식 권역 접근 시간을 확인하지 못했다.'],
  ['poi_96', '서면·전포', 'conditional_more', '부전시장 권역의 공식 문구도 점포별 상이를 명시한다. 내부 시장을 묶어 자동 대표로 승격하지 않는다.'],
  ['poi_113', '서면·전포', 'conditional_more', '전포공구길은 권역형 거리이나 점포별 시간만 있어 공식 권역 접근 시간을 확인하지 못했다.'],
  ['traditional_market_061', '서면·전포', 'conditional_more', '서면중앙시장은 개별 점포 시간·이용 부담을 권역 전체에 상속할 수 없어 유지한다.'],
  ['traditional_market_096', '사상↔서면', 'conditional_more', '사상시장은 기존 권역형 조건부 후보이며 공식 고정 접근 시간이 확인되지 않았다.'],
  ['traditional_market_097', '사상↔서면', 'conditional_more', '르네시떼시장 내부 상가·점포별 운영 조건을 권역 전체의 자동 추천 시간으로 만들지 않는다.'],
  ['traditional_market_101', '사상↔서면', 'conditional_more', '감전제일상가시장은 상가형 권역으로 고정된 가벼운 방문 시간 근거가 없다.'],
  ['traditional_market_099', '사상↔서면', 'conditional_more', '감전시장은 활동·이용 가능성의 공식 범위가 구조화되지 않아 조건부를 유지한다.'],
  ['traditional_market_100', '사상↔서면', 'hold', '산업용재 유통 상가는 일반 자투리 방문 대상이 아닌 전문 유통 권역이므로 하드 제외를 유지한다.'],
  ['poi_4', '부산역·남포', 'representative_standard', '중구 문화관광의 공식 안내가 시장 자체의 매일 09:00~20:00 접근 시간과 별도 야시장 시간을 함께 명시한다. 일상 시장 둘러보기에는 공통 주간 권역 시간을 보수적으로 적용한다.'],
  ['poi_8', '부산역·남포', 'hold', '국제시장 내부 점포별 시간 차이와 기존 충돌 기록이 남아 있어 권역 전체의 단일 자동 추천 시간으로 재구성하지 않는다.'],
  ['poi_30', '부산역·남포', 'hold', '광복로 거리의 공개 보행 가능성과 상점 이용 가능 시간을 혼동하지 않는다. 쇼핑·가벼운 둘러보기의 고정 운영 근거가 없어 hold를 유지한다.'],
  ['poi_259', '부산역·남포', 'conditional_more', '중앙도서관은 자료실·요일·월별 휴관 규칙이 다르다. 현행 단순 구조화 운영시간 계약에는 안전하게 투영할 수 없어 조건부를 유지한다.'],
  ['poi_618', '부산역·남포', 'conditional_more', '보수동책방골목은 개별 서점 영업시간이 권역 전체에 적용되지 않아 conditionalVisit 외의 승격 근거가 없다.'],
  ['poi_10', '부산역·남포', 'conditional_more', '미술의거리는 개별 전시·상점의 운영 조건을 포괄 권역 시간으로 추정할 수 없어 유지한다.'],
  ['poi_70', '센텀·해운대', 'conditional_more', '벡스코는 행사·시설별 이용 조건이 달라 고정 20분 문화 방문 시간으로 자동 추천할 수 없다.'],
  ['poi_90', '센텀·해운대', 'conditional_more', '영화·공연·전시별 시간과 유료·예약 조건이 달라 단일 권역 시간을 만들지 않는다.'],
  ['poi_667', '센텀·해운대', 'conditional_more', 'F1963은 복합문화공간의 매장·전시별 시간이 상이하여 공통 고정 접근 시간을 확인하지 못했다.'],
  ['poi_277', '센텀·해운대', 'conditional_more', '해운대문화회관은 이용시설·공연별 조건이 달라 프로그램 의존성을 해소하지 못했다.'],
  ['poi_320', '센텀·해운대', 'conditional_more', '해운대 로데오거리는 상점별 시간만 있는 거리 권역이라 자동 대표 승격 근거가 없다.'],
];

const OFFICIAL = {
  poi_4: {
    publisher: '부산광역시 중구 문화관광',
    url: 'https://www.bsjunggu.go.kr/board/view.junggu?CATEGORY_CODE2=A01%2CA02%2CA03%2CB02%2CB03%2CC01%2CC02%2CC03%2CD01%2CD02%2CD04&CATEGORY_CODE3=&boardId=LIFE&dataSid=55998&keyword=&menuCd=DOM_000000201001000000&nowPage=2&searchType=DATA_TITLE',
    sourceText: '부평깡통야시장: 이용시간 09:00~20:00, 야시장 19:30~24:00, 연중무휴.',
    availability: { kind: 'area_hours', windows: [{ start: '09:00', end: '20:00' }], runtimeOperatingHours: ['매일 09:00~20:00'] },
  },
  poi_41: { publisher: '부산광역시교육청', url: 'https://school.busanedu.net/kumyang-e/na/ntt/selectNttInfo.do?nttSn=53107390', sourceText: '놀이마루 체험학습실 문화예술 심화특강은 대상·강좌·회차가 지정된 프로그램이다.' },
  poi_703: { publisher: 'KT&G 상상마당 부산', url: 'https://www.sangsangmadang.com/main/BS', sourceText: '카페·디자인매장·공연장·갤러리·창작공간·숙박·영화관이 공존하는 복합 공간이며 이용 조건이 공간·행사별로 나뉜다.' },
  poi_259: { publisher: '부산광역시 도서관포털', url: 'https://library.busan.go.kr/portal/html.do?menu_idx=61', sourceText: '중앙도서관 자료실은 평일·주말 이용 시간이 다르고 매월 첫째·둘째 월요일 휴관이다.' },
  poi_667: { publisher: '부산광역시', url: 'https://www.busan.go.kr/futureheritage/future02/view?bbsNo=11&curPage=1&dataNo=5791', sourceText: 'F1963은 전시·공연·도서·정원 등이 결합된 복합문화공간이다.' },
  poi_70: { publisher: '기존 보존 공식 원천', url: null, sourceText: '행사별 상이(홈페이지 참조).' },
  poi_90: { publisher: '기존 보존 공식 원천', url: null, sourceText: '영화 및 공연·전시별로 상이.' },
};
const PREVIOUS_CLASSIFICATION = { poi_4: 'hold' };

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const countBy = (rows, fn) => Object.fromEntries([...rows.reduce((map, row) => {
  const key = fn(row); map.set(key, (map.get(key) ?? 0) + 1); return map;
}, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b, 'ko')));

const profile = read(PROFILE);
const byId = new Map(profile.data.map((place) => [place.id, place]));
if (CANDIDATES.length > 60) throw new Error(`DATA-SUPPLY-01 후보 상한 초과: ${CANDIDATES.length}`);

const data = CANDIDATES.map(([placeId, livingArea, finalClassification, decisionReason]) => {
  const place = byId.get(placeId);
  if (!place) throw new Error(`근거 프로필에 없는 후보: ${placeId}`);
  return {
    placeId,
    title: place.title,
    livingArea,
    previousClassification: PREVIOUS_CLASSIFICATION[placeId] ?? place.classification,
    finalClassification,
    placeKind: place.placeKind,
    shortStayType: place.shortStayType ?? null,
    siteGroupId: place.siteGroupId,
    siteGroupDecision: place.siteGroupId ? 'existing_group_preserved' : 'no_confirmed_duplicate_group',
    decisionReason,
    officialEvidence: OFFICIAL[placeId] ?? { publisher: '기존 보존 근거 프로필', url: null, sourceText: '명백한 제외 또는 기존 조건부 근거를 우선해 추가 공식 조회를 하지 않았다.' },
    ...(finalClassification === 'representative_standard' ? {
      reviewedAt: REVIEWED_AT,
      reviewDueAt: REVIEW_DUE_AT,
      availability: OFFICIAL[placeId].availability,
      stayEvidence: { minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, basis: '기존 quick_browse AI-Hub 카테고리 정책; 이번 작업에서 확대하지 않음' },
    } : {}),
  };
});

const promoted = data.filter((row) => row.finalClassification === 'representative_standard').map((row) => row.placeId);
// 재생성 입력이 이미 이전 DATA-SUPPLY-01 출력일 수 있으므로, 이 작업이 승격한 ID는
// 기준선에서 반드시 제거한다. 기존 대표 190개를 재평가했다는 뜻이 아니다.
const representativeIds = profile.data.filter((place) => place.classification.startsWith('representative_') && !promoted.includes(place.id)).map((place) => place.id).sort();
const payload = {
  meta: {
    generatedAt: REVIEWED_AT,
    source: [PROFILE],
    method: 'DATA-SUPPLY-01 limited existing-candidate review; no route, Kakao REST, TourAPI, or other runtime API calls.',
    officialResearch: '공식 운영 주체·지자체 페이지의 최소 확인 결과만 정적 감사로 보존한다. 재생성 시 네트워크를 호출하지 않는다.',
  },
  summary: {
    candidateTotal: data.length,
    byLivingArea: countBy(data, (row) => row.livingArea),
    byFinalClassification: countBy(data, (row) => row.finalClassification),
  },
  baseline: { representativeIds },
  after: { representativeIds: [...representativeIds, ...promoted].sort() },
  data,
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`생활권 대표 후보 감사: ${data.length}개 / 승격 ${promoted.length}개 / ${OUTPUT}`);
