# 데이터 정제 현재 작업

현재 데이터 보강 작업 [DATA-SUPPLY-01 — 부족 생활권 대표 후보 제한 보강](targeted-representative-supply.md)은 수락됐다. 기존 비대표 22개를 공식 근거로 재검토해, 부평깡통시장 1개만 `representative_standard`로 제한 승격했다. 현재 런타임 369개는 `representative` 191·`area_access` 2·`conditional` 176이며, 이 결과가 네 생활권의 공급 부족을 해결했는지는 [QA-SUPPLY-01](../qa-release/targeted-supply-recheck.md)에서 별도로 판단한다. [DATA-MARKET-01 — 조건부 시장·거리 발견 계약](conditional-market-candidates.md)은 수락됐다. `conditional_more` 178개를 감사해 시장·거리 권역형 142개에만 `conditionalVisit`을 투영했고, 36개는 시설·도매/새벽·장기 이용 등으로 제외했다. 이 필드는 10:00–18:00 정보 확인 창일 뿐 대표 등급·운영시간·실제 경로 추천을 바꾸지 않는다. [DATA-AREA-01 — 권역형 발견 후보·접근시간 계약](area-discovery-candidates.md)도 수락됐다. provider는 `area|outdoor|facility` 장소 성격까지 명시 전달한다. 새 작업 전에는 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, 관련 `docs/02_data/` 근거 문서와 `docs/03_product/추천로직.md`의 데이터 절만 읽는다.

B12 internal 비교는 카탈로그·분류·운영시간을 변경하지 않는다.
