# DATA-PLACE-DETAIL-01 — 장소 상세용 공식 설명 snapshot

> 상태: **실행 가능**  
> 선행 결정: `DEC-PLACE-COURSE-FLOW-01` 최종 승인  
> 소유: 데이터 정제

## 작업 명령

"DATA-PLACE-DETAIL-01을 진행해. 먼저 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/work/integration-decision/place-detail-and-optimized-course-flow.md`, `docs/work/data-curation/README.md`와 이 작업 문서만 읽어. 목표는 전체 지도형 장소 상세가 live Kakao/TourAPI/Route Proxy 호출 0회로 사실 기반 설명을 표시할 수 있도록 optional 로컬 상세 snapshot을 보강하는 것이다.

코드 변경 전에 현재 `src/data/busan_poi_catalog.json` 전체 및 대표 추천 장소의 `category`, `subCategory`, `addr1`, `operatingHours`, `imageUrl`, `mapVerification`, 설명 필드 충족률을 다시 계산해 작업 기록에 남겨. 감사 기준상 대표 191곳 중 별도 사용자 설명은 0곳이며, 이 수치가 다르면 현재 파일을 기준으로 새 수치를 사용하고 차이를 설명해.

UI와 공유할 공개 필드 이름은 `detailDescription?: string`으로 고정한다. 설명 출처 증명은 새 사용자 표시 필드를 난립시키지 말고 기존 `sourceEvidence`에 보존한다. `scripts/build_runtime_poi_catalog.mjs`에서 기존 sourceEvidence가 정확히 연결한 부산 공식 명소·쇼핑·맛집 원천 row의 ITEMCNTNTS 계열 설명만 사용할 수 있다. 이름 유사도만으로 다른 장소 설명을 붙이거나, activityEvidence·classificationReason 같은 내부 검토 문구를 사용자 설명으로 노출하지 마라.

원문 공백과 줄바꿈을 결정적으로 정규화하고, 첫 의미 문단을 기준으로 최대 240 Unicode code point의 사용자 표시용 설명을 만들어라. 240자를 넘길 때는 가능한 마지막 완결 문장 경계에서 자르고, 문장 경계가 없을 때만 잘린 문장 끝에 말줄임표를 붙여라. 빈 문자열·HTML·제어문자·중복 장소 설명은 넣지 마라. 공식 설명이 없거나 정확한 원천 연결을 증명할 수 없으면 `detailDescription`을 생략한다. UI는 이 경우 `상세 설명 없음`을 표시한다.

기존 `category/subCategory`, 주소, 운영시간, 사진, Kakao URL·검증 상태, 대표/조건부 분류, 체류시간, 추천 등급을 변경하지 마라. 설명 보강을 이유로 대표 장소를 승격·강등하거나 운영시간을 합성하지 마라. DB migration, Supabase 저장, UI, 엔진, API adapter, `.env*`, 중앙 정책 문서는 수정하지 마라. 출력 카탈로그 `src/data/busan_poi_catalog.json`은 이 데이터 세션만 수정한다.

테스트 또는 감사 스크립트를 먼저 추가해 실패를 재현한 뒤 구현해. 빌드 스크립트를 연속 두 번 실행했을 때 두 번째 실행의 의미 diff가 0인지 확인하고, 공식 원천 미연결·설명 없음·240자 경계·HTML/공백 정규화·동일 입력 결정성 fixture를 검증해. 마지막에는 전체/대표 장소의 설명·주소·운영시간·사진·Kakao 링크 충족률과 `상세 설명 없음` fallback 수를 기록해. `npm run test:typecheck`, 관련 데이터 테스트, `git diff --check`를 실행하고, 변경 파일과 목적·변경하지 않은 계약·테스트 결과·UI 인수인계를 이 문서의 완료 기록에 남겨. 커밋은 하지 마."

## 고정 계약

- UI가 읽는 새 필드는 `detailDescription?: string` 하나다.
- 데이터 부재는 오류가 아니며 UI fallback은 `상세 설명 없음`이다.
- 상세 진입 live API 호출과 실제 현재 위치 저장은 계속 0이다.
- UI 구현의 선행 조건은 아니다. UI는 optional 필드가 없어도 완료할 수 있다.

## 인수인계 게이트

1. 두 번 빌드의 두 번째 의미 diff 0
2. 기존 추천 분류·운영시간·주소·Kakao URL 변경 0 또는 근거 있는 기존 빌드 산출 변화 명시
3. 공식 연결이 없는 설명 합성 0
4. `detailDescription`이 없는 모든 장소에서 UI fallback 가능

## 완료 기록 — 2026-09-05

> 상태: **데이터 구현·검증 완료, UI 인계 가능**  
> 외부 조회: **0회** — 저장된 부산 공식 원천 snapshot만 사용

### 변경 파일과 목적

- `scripts/build_place_detail_description.mjs`: 기존 `sourceEvidence`의 `source + sourceId`가 부산 공식 명소·쇼핑·맛집 원천의 `UC_SEQ`와 정확히 일치할 때만 `ITEMCNTNTS`를 정규화한다. 첫 의미 문단, 최대 240 Unicode code point, 완결 문장 우선 절단, HTML·제어문자 제거, 중복 설명 배제를 구현했다.
- `scripts/build_place_detail_snapshot_audit.mjs`: 실패 우선 기준선, 정규화 fixture, 공식 원천 연결·생략·길이·HTML·결정성·보호 필드 불변 감사를 추가했다.
- `scripts/build_runtime_poi_catalog.mjs`: 위 공식 연결 계획에서 통과한 장소에만 optional `detailDescription`을 출력한다.
- `data/processed/review/장소상세_공식설명_기준선.json`: 설명 추가 전 전체/대표 충족률과 보호 대상 카탈로그의 의미 SHA-256 기준선을 보존한다.
- `data/processed/review/장소상세_공식설명_감사.json`: 최종 설명 수, 원천별 수, fallback 수와 계약 감사 결과를 보존한다.
- `src/data/busan_poi_catalog.json`: 공식 원천과 정확히 연결되고 중복 설명이 아닌 127곳에만 `detailDescription`을 추가했다.

### 기준선과 최종 충족률

설명 추가 전 전체 369곳/대표 191곳에서 `detailDescription`은 각각 0곳이었다. 최종 결과는 전체 127/369곳(34.4%), 대표 104/191곳(54.5%)이며, UI fallback 대상은 전체 242곳·대표 87곳이다. 원천별 설명은 부산 공식 명소 85곳, 쇼핑 24곳, 맛집 18곳이다. 최대 설명 길이는 238 Unicode code point다.

| 필드 | 전체 기준선 → 최종 | 대표 기준선 → 최종 |
| --- | ---: | ---: |
| `category` | 369/369 (100%) → 동일 | 191/191 (100%) → 동일 |
| `subCategory` | 231/369 (62.6%) → 동일 | 74/191 (38.7%) → 동일 |
| `addr1` | 367/369 (99.5%) → 동일 | 191/191 (100%) → 동일 |
| `operatingHours` | 122/369 (33.1%) → 동일 | 108/191 (56.5%) → 동일 |
| `imageUrl` | 203/369 (55.0%) → 동일 | 179/191 (93.7%) → 동일 |
| `mapVerification` | 369/369 (100%) → 동일 | 191/191 (100%) → 동일 |
| `detailDescription` | 0/369 (0%) → 127/369 (34.4%) | 0/191 (0%) → 104/191 (54.5%) |

정확히 연결된 후보는 132곳이었다. 여러 장소가 동일한 일반 설명을 공유한 2개 그룹 5곳은 사용자에게 잘못된 장소별 설명을 보이지 않도록 필드를 생략했다. 공식 원천 미연결, 설명 없음, 중복 설명에 해당하는 장소는 모두 기존 데이터 그대로이며 `detailDescription`이 없다.

### 변경하지 않은 공개 계약·정책 경계

- `detailDescription`과 빌드 시각인 `meta.generatedAt`을 제외한 전체 카탈로그 의미 SHA-256이 기준선과 일치한다.
- 추천 분류·대표/조건부 상태·추천 등급·체류시간·주소·운영시간·사진·Kakao URL 및 검증 상태를 변경하지 않았다.
- DB migration, Supabase 저장, UI, 추천 엔진, 외부 API adapter, `.env*`, 중앙 정책 문서를 변경하지 않았다.
- 사용자 표시 공개 필드는 `detailDescription?: string` 하나이며, 설명 부재 시 계약은 `상세 설명 없음`이다.

### 실행한 검증과 결과

- `node scripts/build_place_detail_snapshot_audit.mjs --write-baseline`: 기준선 작성 후 `poi_1047` 설명 부재로 의도한 실패를 재현했다.
- `node scripts/build_runtime_poi_catalog.mjs` 연속 2회 + `jq -S 'del(.meta.generatedAt)'` + `cmp`: 두 번째 빌드 의미 diff 0.
- `node scripts/build_place_detail_snapshot_audit.mjs`: 통과 — 설명 127/369, 대표 104/191, fallback 242, 보호 의미 hash 일치.
- `node --test test/busan-poi-catalog.test.mjs test/recommendation-data-contract.test.mjs test/area-discovery-candidates.test.mjs test/targeted-representative-supply.test.mjs`: 17/17 통과.
- `npx tsx --test test/course-v1-candidate-provider.test.ts test/ui/place-detail-and-optimized-course-flow.test.ts`: 11/11 통과.
- `npm run test:typecheck`: 통과.
- `git diff --check`: 통과.

### UI 인수인계와 남은 위험

- UI는 로컬 카탈로그의 optional `detailDescription`만 읽고, 필드가 없는 242곳에는 `상세 설명 없음`을 표시한다. 상세 진입 시 live Kakao/TourAPI/Route Proxy 호출은 필요하지 않다.
- 설명은 현재 저장된 공식 원천의 snapshot이므로 원천 문구 갱신은 이후 정제 빌드 시 반영해야 한다. 동일 일반 설명 때문에 제외한 5곳은 더 구체적인 공식 근거가 생기기 전까지 fallback이 정상 상태다.
- 재현은 `node scripts/build_runtime_poi_catalog.mjs` 실행 후 `node scripts/build_place_detail_snapshot_audit.mjs`로 시작한다.
