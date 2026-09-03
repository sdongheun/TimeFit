# DATA-SUPPLY-01 — 부족 생활권 대표 후보 제한 보강

## 목적

공모전 V1에서 관찰된 “대표는 있으나 검증 대안이 너무 적음”을 줄이기 위해, 부산 전역 장소 수를 맞추지 않고 부족 생활권의 근거 있는 대표 후보만 제한적으로 보강한다.

이 작업의 산출물은 자동 추천에 쓸 수 있는 데이터 후보와 재현 가능한 감사다. 추천 엔진의 공간 선별·8→16회 route 예산은 바꾸지 않는다. 보강 뒤 실기기 재확인에서 여전히 공급이 부족할 때만 엔진 작업을 새로 결정한다.

## 먼저 읽을 것

1. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/03_product/추천로직.md`의 1.5절 및 2.3절 5~6항, `docs/테스트.md`의 `REC-26~29`, `DATA-01~06`, `DATA-18`, `DATA-25`
3. [조건부 시장·거리 발견 계약](conditional-market-candidates.md), [권역형 발견 후보 계약](area-discovery-candidates.md)
4. `docs/02_data/장소_근거프로필_재분류_감사.md`, `docs/02_data/보류_발견장소_재검토_감사.md`, 기존 런타임 카탈로그 및 근거 프로필

과거의 대량 수집 프롬프트·휴리스틱 공급량 수치는 읽지 않는다. 이번 작업은 아래 네 생활권의 제한된 후보 감사다.

## 고정 입력과 범위

이미 사용자 실기기에서 대표·대안 부족이 관찰된 네 생활권을 사용한다.

| 생활권 | 관찰 입력 | 우선 보강 성격 |
| --- | --- | --- |
| 서면·전포 | 서면역 복귀, 짧은/보통 자투리 | 거리·소규모 문화·쇼핑·가벼운 둘러보기 |
| 사상↔서면 | 사상역에서 서면역 | 사상 또는 이동 축에서 짧게 들를 문화·거리·공개 공간 |
| 부산역·남포 | 부산역에서 남포역 | 시장 권역·거리·문화·산책 접근 |
| 센텀·해운대 | 센텀시티역에서 해운대역 | 문화·해변/공개 야외·쇼핑·거리 |

- 첫 조사 목록은 현행 `conditional_more`·`hold`·기존 원천 중 위 생활권에 속한 **최대 60곳**이다. 이미 대표인 190개를 다시 수집·재평가하지 않는다.
- 실제 자동 대표로 승격되는 수는 목표가 아니다. 근거가 충족된 수만 반영하며 0곳도 유효한 결과다.
- 일반 식당·카페, 시장 내부 개별 점포, 예약/유료 프로그램 의존 시설, 도매·새벽·수산 유통 전문, 장기 이용 시설, 동일 `siteGroupId`의 중복 내부 장소는 후보에서 제외한다.

## 대표 승격 기준

후보 하나가 `representative_standard`가 되려면 아래를 **모두** 충족해야 한다.

1. 부산시·구청·공공 관광기관·시설 운영 주체의 1차 자료에 장소 정체성과 접근 또는 운영 시간이 있다. 카카오맵 화면의 시간·블로그·리뷰는 자동 승격 근거가 아니다.
2. 시설형은 구조화된 운영시간이 있어야 한다. 시장·거리·해변·공원 같은 권역형은 내부 점포 시간이 아니라, 권역 자체의 공식 접근 시간 또는 상시 공개 접근 근거가 있어야 한다.
3. `minStayMin: 20`을 뒷받침하는 활동 근거가 있다. “시장 전체를 완주”한다는 뜻이 아니라, 공식 소개에서 확인되는 산책·거리 구경·전시 관람·공개 공간 이용 등 **가벼운 방문** 단위여야 한다. `recommendedStayMin`·`maxStayMin`은 기존 카테고리 정책과 활동 근거를 함께 충족할 때만 넣으며 시간 예산을 채우기 위해 늘리지 않는다.
4. 좌표·주소·카테고리·`siteGroupId`·운영시간 파싱이 런타임 계약에 맞고, 더 넓은 권역과 내부 장소를 동시에 대표로 넣지 않는다.
5. 근거 URL/원문 요약·확인일·재검토 기한(원칙적으로 90일 이내)을 감사 파일에 남긴다. 근거 충돌·시간 불명확은 `conditional_more` 또는 `hold` 유지다.

현재 정책의 `conditionalVisit` 10:00–18:00 노출은 영업 보장이 아니다. 이 필드만으로 자동 대표 승격하지 않는다.

## 수행 순서

1. 네 생활권별로 최대 60곳의 짧은 목록을 만든다. 기존 분류, 제외 사유, 장소 성격, `siteGroupId`를 먼저 대조해 중복·명백한 제외 후보는 외부 조사 없이 제외한다.
2. 남은 후보만 공식 원천을 조사한다. 후보당 필요한 최소 원천만 확인하고, Kakao REST·TourAPI·경로 API의 대량 호출이나 이름 유사 추정은 하지 않는다.
3. `representative_standard` 승격 / `conditional_more` 유지 / `hold` 유지·제외를 판정한다. 승격에는 구조화 운영시간·체류 범위·근거 프로필의 필요한 최소 필드만 추가한다.
4. 기존 build script의 명시적 오버레이 또는 새 작은 build script로 판정을 재현 가능하게 적용한다. 사람 손으로 생성된 런타임 JSON만 고치지 않는다.
5. 런타임 카탈로그와 provider를 재생성한다. 기존 대표 190개의 ID·분류·운영시간·체류·좌표·사진·정렬은 불변이어야 한다.

## 산출물

- `data/processed/review/생활권_대표후보_보강_감사.json`
  - 후보 ID·생활권·이전/최종 분류·장소 성격·제외 또는 승격 사유·공식 근거·확인일·재검토 기한·운영시간/접근 시간·체류 근거·`siteGroupId` 판정
- `docs/02_data/생활권_대표후보_보강_감사.md`
  - 생활권별 조사/승격/유지/제외 수, 카테고리 분포, 대표 수 전후, 경계 사례, 다음 보강이 필요한 생활권
- 재현 build script와 데이터 계약 테스트 1개 이상

## 금지·경계

- 대표 후보를 300개로 맞추기 위해 기준을 완화하거나, 176개 조건부 후보를 일괄 승격하지 않는다.
- 추천 엔진, UIUX, Route Proxy/API, DB, 작업조정 보드는 수정하지 않는다.
- 새 후보가 충분히 늘었다는 이유만으로 route attempt 상한·사전 선별 18개·대표/대안 구조를 바꾸지 않는다.
- 실제 API route 결과를 반복 수집하거나 API 키·응답 원문을 문서/fixture에 저장하지 않는다.

## 완료 기준

1. 조사 대상이 최대 60곳이고, 모든 후보에 최종 판정 또는 제외 사유가 있다.
2. 승격 후보는 위 다섯 대표 기준을 모두 증명한다. 기존 대표 190개는 바뀌지 않는다.
3. 런타임 카탈로그의 대표/조건부/hold 수와 감사 결과가 일치한다.
4. 대표 후보·운영시간·체류·중복·생활권 분포를 검증하는 고정 데이터 테스트를 추가한다.
5. 관련 데이터 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.
6. 인계에는 변경 파일, 불변 경계, 테스트 결과, 생활권별 전후 수와 다음 QA 입력을 남긴다.

## 다음 단계

DATA-SUPPLY-01 수락 뒤에만 QA-SUPPLY-01을 실행한다. 네 고정 입력에서 실기기 결과를 한 번씩 기록하고, **그때도** 대표/대안 부족이 반복될 때만 추천 엔진의 사전 후보 다양화 작업을 연다.

---

## 2026-09-01 — DATA-SUPPLY-01 완료 인계

### 변경 파일·목적

- `scripts/build_targeted_representative_supply_audit.mjs`, `data/processed/review/생활권_대표후보_보강_감사.json`, `docs/02_data/생활권_대표후보_보강_감사.md`: 네 생활권의 기존 비대표 후보 22개를 재현 가능하게 감사했다.
- `scripts/build_evidence_profile_catalog.mjs`, `data/processed/review/부산_장소_근거프로필_재분류.json`, `data/processed/review/부산_장소_구조화_운영시간.json`, `data/processed/review/권역형_발견후보_감사.json`, `src/data/busan_poi_catalog.json`, `scripts/build_course_v1_candidate_provider_fixture.mjs`, `data/processed/review/코스V1_대표후보_provider_fixture.json`: 부평깡통시장(`poi_4`)만 공식 권역 접근 시간 `매일 09:00~20:00`으로 `representative_standard`에 제한 승격하고 런타임/provider fixture·권역 발견 자격을 재생성했다.
- `test/targeted-representative-supply.test.mjs`, `test/evidence-profile-classification.test.mjs`, `test/busan-poi-catalog.test.mjs`, `test/course-v1-candidate-provider.test.ts`: 후보 22개, 승격 1개, 기존 대표 190개 불변, 만료 fail-closed 및 369/191 provider 계약을 고정했다.

### 유지한 공개 계약·정책 경계

- 기존 대표 190개의 ID·분류·운영시간·체류·좌표·사진·정렬은 바꾸지 않았다. 비승격 21개도 기존 classification을 유지했다.
- `conditionalVisit` 제품 창, 일반 식당/개별 점포/도매·새벽/예약·프로그램 의존 제외, 엔진 공간 선별·8→16회 route 예산, UIUX, Route Proxy/API, DB, 보드는 변경하지 않았다.
- 공식 페이지 최소 확인 외에는 Kakao REST·TourAPI·경로 API·GPS·Auth·DB 호출을 하지 않았다. 재생성 script는 네트워크를 호출하지 않는다.

### 테스트 결과

- `node scripts/build_targeted_representative_supply_audit.mjs && node scripts/build_evidence_profile_catalog.mjs && node scripts/build_structured_availability_catalog.mjs && node scripts/build_area_discovery_audit.mjs && node scripts/build_runtime_poi_catalog.mjs && node scripts/build_course_v1_candidate_provider_fixture.mjs` — 후보 22, standard 승격 1, 런타임 369, 대표 191, 조건부 178, hold 668.
- `node --test test/area-discovery-candidates.test.mjs test/targeted-representative-supply.test.mjs test/evidence-profile-classification.test.mjs test/busan-poi-catalog.test.mjs` — 30/30 통과.
- `npx tsx --test test/course-v1-candidate-provider.test.ts` — 5/5 통과.
- `npm run test:typecheck`, `npm run test:ui`(140 통과·1 skip), `npm test`, `git diff --check` — 통과.

### 다음 결정·위험·재현 조건

- QA-SUPPLY-01은 DATA-SUPPLY-01 수락 뒤 네 고정 생활권 입력을 각 1회만 실행한다. 부평깡통시장 추가로도 대표/대안 부족이 반복될 때만 엔진 사전 후보 다양화를 새 작업으로 열어야 한다.
- `poi_4`는 2026-11-21에 만료된다. 중구 공식 접근 시간·시장 범위가 바뀌거나 만료되면 재검토 전 자동 대표로 남기지 않는다.
