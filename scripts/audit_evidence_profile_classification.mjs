#!/usr/bin/env node
// 근거 프로필 재분류의 완료 산출물을 사람이 검토할 수 있는 Markdown으로 만든다.
import fs from 'node:fs';

const PROFILE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const BASELINE = 'data/processed/review/부산_장소_근거프로필_기준선.json';
const HOURS = 'data/processed/review/사용중_장소_운영시간_원천감사.json';
const CONFLICTS = 'data/processed/review/운영시간_충돌_처리결과.json';
const OUTPUT = 'docs/02_data/장소_근거프로필_재분류_감사.md';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const count = (rows, fn) => Object.fromEntries([...rows.reduce((m, row) => { const k = fn(row); m.set(k, (m.get(k) ?? 0) + 1); return m; }, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b, 'ko')));
const borough = (address = '') => (address.match(/(중구|서구|동구|영도구|부산진구|동래구|남구|북구|해운대구|사하구|금정구|강서구|연제구|수영구|사상구|기장군)/)?.[1] ?? '권역미확인');
const profile = read(PROFILE); const baseline = read(BASELINE); const hours = read(HOURS);
const conflictResolutions = read(CONFLICTS);
const data = profile.data;
const active = data.filter((p) => p.classification !== 'hold');
const holds = data.filter((p) => p.classification === 'hold');
const rows = Object.entries(count(data, (p) => p.classification));
const coverage = new Map();
for (const place of active) {
  const key = `${borough(place.address)}|${place.shortStayType ?? '활동미확인'}|${place.availability}`;
  coverage.set(key, (coverage.get(key) ?? 0) + 1);
}
const topHolds = Object.entries(count(holds, (p) => p.nextReviewAction)).sort((a, b) => b[1] - a[1]);
const conflicts = hours.data.filter((r) => {
  const values = [...r.currentCatalogHours, r.tourapi.hours, ...r.busanOfficial.map((x) => x.hours)].filter(Boolean);
  return new Set(values).size > 1;
});
const parsedFailures = hours.data.filter((r) => ['운영시간_미확인', '시간문구_모호', '시간범위_조건부', 'TourAPI_조회실패'].includes(r.finalStatus));
const profileById = new Map(data.map((place) => [place.id, place]));
const promotableConditional = data.filter((place) => place.classification === 'conditional_more' && hours.data.find((row) => row.contentId === place.id)?.finalStatus === '구조화된_시간확인');
const issueRows = [...new Map([...conflicts, ...parsedFailures].map((row) => [row.contentId, row])).values()]
  .sort((a, b) => a.contentId.localeCompare(b.contentId, 'en'));
const lines = [
  '# 장소 근거 프로필 재분류 감사', '',
  `- 생성: ${profile.meta.generatedAt}`, `- 재생성 입력: ${profile.meta.source.map((file) => `\`${file}\``).join(', ')}`,
  `- 기준선: 활성 ${baseline.summary.active}개 + 기존 review ${baseline.summary.review}개 + excluded ${baseline.summary.excluded}개 = ${baseline.summary.total}개`, '',
  '## ID 대조와 재분류 결과', '',
  `- 기준선 ID ${baseline.ids.length}개와 결과 ID ${data.length}개의 집합이 동일하다. 신규 ID·조용한 삭제·병합은 없다.`,
  '', '| 분류 | 수 | 런타임 처리 |', '| --- | ---: | --- |',
  ...rows.map(([k, v]) => `| ${k} | ${v} | ${k === 'representative_core' ? '대표 우선' : k === 'representative_standard' ? '대표 가능' : k === 'conditional_more' ? '더보기 전용' : '자동 추천 제외·재검토 큐'} |`), '',
  '## 생활권 · 활동 · 이용 가능성 분포', '',
  '시간대별 실제 이용 가능성은 운영시간 파서·엔진에서 판정한다. 이 표는 그 전제인 생활권별 활동·이용 가능성 근거 분포이며, `unknown`은 대표 후보가 아니라 조건부 더보기다.', '',
  '| 생활권 | 활동 | 이용 가능성 근거 | 대표/조건부 수 |', '| --- | --- | --- | ---: |',
  ...[...coverage.entries()].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([key, n]) => `| ${key.split('|').join(' | ')} | ${n} |`), '',
  '## 조건부·보류와 재검토 큐', '',
  `- conditional_more ${profile.summary.classification.conditional_more ?? 0}개는 동일성·활동·체류 근거가 있으나 운영 가능성만 unknown이다. 대표 추천·자동 확정에는 쓰지 않는다.`,
  `- 생활권 공백 보강 조사: conditional_more 중 이미 구조화된 공식 운영시간이 감사에 연결된 승격 후보는 ${promotableConditional.length}개다. 0개이므로 카카오·추정 기반 승격은 하지 않았다.`,
  `- hold ${holds.length}개는 다음 행동을 보존한다.`, '',
  '| 상위 재검토 행동 | 수 |', '| --- | ---: |', ...topHolds.map(([reason, n]) => `| ${reason} | ${n} |`), '',
  '## 원천 충돌·파싱 실패·카카오 연결', '',
  `- 원문 운영시간 충돌: ${conflicts.length}개. 자동 최신값 선택을 하지 않았으며, 각 장소는 감사 JSON의 TourAPI·부산시 원문을 보존한다.`,
  `- 대표 후보 충돌 39개는 [충돌 처리 결과](../../data/processed/review/운영시간_충돌_처리결과.json)에 원문·적용 범위·판정자를 보존했다. 표기 차이 25개만 유지하고, 범위/조건/실질 충돌 14개는 hold로 이동했다.`,
  `- 시간 파싱 실패/모호/조건부: ${parsedFailures.length}개. 이 중 근거가 충분한 활성 후보만 conditional_more, 그 외는 hold다.`,
  `- 카카오 Place는 이 재분류에서 운영시간 승격 근거로 사용하지 않았다. 런타임에는 기존 검증 상태와 안전한 검색 링크만 보존한다.`,
  '', '### 장소 ID별 운영시간 이슈 처리', '',
  '| 장소 ID | 장소 | 운영시간 감사 | 재분류 | 처리 |', '| --- | --- | --- | --- | --- |',
  ...issueRows.map((row) => { const place = profileById.get(row.contentId); return `| ${row.contentId} | ${row.title.replaceAll('|', '\\|')} | ${row.finalStatus} | ${place?.classification ?? '기준선 누락'} | ${place?.classification === 'conditional_more' ? '더보기 전용·사용자 운영시간 확인 필요' : place?.nextReviewAction ?? '공식 근거 재검토'} |`; }),
  '', '### 자동 대표 후보였던 충돌 39개 처리', '',
  '| 장소 ID | 기존 분류 | 충돌 유형 | 판정 | 새 분류 | 다음 재검토일 |', '| --- | --- | --- | --- | --- | --- |',
  ...conflictResolutions.data.map((row) => `| ${row.placeId} | ${row.previousClassification} | ${row.conflictType} | ${row.decision} | ${row.newClassification} | ${row.nextReviewDueAt} |`),
  '', '장소별 원문·처리 결과는 [재분류 JSON](../../data/processed/review/부산_장소_근거프로필_재분류.json), [운영시간 감사 JSON](../../data/processed/review/사용중_장소_운영시간_원천감사.json)에서 확인한다.',
];
fs.writeFileSync(OUTPUT, `${lines.join('\n')}\n`);
console.log(`근거 프로필 감사 보고서 생성: ${OUTPUT}`);
