# API-BUSAN-LIVE-ADAPTER-02 — 부산 공식 3원천 비저장 Edge 어댑터

작성일: 2026-09-22

부모 결정: [`DEC-LIVE-PUBLIC-DATA-01`](../integration-decision/live-public-data-transition-master-plan.md)

선행 계약: [`API-BUSAN-LIVE-CONTRACT-01`](./busan-live-contract-01.md), [`DATA-BUSAN-LIVE-MAPPING-01`](../data-curation/busan-live-mapping-01.md)

상태: **로컬 구현·fixture 검증 완료 / Edge secret·배포·실제 공급자 호출·downstream 결합 전**

## 1. 구현 결과

TourAPI 함수와 분리된 `busan-live` Supabase Edge 경계를 추가했다. 앱은 인증 JWT, opaque `liveSourceSnapshotId`, 세 원천별 승인 `UC_SEQ`, 기존 사진 승인 evidence만 보낼 수 있다. Edge가 세 공식 endpoint와 pagination을 고정하고 원본 응답을 해당 invocation 메모리에서만 검증·정규화한다.

### 요청 계약

```ts
type BusanLiveRequest = {
  action: 'catalog_snapshot';
  liveSourceSnapshotId: string;
  approvedSourceIds: Record<BusanSourceKey, readonly string[]>;
  approvedPhotos: Record<BusanSourceKey, readonly ApprovedPhotoEvidence[]>;
};
```

- request object와 원천 map은 exact key allowlist를 사용한다. 좌표, 검색어, page, base URL, 서비스키 등 추가 필드는 HTTP 400 `invalid_response`이며 provider 호출은 0회다.
- snapshot ID는 1~128자의 영문·숫자·`.`·`_`·`-`만 허용한다. 키·좌표·이메일을 encode하거나 서버가 사용자 ID를 반환하지 않는다.
- `UC_SEQ`는 원천당 최대 200개, 숫자 문자열, 중복 없음으로 제한한다. 현재 exact mapping 133링크를 수용하면서 무제한 입력을 막는다.
- 사진 evidence는 승인 ID에 속하고 HTTPS URL, 원천별 고정 공공데이터포털 URL, 제한 없음 라이선스, 상업·변경 허용 true, 검증일을 모두 만족해야 한다. 이는 새 권리 승인이 아니라 기존 exact evidence를 live URL과 대조하기 위한 입력이다.

### 인증·secret

- `index.ts`는 TourAPI와 동일하게 Supabase `auth.getUser(token)`을 사용한다. 이메일·anonymous Supabase JWT는 같은 인증 gate를 통과하며 공개 무토큰 endpoint는 없다.
- 공급자 secret의 코드상 이름은 `BUSAN_PUBLIC_DATA_SERVICE_KEY`다. 이 작업에서는 secret을 만들거나 조회·출력하지 않았다.
- 인증 실패·secret 누락·입력 오류는 공급자 호출 전 `providerCalls=0`으로 종료한다.

## 2. 공급자 호출·페이지 완결 계약

| 항목 | 구현값 |
| --- | ---: |
| page size | 500 |
| 원천별 page cap | 2 |
| snapshot provider call hard cap | 6 |
| 정상 예상 | 3 |
| 원천 동시성 | 2 |
| 원천 내부 page | 직렬 |
| page timeout | 4,000ms |
| 자동 retry | 0 |
| 사용자 명시 retry | 새 snapshot ID로 최대 1회 |

고정 endpoint는 `AttractionService/getAttractionKr`, `FoodService/getFoodKr`, `ShoppingService/getShoppingKr`다. Edge만 `ServiceKey`, `pageNo`, `numOfRows=500`, `resultType=json`을 구성한다. 앱 입력으로 endpoint·page·query를 바꿀 수 없다.

원천별 완결 조건은 다음과 같다.

1. HTTP 성공과 공식 success `resultCode/code` (`00` 또는 `0000`).
2. 요청 page와 응답 `pageNo`, 요청 500과 응답 `numOfRows`, 모든 page의 동일 `totalCount` 일치.
3. `totalCount <= 1000`, page별 기대 row 수와 실제 row 수 일치.
4. 모든 row가 중복 없는 숫자 `UC_SEQ`를 가짐.
5. 승인된 active row는 비어 있지 않은 `MAIN_TITLE`과 유효한 `LAT/LNG`를 가짐.
6. 전체 수집 row 수가 `totalCount`와 정확히 일치.

500행 거부는 HTTP/provider typed failure, 1,000행 초과는 `page_limit`, page 누락·중복·schema 불일치는 `invalid_response`로 해당 원천만 unavailable이다. cap을 자동 확대하거나 단건 ID 109회 방식으로 전환하지 않는다.

## 3. 정규화·부분 실패·inactive

완결된 원천만 아래 facts를 반환한다.

- identity: `source`, `sourceId(UC_SEQ)`
- 현재 사실: `title`, optional `address`, `lat/lon`, optional `openingText`, `closedText`, `description`
- 사진: 기존 evidence URL이 현재 `MAIN_IMG_NORMAL` 또는 `MAIN_IMG_THUMB`와 exact 일치할 때만 승인 metadata. 없거나 변경되면 URL 없이 `not_returned_without_approved_evidence`

없는 optional 값을 로컬 원천이나 다른 필드의 의미로 합성하지 않는다. 맛집에 휴무 필드가 없으면 `연중무휴`로 만들지 않는다.

- complete 목록에 있는 승인 ID만 active record다.
- complete 목록에 없는 승인 ID만 해당 snapshot의 inactive다.
- incomplete/unavailable 원천에는 inactive 배열을 반환하지 않는다.
- 신규·미승인 ID의 제목·좌표·설명·사진은 응답에 반환하지 않는다.
- 세 원천 ready면 전체 `ready`, 1~2개 ready면 `partial`, 모두 실패할 때 전체 `unavailable`이다. 한 원천 실패가 다른 ready facts를 제거하지 않는다.
- stale 저장본·DB·cache fallback이 없다.

클라이언트 adapter는 snapshot ID, source key, 승인 ID 전체 partition, record/active 일치, photo evidence exact 일치, 원천별 call 수와 총 6회 cap, 전체 status 계산을 다시 검증한다. Edge 응답을 그대로 신뢰하지 않는다.

## 4. 비저장·안전 경계

- handler와 client에 DB/file/AsyncStorage/cache/RPC write가 없다.
- `console.*` logging과 raw response/error stringify가 없다.
- 응답 header는 `Cache-Control: no-store`다.
- 공급자 원문 body, 전체 URL/query, ServiceKey, 사용자 ID, 좌표를 로그·trace·응답 metadata에 넣지 않는다.
- 사용자 출발지·도착지·GPS 좌표는 request type에도 없고 strict input parser가 추가 위치·검색 필드를 거부한다.
- 오류는 `timeout | network | http_error | provider_error | unauthorized | rate_limited | invalid_response | page_limit | request_budget_exhausted`와 선택적 HTTP status만 반환한다. provider message는 폐기한다.

이 작업의 외부 API 호출은 0회다. 개발계정 1,000회는 보수적인 운영 상한으로 유지한다. 비영속 handler만으로 계정 전체의 일일 사용량을 원자적으로 집계할 수 없으므로, production 활성화 전에 계정 소유자가 실제 승인·일/초 한도를 확인하고 별도 전역 budget 저장이 필요한지 결정해야 한다. 이번 작업은 DB를 새로 만들지 않았다.

## 5. 변경 파일과 목적

- `src/services/busanLiveAdapter.ts`: client request/result 타입, 인증형 Edge invoker, 응답 재검증, 새 snapshot 명시 retry 1회, 호출 상수.
- `supabase/functions/busan-live/handler.ts`: strict 입력, 고정 3 endpoint, 동시성2·페이지 직렬·4초 timeout·총6회 budget, envelope/page/schema 검증, exact ID 정규화와 부분 실패 격리.
- `supabase/functions/busan-live/index.ts`: Supabase JWT 인증과 서버 전용 secret 연결.
- `test/busan-live-handler.test.ts`: 정상3/4/6회, 7회 차단, 1,000행 초과, incomplete/duplicate/schema, partial/unavailable, inactive/new ID, 입력/auth, 사진 변경, timeout fixture.
- `test/busan-live-adapter.test.ts`: JWT 전달, 무토큰 provider0, 응답 ID/snapshot/call budget 검증, 새 snapshot retry 1회.
- `test/busan-live-safety.test.mjs`: 영속 write/log/위치/public key 0과 고정 endpoint/query 경계 감사.
- 이 문서: 구현 계약과 다음 역할 인계.

## 6. 유지한 공개 계약·정책 경계

- 최대 180분·최대 2곳, 체류시간, category/subCategory, 개인화, 추천 등급, route 호출 예산은 변경하지 않았다.
- exact `source key + UC_SEQ`만 사용하며 이름·주소·좌표 유사 매칭과 신규 장소 승격을 만들지 않았다.
- TourAPI 예산·token·함수와 부산 예산을 공유하지 않는다.
- API가 provider 우선순위, 필드 충돌 해결, 추천 순위, 체류시간, 후보 충분성을 결정하지 않는다.
- `src/ui`, `src/engine`, `src/data`, DB/migration, env/secret/release 입력, 마스터 계획·보드는 수정하지 않았다.
- Edge 배포, 실제 공급자 호출, commit/push는 수행하지 않았다.

## 7. 테스트 결과

- 부산 handler/client 집중 fixture: **15/15 통과**.
- 부산 계약·안전 회귀: **7/7 통과**. 집중 합계 **22/22**.
- `npm run test:typecheck`: **통과**.
- `npm test`: wrapper 통과. 같은 loader 경계를 직접 펼친 전체 discovery **587/587 통과**.
- `npm run test:ui`: **824개 중 823 통과, 기존 skip 1, 실패 0**.
- `git diff --check`: **통과**.
- 실제 외부 호출: **0회**.

## 8. 다음 projection/orchestrator 인계

1. 데이터 projection은 manifest의 provider별 exact ID를 `approvedSourceIds`로 만들고, 기존 exact photo evidence만 `approvedPhotos`로 전달한다. 새 live URL을 evidence로 생성하지 않는다.
2. 추천 orchestrator는 TourAPI와 부산 호출에 같은 `liveSourceSnapshotId`를 주되 결과 budget·상태는 분리한다. 부산 partial에서 ready 원천을 보존한다.
3. 필드 결합은 데이터 계약의 필드별 최신성·존재·identity gate를 따른다. 부산 adapter가 TourAPI 값을 덮거나 두 운영시간 문자열을 이어 붙이지 않는다.
4. 모든 mapped provider가 complete 목록에서 inactive일 때만 장소 전역 inactive 여부를 판단한다. 한 부산 원천 unavailable은 inactive 근거가 아니다.
5. production 전 계정 소유자가 세 서비스 승인, 실제 개발/운영 일·초 한도, `numOfRows=500`, 공식 JSON envelope를 제한 호출로 확인해야 한다. 결과가 다르면 fixture와 parser를 먼저 교정하고 cap을 임의 확대하지 않는다.
6. Edge 활성화에는 `BUSAN_PUBLIC_DATA_SERVICE_KEY` secret 설정과 함수 배포가 필요하지만 이번 작업 범위에는 포함하지 않았다.

## 9. 다음 결정·위험·재현 조건

- 공식 문서 기반 두 envelope 형태를 지원하지만 실제 개발계정 응답은 아직 0회다. 첫 제한 호출은 서비스별 1페이지를 한 추천 snapshot에서 수행하고 키·원문 없이 operation/status/row count/call count만 기록한다.
- page timeout 4초·원천 동시성2는 로컬 구현 초기값이다. cap을 유지한 실제 Edge 지연 측정 뒤 변경 여부를 사용자에게 결정받는다.
- 계정 전체 1,000회 일일 budget의 원자적 선차감은 비영속 함수만으로 제공하지 않는다. provider quota만으로 충분하지 않다면 DB 역할과 소유권 조정 후 안전 집계/lease를 별도 설계해야 한다.
- client가 제출하는 사진 evidence는 새 권리 증명이 아니다. downstream은 기존 데이터 manifest에서 생성된 evidence만 사용해야 하며, 변경 URL은 계속 기본 이미지다.
- 시작/종료 HEAD: `96c5512` / 작업 트리 동일 HEAD(미커밋).
