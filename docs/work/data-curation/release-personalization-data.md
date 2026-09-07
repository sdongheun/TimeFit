# DATA-RELEASE-PERSONALIZATION-01 — 안전 사진·개인화 분류 전달

상태: **지금 실행 가능**. 카탈로그/생성 스크립트/provider는 데이터 세션 단일 writer다. UI/엔진 정책/API cache/migration은 수정하지 않는다.

## 후속 실행 — 카페·문화시설 세부분류 (2026-09-07)

상태: **지금 실행 가능, DB B와 병렬**. 사진 안전 투영/키 전달은 이전 완료를 재사용한다. 부모 DEC-RELEASE-DATA-LIFECYCLE-01의6번이 승인됐다.

1. 최신 감사에서 카페0/31, 대표 문화시설2/52였던 적용 범위를 현재 원본과 대조한다. 개인화 전체 연결 완료와 분류 적용 가능 수를 구분한다.
2. 기존 데이터 정제 기준/분류 어휘·카탈로그 원천 코드·공식 설명의 직접 근거를 먼저 사용한다. 이름만으로 북카페/대형카페/체험형 등의 활동·규모를 추정하지 않는다.
3. 기존 taxonomy에 맞는 exact source 근거가 있는 missing subCategory만 보완한다. 상위 카페를 하나의 세부 활동군으로 묶을 필요가 있거나 기존 어휘에 적합한 분류가 없으면 그룹별 표본 섞임 영향과 최소 taxonomy 제안을 통합에 반환한다. 새로운 의미의 분류는 임의로 만들지 않는다.
4. 장소 ID별 이전값/새값/원천 식별자·공식 근거/판정 이유/불확실 상태를 재현 가능한 감사 자료로 남기고 generator를 통해 runtime에 투영한다. 수정한 JSON만 손으로 유지하지 않는다.
5. 사진 허락 fail-closed, 장소 ID/좌표/대표 등급/운영시간/체류 min·recommended·max를 보존한다. missing이라도 기본 추천에서 제외하지 않는다. 기존 유효 분류 변경이나 과거 학습 표본 재분류는 포함하지 않는다.
6. fixture는 정확한 그룹별 투영/같은 subCategory·다른 category 격리/missing fallback/보호 필드 불변/미허락 URL0/재빌드 결정성을 확인한다. typecheck/UI/core와 데이터 집중 테스트를 실행한다. 운영 API 반복 호출·원격 배포·키 출력·commit/push 금지.
7. 최종 카페/문화시설의 대표·전체 적용 가능/누락 집계, 변경 장소 수, 미확정 taxonomy와 필요한 공개 계약을 인계한다. 확장 분류가 서버 표본 catalog 검증에도 반영돼야 하므로 DB에 정확한 catalog version/키 집계를 전달한다. 엔진 정책과 UI는 수정하지 않는다.

1. 최신 release-api-audit.md의 사진 권리 미확인과 2-AB 완료 인계의 category/subCategory provider 미연결을 현재 코드로 확인한다. 369/406 같은 과거 집계를 현재 값으로 복사하지 않는다.
2. 사진별 기존 이용허락 근거를 먼저 점검한다. URL이 공공기관이라는 이유, source label/accessibilityLabel이 있다는 이유만으로 허락 확인 처리하지 않는다. 권리자/원문/라이선스/출처/변경 조건의 근거가 없으면 공개 runtime의 image URL을 비노출해 기존 기본 이미지 fallback을 사용한다. 새로운 이미지 생성·외부 다운로드로 대체하지 않는다.
3. 원본 근거 자료를 파괴하지 않고 생성 과정에서 안전하게 투영한다. 안전 field/allowlist가 필요하면 호환성을 유지하고 조건을 문서화한다. 다른 화면의 imageEvidence/legacy fallback로 차단 URL이 재노출되지 않도록 소비 경로를 조사해 UI 인계한다.
4. 사진 부재 때문에 장소 ID·등급·후보 수·운영시간·좌표·체류값을 바꾸지 않는다. 카탈로그 version/public route snapshot 재동기화가 필요한지 확인하고 필요하면 API에 인계한다. 이미지 변경만으로 무관한 원격 배포를 실행하지 않는다.
5. courseV1CandidateProvider가 정제 원본의 category/subCategory를 정확히 전달하는지 확인하고 누락이면 최소 투영을 연결한다. 명칭/설명으로 subCategory를 합성하지 않는다. 현재 공개 후보 전체와 대표/카페/문화시설 등 그룹별 적용 가능·missing 수를 집계한다.
6. missing subCategory가 많은 경우 개인화 혜택 범위가 제한됨을 수치로 보고한다. 원본 재분류는 이번 작업에서 무근거 자동 수행하지 않고 근거 기반 후속 범위를 제안한다.
7. fixture: 정확한 복합 키 전달, 같은 subCategory/다른 category 구분, missing 유지, 미확인 URL0, 확인된 허락 조건 준수, 이미지 없는 장소 수/ID/추천 eligibility 불변, 로컬 provider network0.

## 공통 검증·권한

2026-09-07 후속 범위 결정: DEC-RELEASE-DATA-LIFECYCLE-01에서 카페·문화시설 우선 근거 기반 세부분류 보완을 승인했다. 위 사진/전달 작업 완료와는 별개 후속이며 상세 원천·분류 어휘·검증 명령을 고정한 뒤 실행한다. 이번 승인을 장소명 기반 자동 추정·대표 등급/운영시간 변경 권한으로 확대하지 않는다.

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.

## 2026-09-07 완료 인계

### 변경 파일과 목적

- `data/processed/review/사진_이용허락_허용목록.json`: 사진별 권리자·원문·라이선스·출처 문구·상업 이용·변경 이용 조건을 모두 확인해야 하는 fail-closed allowlist를 추가했다. 현재 확인된 사진은 0건이므로 목록은 비어 있다.
- `scripts/runtime_image_permission.mjs`: 장소 ID·원천·원천 ID·URL이 단일 allowlist row와 정확히 일치하고 모든 허락 조건이 충족될 때만 사진을 공개 runtime에 투영한다. 불완전·중복·불일치는 모두 생략한다.
- `scripts/build_runtime_poi_catalog.mjs`: 기존 원천 사진 자료는 보존하되 공개 카탈로그에서는 위 허락 게이트를 통과한 사진만 출력한다. 이전 출력의 `existingPlace.imageUrl`을 다시 붙이던 legacy fallback은 제거했다.
- `src/data/busan_poi_catalog.json`: 작업 시작 시 고유 장소 기준 203곳에 있던 미확인 URL(부산 공식 호스트 130·TourAPI 73)을 모두 비노출했다. 369곳 모두 기존 UI 기본 이미지 fallback 대상이다.
- `src/data/courseV1CandidateProvider.ts`: `candidateFor`가 정제 카탈로그의 `category`와 optional `subCategory`를 그대로 `CourseV1Candidate`에 전달하도록 연결했다. 누락값은 합성하지 않는다.
- `scripts/audit_release_personalization_data.ts`, `data/processed/review/출시_사진개인화_데이터_감사.json`: 사진 안전성, 공개 provider별 복합 키 충족률, 장소/등급 불변 의미 hash와 route snapshot 재동기화 여부를 재현 가능하게 감사한다.
- `test/data-release-personalization.test.mjs`, `test/course-v1-candidate-provider.test.ts`, `test/busan-poi-catalog.test.mjs`: 미확인 URL 0, 완전한 이용허락만 허용, 장소 수/등급 불변, 복합 키 정확 전달·상위 category 격리·missing 유지 fixture를 고정했다.

### 실제 개인화 적용 가능 범위

`category`와 `subCategory`가 모두 있는 경우만 `(category, subCategory)` 개인화 키를 만들 수 있다. 이 집계는 표본 3건·로그인·별도 동의까지 충족했다는 뜻이 아니라 **데이터 분류상 적용 가능한 최대 범위**다.

| 공개 범위 | 적용 가능 | `subCategory` 누락 |
| --- | ---: | ---: |
| 런타임 전체 | 231/369 (62.6%) | 138 |
| 대표 provider | 74/191 (38.7%) | 117 |
| discovery provider | 231/369 (62.6%) | 138 |
| 조건부 시장·거리 provider | 142/142 (100%) | 0 |

대표 provider의 분류별 적용 가능 범위는 문화시설 2/52(3.8%), 상업지구 29/37(78.4%), 자연관광지 43/71(60.6%), 카페 0/31(0%)다. 전체 런타임은 레저/스포츠 3/3, 문화시설 2/67, 상업지구 178/188, 자연관광지 48/80, 카페 0/31이다. 따라서 특히 카페·문화시설은 현 상태에서 개인화 혜택이 제한되며, 누락값은 기본 체류로 안전하게 복귀한다. `거리·골목`, `문화마을`, `시장`, `해변·해안`은 여러 상위 category에 존재하므로 provider가 전달한 복합 키를 그대로 사용해야 한다.

### 유지한 공개 계약과 경계

- 사진 전후를 비교한 보호 의미 SHA-256이 `2b1dcef03ecb5978477f8535d2b7dd1f0c58c7aa37413e049e7ad89cdb45f16a`로 일치했다. 이미지 필드와 빌드 시각 외 장소 ID·분류·주소·운영시간·좌표·체류값·설명·Kakao 계약은 변경 0이다.
- 런타임 369, 대표 191, `conditional_more` 178, discovery 369, 조건부 시장·거리 142를 유지했다. 사진 부재로 후보를 제외하지 않았다.
- 연속 두 번 빌드에서 `meta.generatedAt`을 제외한 의미 diff는 0이다.
- route snapshot은 대표 ID와 좌표만으로 version을 만들며 둘 다 불변이므로 재동기화·원격 배포가 필요하지 않다.
- 원본 부산/TourAPI row, 이미지 감사·HTTPS 검증 자료, legacy 카탈로그는 삭제·덮어쓰기하지 않았다. UI, 엔진, API/cache, DB/migration, `.env*`, 중앙 정책·보드는 수정하지 않았다.
- 현행 V1/주변 탐색 소비 경로는 공개 `imageUrl`이 없을 때 기존 placeholder·카테고리 fallback을 사용하고 `imageEvidence`를 우회 소비하지 않는다.

### 실행한 테스트와 결과

- 실패 우선 `npx tsx --test test/course-v1-candidate-provider.test.ts test/data-release-personalization.test.mjs`: 8개 중 6 통과·2 실패. `poi_1`의 provider category가 `undefined`였고 공개 runtime 미확인 사진이 203개임을 재현했다.
- 집중 fixture와 2-AB·route snapshot 회귀: 33/33 통과.
- `npm run test:typecheck`: 통과. 최초 실행은 신규 감사 스크립트의 JSON optional 이미지 타입 2건으로 실패했고 타입을 명시한 뒤 재실행했다.
- `npm test`: 251/251 통과.
- `npm run test:ui`: 505개 중 504 통과·기존 skip 1·실패 0. reporter 인자를 npm script 뒤에 잘못 둔 1회와 샌드박스 IPC 실패는 동작 실패가 아니며 정상 명령으로 재실행했다.
- `node scripts/build_runtime_poi_catalog.mjs` 연속 2회 + 의미 비교, `npx tsx scripts/audit_release_personalization_data.ts`: 통과.
- 실제 API·DB·GPS·Simulator·사용자 데이터 조회, 원격 쓰기, commit/push는 0회다.

### 다음 역할의 entry·위험

- UI/DB는 `CourseV1Candidate.category?: string`, `subCategory?: string`을 그대로 사용한다. `subCategory`가 없으면 개인화 표본을 억지로 연결하지 않고 엔진의 `not_applied`/기본 체류를 유지한다.
- 사진별 허락이 새로 확인되면 allowlist에 권리자·원문 URL·라이선스명/URL·표시 문구·상업/변경 허용·검증일과 정확한 장소/원천/URL을 모두 기록한 뒤 빌드·감사를 다시 실행해야 한다. URL 도달성이나 기관 호스트만으로 허용하지 않는다.
- `src/engine/data.ts:getNearbyPopularPlaces`는 사진 존재를 후보 필수 조건으로 쓰지만 현재 저장소에서 호출처가 없는 dormant legacy 함수다. 이번 데이터 역할은 엔진을 수정하지 않았다. 이 함수를 다시 연결하기 전에는 엔진 담당이 사진 조건을 제거하는 별도 회귀를 해야 하며, 현 상태에서 호출하면 0곳을 반환한다.

## 2026-09-07 후속 완료 인계 — 카페·문화시설 세부분류

### 변경 파일과 변경 목적

- `scripts/build_cafe_culture_subcategory_audit.mjs`, `data/processed/review/카페문화시설_세부분류_감사.json`: 현재 런타임의 카페·문화시설 98곳을 전수 재계산하고, 이전값·새값·원천 식별자·공식 필드·판정 이유를 장소 ID별로 고정했다. 부산시 맛집정보의 구조화 `SUBTITLE`이 허용 어휘와 정확히 일치한 카페 5곳만 보완했다.
- `scripts/build_runtime_poi_catalog.mjs`, `src/data/busan_poi_catalog.json`: 감사 row의 장소 ID와 `sourceEvidence(source, sourceId)`가 모두 정확히 일치할 때만 새 `subCategory`를 투영한다. 기존 분류는 우선 보존하며 감사에 없는 누락값을 합성하지 않는다.
- `scripts/audit_release_personalization_data.ts`, `data/processed/review/출시_사진개인화_데이터_감사.json`: 전후 적용 가능 범위, 보호 필드 hash, DB 검증용 분류 카탈로그 version·복합 키별 건수를 추가했다.
- `test/data-release-personalization.test.mjs`: 보완 5곳의 정확한 값·공식 `SUBTITLE` 연결, `케이크` 상품명과 문화시설 이름의 추정 금지를 fixture로 고정했다.
- 이전 작업의 `scripts/runtime_image_permission.mjs`와 `src/data/courseV1CandidateProvider.ts`는 변경 없이 재사용했다. provider는 정제된 `category`/optional `subCategory`를 그대로 전달하고 사진은 기존 fail-closed 게이트를 통과한다.

보완한 5곳은 `poi_1141 백구당 → 베이커리`, `poi_1152 머그디저트랩 → 디저트카페`, `poi_1154 브레드365 → 베이커리`, `poi_1158 히떼로스터리 → 커피전문점`, `poi_403 모모스커피 본점 → 커피전문점`이다. 모두 정확히 연결된 `busan_food` 원천의 `SUBTITLE` 직접 근거가 있다.

### 전후 개인화 적용 가능 범위와 남은 누락

| 범위 | 이전 적용 가능 | 후속 적용 가능 | 현재 누락 |
| --- | ---: | ---: | ---: |
| 런타임 전체 | 231/369 (62.6%) | 236/369 (64.0%) | 133 |
| 대표 provider | 74/191 (38.7%) | 79/191 (41.4%) | 112 |
| 카페 전체·대표 | 0/31 (0%) | 5/31 (16.1%) | 26 |
| 문화시설 전체 | 2/67 (3.0%) | 2/67 (3.0%) | 65 |
| 문화시설 대표 | 2/52 (3.8%) | 2/52 (3.8%) | 50 |

후속 대상 98곳 중 최종 적용 가능은 7곳, 누락은 91곳이다. 문화시설 원천에는 현행 분류 어휘로 재사용할 구조화 세부유형 필드가 없어 65곳을 그대로 누락으로 유지했다. `부산시립미술관` 같은 이름이나 설명만으로 활동 유형을 만들지 않았다. 카페의 `케이크`는 상품 유형이므로 장소 유형으로 승격하지 않았다.

문화시설 최소 taxonomy 후보는 통합 결정 전 제안일 뿐 현행 계약이 아니다. 표본이 서로 섞이지 않게 하려면 최소 `전시·박물관`, `도서·열람`, `공연·복합문화`처럼 활동이 다른 군을 분리할 필요가 있다. 다만 이를 채택하려면 각 장소에 대해 공식 구조화 유형 또는 사람 검토로 확정한 공식 원문 allowlist가 먼저 필요하다. 카페도 이름·메뉴를 이용한 일괄 분류 대신 공식 구조화 유형을 추가 확보해야 한다. 현재 카페 복합 키의 카탈로그 장소 수는 `디저트카페` 1, `베이커리` 2, `커피전문점` 2이며, 이 수는 사용자 학습 표본 수가 아니다.

### DB 검증에 넘기는 분류 계약

- 카탈로그 version: `runtime-category-subcategory-3bb74d97ebcd`
- 전체 SHA-256: `3bb74d97ebcd779e9a239ae2dc052ec8f3e752c47756b486cd020f27177f6902`
- identity는 정확한 `contentId`, 검증 값은 정확한 `(category, subCategory)`다. `subCategory = null`은 `not_applied`이며 상위 category나 다른 장소의 세부분류로 보완하지 않는다.
- 전체 369개 중 복합 키 적용 가능 236개, 누락 133개, 서로 다른 적용 가능 복합 키 17개다. 정확한 키별 전체·대표 건수는 `출시_사진개인화_데이터_감사.json`의 `dbClassificationContract.applicableKeyCounts`와 `representativeApplicableKeyCounts`를 단일 인계 자료로 사용한다.
- 서버 표본 catalog 검증은 위 version과 `contentId`별 정확한 값을 함께 대조해야 한다. version 불일치, 미등록 ID, category/subCategory 불일치는 표본을 개인화에 사용하지 않는 fail-closed 결과여야 한다.

### 변경하지 않은 공개 계약·정책 경계

- 런타임 369, 대표 191, `conditional_more` 178, discovery 369, 조건부 시장·거리 142를 유지했다. 장소 수·ID·대표 등급·좌표·주소·운영시간·체류 min/recommended/max·Kakao 계약은 변경하지 않았다.
- 허용된 5개 `subCategory`와 빌드 시각·이미지 필드만 제외한 보호 의미 hash는 기대값 `9944c5a86051d7d63c8b29d10da069690ff613e211e2ce623731bdb390b79820`과 일치했다.
- 사진 이용허락 확인 건수와 공개 URL은 계속 0이며 369곳 모두 기본 이미지 대상이다. 사진 부재로 장소를 제외하지 않았다.
- 대표 ID와 좌표가 불변이므로 public route snapshot 재동기화는 필요 없다. 추천 정책·UI·엔진·API/cache·DB/migration·중앙 정책 문서는 수정하지 않았다.

### 실행한 검증과 결과

- 실패 우선 `node --test test/data-release-personalization.test.mjs`: 보완 전 4개 중 3 통과·1 실패로 대상 5곳의 누락을 재현했다. 구현 후 확장된 5/5 통과.
- 카페·문화시설 감사 생성기와 런타임 생성기를 연속 두 번 실행했다. 감사 JSON은 byte 동일, 런타임은 `meta.generatedAt` 제외 byte 동일이었다.
- 집중 데이터·provider·개인화·route snapshot 회귀: 35/35 통과.
- `npm test`: 통과. `npm run test:ui`: 505개 중 504 통과·기존 skip 1·실패 0.
- `npm run test:typecheck`: 이번 데이터 변경과 무관한 기존 `src/services/guestCompletionImportRepository.ts:37`의 `place`, `index` 암시적 `any` 2건으로 실패했다. 데이터 역할 밖 파일은 수정하지 않았다.
- `git diff --check`: 통과. 실제 API·DB·GPS·Simulator·사용자 데이터·원격 쓰기·commit/push는 0회다.

### 다음 결정·위험·재현 조건

- 통합 역할은 문화시설 taxonomy의 공개 의미와 증명 가능한 매핑 방식을 먼저 승인해야 한다. 승인 전 65곳은 누락 및 기본 체류가 현행이다.
- DB 역할은 `출시_사진개인화_데이터_감사.json`의 `dbClassificationContract`부터 읽고 version/hash/369개 ID별 `(category, nullable subCategory)`를 fixture catalog와 대조한다. 첫 검증은 카페 5개 exact match, `poi_1153`·`poi_25`의 `null → not_applied`, 같은 subCategory·다른 category 격리다.
- 재현 순서는 `node scripts/build_cafe_culture_subcategory_audit.mjs`, `node scripts/build_runtime_poi_catalog.mjs`, `npx tsx scripts/audit_release_personalization_data.ts`다. 공식 원천이나 허용 어휘가 바뀌면 version/hash와 키별 건수를 다시 생성해야 한다.
