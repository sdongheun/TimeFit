# API-BUSAN-LIVE-CONTRACT-01 — 부산 공식 3원천 실시간 snapshot 계약

작성일: 2026-09-22  
부모 결정: [`DEC-LIVE-PUBLIC-DATA-01`](../integration-decision/live-public-data-transition-master-plan.md)  
상태: **공식 계약 조사·비밀 없는 fixture/계약 테스트 초안 완료 / 구현·운영 확인 전**

이 문서는 부산 명소·맛집·쇼핑 원천을 영속 저장하지 않고 추천 세션에서 읽는 외부 API 경계만 정한다. Edge 함수, secret, 환경변수, 추천 엔진, UI, DB, 배포는 변경하지 않았고 실제 공급자 호출도 하지 않았다.

## 1. 공식 서비스 계약

확인일은 2026-09-22이며 1차 출처는 공공데이터포털의 각 공식 페이지다.

| 원천 key | 공식 서비스·근거 | 요청주소 | 공식 승인·한도 |
| --- | --- | --- | --- |
| `busan_attraction` | [부산광역시_부산명소정보 서비스](https://www.data.go.kr/data/15063481/openapi.do) | `https://apis.data.go.kr/6260000/AttractionService/getAttractionKr` | 개발 자동승인, 운영 심의승인. 개발 10,000회, 운영은 활용사례 등록 후 증설 신청 |
| `busan_food` | [부산광역시_부산맛집정보 서비스](https://www.data.go.kr/data/15063472/openapi.do) | `https://apis.data.go.kr/6260000/FoodService/getFoodKr` | 개발 자동승인, 운영 심의승인. 개발 10,000회, 운영은 활용사례 등록 후 증설 신청 |
| `busan_shopping` | [부산광역시_부산쇼핑정보 서비스](https://www.data.go.kr/data/15063487/openapi.do) | `https://apis.data.go.kr/6260000/ShoppingService/getShoppingKr` | 개발 자동승인, 운영 심의승인. 개발 10,000회, 운영은 활용사례 등록 후 증설 신청 |

세 서비스는 부산광역시 관광정책과 제공, REST, JSON+XML, 무료, `이용허락범위 제한 없음`이다. 공통 요청은 query의 `ServiceKey`, `pageNo`, `numOfRows`가 필수이고 `resultType=json`이 선택이며, `UC_SEQ` exact 콘텐츠 ID도 선택 입력이다. 인증키 이름은 대소문자를 포함해 `ServiceKey`다.

공통 응답 envelope의 검증 필드는 `resultCode`, `resultMsg`, `numOfRows`, `pageNo`, `totalCount`다. 성공 row의 공통 핵심은 `UC_SEQ`, `MAIN_TITLE`, `GUGUN_NM`, `LAT`, `LNG`, `PLACE`, `TITLE`, `SUBTITLE`, `ADDR1`, `CNTCT_TEL`, `HOMEPAGE_URL`, `USAGE_DAY_WEEK_AND_TIME`, `MAIN_IMG_NORMAL`, `MAIN_IMG_THUMB`, `ITEMCNTNTS`다. 명소는 `TRFC_INFO`, `USAGE_DAY`, `HLDY_INFO`, `USAGE_AMOUNT`, `MIDDLE_SIZE_RM1`; 맛집은 `ADDR2`, `RPRSNTV_MENU`; 쇼핑은 `MAIN_PLACE`, `ADDR2`, `TRFC_INFO`, `USAGE_DAY`, `HLDY_INFO`, `USAGE_AMOUNT`, `MIDDLE_SIZE_RM1`을 추가로 문서화한다.

공식 gateway 오류는 `01` application, `04` HTTP, `05` timeout, `10` invalid parameter, `12` 없는/폐기 서비스, `20` 키 누락·권한 거부, `22` 일일 한도, `23` 초당 한도, `29` 차단 IP, `30` 미등록 키, `31` 만료 키를 구분한다. 앱에는 원문 메시지 대신 아래 안전 enum만 반환한다.

```ts
type BusanLiveFailureCode =
  | 'timeout' | 'network' | 'http_error' | 'provider_error'
  | 'unauthorized' | 'rate_limited' | 'invalid_response'
  | 'page_limit' | 'request_budget_exhausted';
```

### 수정·삭제 의미의 한계

세 공식 schema 모두 row별 수정시각, 삭제 표시, 현재 공개 상태 flag를 제공하지 않는다. 포털 페이지의 `수정일`은 데이터셋 metadata 수정일일 뿐 row의 `modifiedAt`이 아니다. 따라서 증분 동기화나 삭제 이벤트 계약은 만들 수 없다.

- 전체 페이지가 모두 성공하고 `totalCount`와 수집 row 수가 일치한 원천에서만, 승인된 `UC_SEQ`가 이번 목록에 없음을 `inactive_for_this_snapshot`으로 해석한다.
- timeout, schema 오류, page cap 초과, 중복/누락 페이지가 있으면 그 원천 전체를 `unavailable`로 둔다. 누락 ID를 inactive로 만들지 않는다.
- 이 상태는 세션 메모리에서만 유효하다. DB 삭제나 로컬 원천 수정으로 승격하지 않는다.

## 2. 호출 방식과 계산 가능한 예산

공식 API는 `UC_SEQ` 단건 조회를 지원하지만 대표 부산 연결 109개를 각각 조회하면 세션마다 최대 109회다. 이 방식은 지연과 개발계정 예산에 불리하므로 채택하지 않는다.

**현행 권장 초안은 각 원천 전체 목록을 한 번씩 받아 승인 exact ID와 메모리에서 교차하는 방식이다.**

- `numOfRows=500`, 원천당 최대 2페이지, 자동 retry 0.
- 정상 예상: 원천 3개 × 1페이지 = provider 3회.
- hard cap: 원천 3개 × 2페이지 = provider 6회. `totalCount > 1000` 또는 두 페이지 불완전이면 해당 원천 `page_limit` unavailable.
- 저장된 조사본 규모는 명소 213, 맛집 437, 쇼핑 55이므로 500행이면 각 1페이지지만, 이 수치는 미래 공식 보장이 아니다. 런타임은 매번 `totalCount`로 판정한다.
- 공식 페이지는 `numOfRows`의 최대 허용값을 명시하지 않는다. 500행 허용 여부는 배포 전 계정 소유자가 제한된 1회 검증으로 확인해야 하며, 실패 시 page size를 낮추되 원천당 2페이지·총 6회 cap을 조용히 늘리지 않는다.

공식 페이지의 현재 공개 개발 한도는 서비스별 10,000회다. 그러나 현재 계정에 알려진 제약은 1,000회이므로 구현 전에는 **더 작은 1,000회**를 실제 일일 예산으로 본다. 총 6회 cap이면 이론상 하루 166개 완결 snapshot(정상 3회면 333개)이지만, 다른 테스트·운영 호출을 위한 reserve가 빠지지 않은 값이라 운영 허용량이 아니다. 계정 화면에서 세 서비스별 실제 승인 상태·일/초 한도·리셋 기준을 값 노출 없이 확인하기 전 production ready로 판정하지 않는다.

## 3. 요청 주체·보안·비저장 경계

권장 주체는 **인증된 Supabase Edge 비저장 pass-through**다. TourAPI 함수·키·예산과 분리한 별도 함수로 둔다.

앱 → Edge 요청은 다음만 허용한다.

```ts
type BusanLiveRequest = Readonly<{
  action: 'catalog_snapshot';
  liveSourceSnapshotId: string;
  approvedSourceIds: Readonly<{
    busan_attraction: readonly string[];
    busan_food: readonly string[];
    busan_shopping: readonly string[];
  }>;
}>;
```

- 앱은 공급자 키·endpoint·page를 보내지 않는다. Edge가 secret `ServiceKey`를 공급자 query에만 붙인다.
- 사용자 수동/GPS 좌표, 사용자 ID, 장소명 검색어는 부산 API에 보내지 않는다. 서버는 부산 전체 공개 목록을 받고 승인 ID만 교차한다.
- 공급자 raw body, 키, 전체 URL/query, 좌표, 사용자 ID를 DB·file·cache·log·trace에 기록하지 않는다. 로그는 snapshot 성공 상태, 원천 key, 안전 오류 enum, provider call count, 검증 row count 같은 집계만 허용한다.
- raw body와 정규화 결과는 해당 Edge invocation 메모리에서만 사용하고 종료 시 폐기한다. 세션 간 stale cache·DB fallback은 없다.
- Supabase 인증 실패는 공급자 호출 0회로 `unavailable/unauthorized`를 반환한다.

TourAPI와 부산 3원천은 같은 `liveSourceSnapshotId`로 join할 수 있지만 각자의 budget token, timeout, source state를 공유하지 않는다. API 어댑터는 추천 순위, 체류시간, provider 우선순위, 후보 충분성을 결정하지 않는다.

## 4. typed 결과와 부분 실패

```ts
type BusanSourceKey = 'busan_attraction' | 'busan_food' | 'busan_shopping';

type BusanSourceResult =
  | Readonly<{
      status: 'ready'; complete: true; providerCalls: 1 | 2;
      activeApprovedSourceIds: readonly string[];
      inactiveApprovedSourceIds: readonly string[];
      records: readonly BusanLiveRecord[];
    }>
  | Readonly<{
      status: 'unavailable'; complete: false; providerCalls: 0 | 1 | 2;
      reason: BusanLiveFailureCode;
    }>;

type BusanLiveResult = Readonly<{
  status: 'ready' | 'partial' | 'unavailable';
  liveSourceSnapshotId: string;
  sources: Readonly<Record<BusanSourceKey, BusanSourceResult>>;
}>;
```

- 세 원천 ready면 전체 `ready`, 1~2개 원천만 ready면 `partial`, 세 원천 모두 실패할 때만 전체 `unavailable`이다.
- 한 원천 실패가 다른 원천의 성공 row를 지우지 않는다. 실패 원천을 과거 저장본으로 채우지 않는다.
- `records`는 요청에 들어온 승인 `UC_SEQ`만 반환한다. 전체 신규 ID·제목·좌표는 앱으로 전달하지 않고 필요하면 `unreviewedCount` 같은 집계만 허용한다.
- row identity는 exact `source key + UC_SEQ`다. 제목·주소·좌표 근접으로 다른 row를 합치지 않는다.
- 같은 snapshot의 공통 사실만 join한다. 추천 역할이 source mapping과 TourAPI/부산 중 어느 사실을 쓸지 결정한다.

## 5. 표시·출처·사진

세 공식 페이지는 서비스 수준에서 `이용허락범위 제한 없음`이고 이미지 URL 필드를 문서화한다. 다만 row에는 사진별 권리자·라이선스 유형·변경 허용 필드가 없다.

- 서비스명과 공식 원문 URL은 출처 metadata로 보존한다. 사용자 표시 문구는 `자료: 부산광역시 <서비스명>`을 기본 제안으로 하되 최종 UI 문구는 UI/통합 역할이 확정한다.
- live row의 이미지 URL만으로 새 사진을 자동 공개하지 않는다. 기존 exact `source key + UC_SEQ + URL` 승인 evidence가 있고 HTTPS·표시 조건 검증을 통과한 경우만 별도 image 계약으로 전달한다.
- 승인 evidence가 없거나 URL이 변경되면 `photo.status='not_returned_without_approved_evidence'`로 두고 URL을 응답에서 제외한다. 사진 실패는 장소 원천 상태를 unavailable로 만들지 않는다.
- 상세 본문·운영시간도 공급자 원문을 그대로 로그/DB에 저장하지 않는다. 허용 필드만 정규화해 세션 snapshot에 둔다.

## 6. 구현 전 확인과 사용자 결정

1. **권장:** 인증형 비저장 Supabase Edge 별도 함수 / 대안: 앱 직접 호출. 앱 직접 호출은 키 추출, 전역 예산 통제, 키 회전 때문에 비권장이다.
2. **권장:** 500행 × 최대 2페이지 × 3원천, 총 6회 / 대안: 109 exact-ID 호출. exact-ID 방식은 지연·호출량 때문에 비권장이다.
3. production 전에 세 서비스 운영 심의승인과 실제 계정 한도, `numOfRows=500` 허용을 확인해야 한다. 현재는 구현 ready가 아니라 계약 ready다.
4. 500행이 거절되거나 어느 원천이 1,000행을 넘으면 cap 증설을 자동 결정하지 않는다. 호출 예산 확대, background refresh, persistent cache는 사용자 결정이 필요하다.
5. 사진 URL 변경 시 새 URL을 기존 승인으로 간주할지 여부는 데이터/통합 역할의 evidence 정책 결정이 필요하다. 이 계약은 자동 승격하지 않는다.

## 7. 완료 인계

### 변경 파일 / 변경 목적

- `docs/work/external-api/busan-live-contract-01.md`: 세 공식 서비스 계약, 호출량, 비저장 Edge 경계, 부분 실패, 권리·미확인 사항 기록.
- `test/fixtures/busan-live-contract.fixture.json`: 비밀·사용자 좌표 없는 ready/partial/page-incomplete/unavailable 계약 fixture.
- `test/busan-live-contract-draft.test.mjs`: 위치 비전송, 3~6회 cap, fail-closed page 완결성, 원천 실패 격리, 사진 승인 경계를 고정하는 초안 테스트.

### 유지한 계약

- exact source ID만 사용하며 제목·좌표 추정 매칭을 만들지 않았다.
- 사용자 좌표를 부산 공급자에 보내지 않는다. 원본 응답·키·query·좌표·사용자 ID를 영속화하거나 로그에 남기지 않는다.
- stale fallback 없이 원천별 ready/unavailable을 보존하며, API가 추천 순위·체류시간·provider 우선순위를 정하지 않는다.
- 추천 엔진, UI, DB, 환경변수, Edge 함수, 배포, 데이터 매핑 파일과 마스터 보드는 변경하지 않았다. 실제 외부 API 호출은 0회다.

### 테스트 결과

- `node --test test/busan-live-contract-draft.test.mjs`: **5/5 통과**.
- fixture는 실제 장소명·좌표·키·원문 provider body를 포함하지 않는다.

### 다음 결정·위험

- 운영 심의승인·실제 1,000회 계정 한도·초당 제한·500행 허용은 계정 소유자 확인 전 미확인이다.
- 공식 schema에는 row 수정/삭제 신호가 없어 완결 전체 목록 외에는 inactive 판정이 불가능하다.
- Edge 구현을 승인하면 별도 작업에서 인증, secret 이름, timeout/concurrency, 일일 reserve, safe aggregate 로그를 확정해야 한다. TourAPI 예산과 합치지 않는다.
- 사진별 권리 필드가 없으므로 기존 exact 승인 evidence 없는 live 이미지 자동 표시는 계속 차단한다.
