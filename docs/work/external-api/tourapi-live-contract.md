# API-TOUR-LIVE-CONTRACT-01 — TourAPI 실시간 어댑터 선행 조사·계약 초안

작성일: 2026-09-21  
부모 결정: [`DEC-LIVE-PUBLIC-DATA-01`](../integration-decision/live-public-data-transition-master-plan.md)  
상태: **조사·권장안 작성 완료 / 사용자 결정·운영계정 확인·구현 전**

이 문서는 단계 A2의 구현 선행 조사다. 마스터 체크박스는 수정하지 않았다. 운영 TourAPI 호출, 환경변수 변경, 배포, fixture 생성, 제품 코드 변경은 수행하지 않았다.

## 1. 현재 public 추천 경로 판정

현재 public 추천에서 TourAPI HTTP 호출은 **0회**다.

실제 호출 사슬은 `TimeSetupScreen → runRecommendationSession → buildRecommendationLimitedInput → createCourseV1CandidateProvider → listRepresentativeCandidates`다. `courseV1CandidateProvider.ts`는 번들 `busan_poi_catalog.json`과 구조화 운영시간 JSON을 동기식으로 읽고, 네트워크 port를 갖지 않는다. 현재 기준은 런타임 369개, 대표 191개이고 그중 TourAPI content ID 연결은 각각 139개, 대표 98개다.

`src/engine/tourapi.ts`에는 `EXPO_PUBLIC_TOURAPI_KEY`를 읽어 `locationBasedList2`와 `detailIntro2`를 직접 호출하는 코드가 남아 있다. 그러나 이는 `planner.ts`의 legacy 경계에만 연결된다. public V1은 planner를 호출하지 않고 CourseV1 entry를 사용한다. engine barrel이 planner를 re-export하므로 번들 포함 가능성은 남지만, 소스 존재나 번들 포함은 실제 public 추천 호출의 증거가 아니다.

따라서 과거 방식은 “개발 시 TourAPI를 조회해 JSON으로 번들”이었고, 현재도 그 번들만 소비한다. 실시간 결과가 후보 포함·제외나 표시를 바꾸는 downstream은 아직 없다.

## 2. 공식 계약 확인

확인일 2026-09-21. 1차 출처는 [공공데이터포털 국문 관광정보 서비스](https://www.data.go.kr/data/15101578/openapi.do)와 같은 페이지의 임베드 Swagger다.

- 서비스: `B551011/KorService2`, REST, JSON/XML. 공식 페이지는 국문 관광정보 15종 약 26만 건의 최신정보를 제공한다고 설명한다.
- 승인·한도: 개발 자동승인, 운영 심의승인. 개발계정 기본 1,000회이며 운영 트래픽은 활용사례 등록 후 증설 신청 대상이다. 현재 저장소만으로 운영계정 승인 오퍼레이션·실제 한도는 확정할 수 없다.
- 공통: `serviceKey`, `MobileOS`, `MobileApp` 필수, 목록은 `numOfRows/pageNo`와 응답 `totalCount`로 페이지를 완결해야 한다.
- 오류: 공식 gateway는 timeout `05`, 일일 한도 `22`, 초당 한도 `23`, 권한 `20`, 키 미등록 `30`, 기한 만료 `31` 등을 구분한다. 원문 메시지나 전체 URL을 앱 오류로 전달할 이유는 없다.
- 콘텐츠: 공식 페이지는 모바일 앱 활용 가능, 공공누리 1·3유형 이미지 혼재, 사진의 부적절한 사용과 기업 CI/BI 사용 금지를 명시한다. `cpyrhtDivCd`를 무시한 이미지 자동 사용은 금지한다.

| 오퍼레이션 | 현재 공식 입력·출력의 핵심 | 실시간 추천 적합성 판정 |
| --- | --- | --- |
| `areaBasedList2` | 지역/법정동·분류, `modifiedtime`, 페이지. content ID/type, 제목, 주소, 좌표, 수정일, 대표 이미지, `cpyrhtDivCd` 반환 | **기본 목록 권장**. 완전한 부산 활성 목록을 받아 기존 승인 ID와 교집합을 만들면 삭제·비공개가 로컬 fallback으로 부활하지 않는다. 기존 `areaCode=6`은 공식 명세에서 삭제 예정이므로 법정동 시도 코드 전환은 별도 확인 필요 |
| `locationBasedList2` | WGS84 `mapX/mapY`, 반경 필수(최대 20km), 거리 정렬/`dist`, 페이지 | 조건부 대안. 호출마다 사용자 수동 좌표를 보내며 20km 바깥·두 지점 사이 corridor 누락이 가능하다. 개인정보·App Privacy 결정 전 사용 금지 |
| `detailCommon2` | content ID 필수. 제목·주소·좌표·수정일·overview·homepage·대표 이미지·저작권 구분 | **선정된 표시 후보에만 지연 호출**. 목록과 중복되는 필드는 검증, overview는 상세 표시용. 추천 순위나 체류시간 입력으로 사용하지 않음 |
| `detailIntro2` | content ID/type 필수. 타입별 운영시간·휴무·행사기간·요금·주차 등 | **사전선정 후보의 필수 상세 권장**. 운영 가능성에 직접 반영. 타입별 필드 parser와 unknown fail-closed 필요 |
| `detailImage2` | content ID, 이미지 구분, 페이지. 원본/썸네일 URL·`cpyrhtDivCd` | 추천 준비에는 제외. 사용자가 상세를 열 때 최대 1회 지연 호출 후보. 실패는 장소 제외 사유가 아니며 권리 불명은 기본 이미지 |
| `areaBasedSyncList2` | 목록 + `showflag`, `modifiedtime`, `oldContentid`; 공식 명칭도 관광정보 동기화 목록 | **세션 runtime 부적합**. 삭제 증분에 유리하지만 영속 cursor/upsert DB가 전제된다. 비저장 세션은 변경 시작점을 잃어 전체 현재 상태를 복원하지 못한다. 로컬 저장 승인이 생기기 전 사용하지 않음 |

권장 최소 조합은 **`areaBasedList2 → 로컬 승인 ID 교집합·공간 사전선정 → 제한된 `detailIntro2`**다. `detailCommon2`는 결과로 보여 줄 최대 4곳, `detailImage2`는 명시 상세 1곳에만 지연 적용한다. `areaBasedSyncList2`는 제외한다.

## 3. 호출 주체 비교와 권장안

| 기준 | 앱 직접 호출 | 원본 비저장 pass-through 서버 |
| --- | --- | --- |
| 키 | `EXPO_PUBLIC_*`가 JS/앱 산출물에 포함되어 추출 가능. 교체에 앱 업데이트 필요 | 서버 secret. 앱 산출물 제외, 앱 업데이트 없이 회전 가능 |
| 공급자 관찰 | 단말 IP·요청 파라미터, location 방식이면 수동 좌표를 TourAPI가 직접 수신 | TourAPI는 서버 IP 수신. 서버 운영자는 요청/수동 좌표를 처리하므로 별도 개인정보·로그 경계 필요 |
| 호출량 | 설치 단말별 분산되어 전역 예산·초당 제한 통제가 약함 | 전역/세션 budget, 동시성, timeout, circuit breaker와 안전 집계 가능 |
| 로그 | 단말·provider 오류 수집이 불균일. 전체 URL 로그 시 키/좌표 노출 위험 | operation/status/count만 집계 가능. raw body/query/키/좌표 로그 금지 강제 가능 |
| 장애 | 한 공급자 실패가 단말에 직접 영향. 통합 관찰 어려움 | 서버라는 추가 장애·지연·비용이 생기지만 typed 오류·차단·관찰을 한 경계에서 제공 가능 |
| 배포 | 클라이언트 변경마다 심사/업데이트 | 어댑터 정책·키 회전은 서버 배포 가능. 서버 계약과 앱 타입은 호환 유지 필요 |

**권장: Supabase Edge의 인증형 원본 비저장 pass-through.** route-proxy와 별도 함수/예산으로 분리하고, 응답 검증 후 정규화된 필드만 앱에 반환한다. 원본 body, 서비스키, 전체 URL query, 좌표, user ID를 DB/로그/trace에 쓰지 않는다. 함수 메모리도 요청 종료 뒤 폐기하며 원본 cache/storage/RPC write를 만들지 않는다.

서버 선택은 키·전역 budget 측면의 권장안일 뿐 확정이 아니다. Supabase가 새 수령 경계가 되는 것은 아니더라도 기존 고지의 처리 목적·전송 항목에 TourAPI 추천 준비와 수동 좌표 여부를 실제 구현과 맞춰야 한다.

## 4. 목록 방식과 계산 가능한 호출량

현재 과거 부산 추출물은 선택 타입 5종 `610`건이다. 공식 목록 응답의 `totalCount`를 매 세션 신뢰해야 하며 610은 미래 보장이 아니다.

### 부산 전체 활성 목록

- 목록 호출 수 = `ceil(totalCount / pageSize)`, 모든 페이지가 성공해야 활성 ID 집합 완성.
- 과거 610건과 `pageSize=1000`이 실제 운영에서 허용된다면 1회. 임베드 Swagger는 `numOfRows`를 제공하지만 최대값을 명시하지 않으므로 운영 제한 호출로 확인 전 보장하지 않는다.
- 개인 수동 좌표 전송 0. 부산 법정동 시도 필터만 전송.
- 활성 목록이 완결돼야 “목록에 없는 기존 ID = 이번 세션 제외”가 안전하다. 페이지 timeout/상한 초과를 partial로 두고 누락 ID를 삭제로 간주하면 안 되므로 이 경우 전체 `unavailable`이다.

### 수동 좌표 기반 목록

- 목록 호출 수 = 각 고유 중심점마다 `ceil(totalCount(center,radius)/pageSize)`. 출발·도착 두 점이면 기본 2개 요청군이며 페이지 중복을 content ID로 제거한다.
- 공식 최대 반경은 20km. 한 점 요청은 그 밖 후보를 놓치고, 두 원이 전체 이동 corridor를 보장하지 않는다. 반경이나 추가 중심점을 늘리면 호출 수와 좌표 전송이 증가한다.
- 앱 직접이면 TourAPI가, 서버 방식이면 Supabase와 TourAPI 처리 흐름이 수동 좌표를 다룬다. GPS는 아니지만 특정 시점의 사용자가 선택한 위치일 수 있으므로 개인 위치가 아니라고 단정하지 않는다.
- 결과가 보통 작아 상세 호출을 줄일 수 있지만 실제 부산 밀집도/응답 totalCount 측정 전 수치를 보장할 수 없다.

**권장: 부산 전체 `areaBasedList2` + 기기/서버 메모리 공간 필터.** 현재 610건 규모에서는 좌표를 보내지 않고도 1개 페이지 후보이며, 완전한 활성 집합이 삭제 판정에 유리하다. 응답 크기·허용 page size·운영 한도 1회 측정 후 뒤집힐 수 있는 조건부 권장이다.

## 5. 호출 예산·timeout 현행과 이력

### 2026-09-21 점진 상세 조회 교체 이력

- **이전 방식:** 번들 좌표로 최대 18곳을 사전선정하고 한 요청에서 `areaBasedList2` 뒤 `detailIntro2`를 최대 18회 자동 호출. 전체 요청 deadline 10초.
- **발생한 문제/관찰:** 번들 좌표가 바뀐 장소를 공간 후보에서 놓칠 수 있고, 초기 18곳의 휴무·운영정보 실패가 추천 공급량을 우연히 고정했다. API가 목록과 상세를 한 번에 실행하면 추천 역할이 충분한 결과에서 조기 종료할 수 없었다.
- **교체한 방식:** catalog 요청은 부산 전체 최신 공통 사실만 반환한다. 상위 orchestrator가 그 live 좌표로 queue를 계산하고 초기 12곳, 부족할 때 명시적으로 6곳씩 detail batch를 요청하며 누적 hard cap은 30곳이다.
- **교체 이유:** 최신 좌표, 공급량, 지연·호출량을 분리하고 충분성 판단과 순위를 추천 역할에 남기기 위해서다.
- **상태:** 18곳 단일 단계·전체10초는 **철회**. catalog/detail batch typed 계약과 누적 budget token은 **현행 구현**, 실제 운영 timeout·세션 누적 deadline은 실측 전 **미확정**.

현행 엔진의 실제 경로 검증 후보 최대 18개, 출시 신규 route attempt 예산, 결과 최대 4개는 바꾸지 않는다.

| 단계 | 세션 상한 후보 | 근거 |
| --- | ---: | --- |
| `areaBasedList2` | 2 pages | page size 1000이 허용되면 과거 610건 1회 + 증가 여유. `totalCount`가 cap을 넘으면 조용한 truncation 대신 unavailable |
| `detailIntro2` | 초기12 + 후속6씩, 누적30 | 최신 catalog 좌표로 만든 queue를 orchestrator가 명시 요청. 충분하면 다음 batch를 호출하지 않음 |
| `detailCommon2` | 4 | 실제 표시 결과 최대 4곳. 목록 정보로 충분하면 생략 |
| `detailImage2` | 1 | 명시 상세 진입 시에만. 초기 추천 준비 0 |
| 총 provider 요청 | 초기 최대14, 전체 세션 최대37 | 목록2 + intro12 또는 누적30 + common4 + image1. 중복 detail ID는 신규 요청/예산으로 세지 않음 |

목록은 페이지당 4초, 상세는 건당 3초, 동시성3을 적용한다. catalog와 각 detail batch는 독립 요청이며 과거 전체10초를 여러 명시 batch에 억지로 공유하지 않는다. 자동 retry0, 사용자 명시 retry1은 새 catalog/session 시작으로만 수행한다. 초기12 batch와 후속6 batch의 요청 deadline 및 추천 세션 누적 deadline은 실제 Edge/TestFlight 지연을 측정한 뒤 orchestrator가 확정해야 한다. API는 현재 건별 timeout 외 임의 전체 deadline을 만들지 않는다.

## 6. 현행 progressive typed 계약

```ts
type CatalogRequest = { action: 'catalog'; approvedCandidates: ApprovedContentRef[] };
type CatalogResult = {
  kind: 'catalog'; status: 'ready' | 'partial';
  snapshot: { liveSourceSnapshotId: string; catalogPlaces: LiveCommonFacts[]; candidateStates: CatalogState[] };
  budgetToken: string; failures?: SafeTourLiveFailure[];
};
type DetailBatchRequest = {
  action: 'detail_batch'; liveSourceSnapshotId: string; budgetToken: string; candidates: ApprovedContentRef[];
};
type DetailBatchResult = {
  kind: 'detail_batch'; status: 'ready' | 'partial'; liveSourceSnapshotId: string;
  details: LiveOpeningFacts[]; candidateStates: DetailState[];
  budget: { detailIntroUsed: number; detailIntroRemaining: number; nextBatchMax: 0 | 1 | 2 | 3 | 4 | 5 | 6 };
  budgetToken: string; failures: SafeTourLiveFailure[];
};
```

- catalog는 완결 목록의 승인 exact-ID 공통 사실만 반환한다. 새 source ID 전체나 사용자 좌표는 반환·수신하지 않는다.
- 서명된 opaque budget token은 같은 snapshot의 active exact ID와 이미 요청한 detail ID만 보존한다. 좌표·원문·사용자 ID를 담지 않으며 DB/file/cache/log에 쓰지 않는다.
- 첫 detail batch의 신규 고유 ID는 최대12, 이후는 최대6, 누적30이다. 중복·이미 요청한 ID는 provider 호출과 예산을 늘리지 않는다.
- API는 다음 batch를 자동 호출하지 않는다. `nextBatchMax`는 허용 상한일 뿐 충분성이나 순위 판단이 아니다.
- catalog `identity_conflict`는 partial이고 상세 호출 대상이 아니다. detail 실패는 `active_detail_failed`이며 inactive로 바뀌지 않는다.
- `detailCommon2`4·`detailImage2`1 budget은 token schema와 상수에서 예약했지만 이 작업에서는 해당 endpoint를 열지 않는다.

### 철회된 단일 snapshot 초안

아래 초안은 이력 보존용이며 실행 기준이 아니다.

```ts
type TourLiveFailureCode =
  | 'timeout' | 'network' | 'http_error' | 'provider_error'
  | 'unauthorized' | 'rate_limited' | 'invalid_response'
  | 'page_limit' | 'request_budget_exhausted';

type SafeTourLiveFailure = Readonly<{
  operation: 'areaBasedList2' | 'locationBasedList2' | 'detailCommon2' | 'detailIntro2' | 'detailImage2';
  code: TourLiveFailureCode;
  status: number | null;
}>;

type TourLivePlace = Readonly<{
  contentId: string;
  contentTypeId: string;
  title: string;
  address?: string;
  lat: number;
  lon: number;
  modifiedAt?: string;
  copyrightType?: 'Type1' | 'Type3';
  opening?: Readonly<{ rawText?: string; normalizedWindows?: readonly unknown[]; closedText?: string }>;
  overview?: string;
  image?: Readonly<{ url: string; copyrightType: 'Type1' | 'Type3' }>;
}>;

type TourLiveSourceResult =
  | { status: 'ready'; snapshot: LiveCandidateSnapshot }
  | { status: 'partial'; snapshot: LiveCandidateSnapshot; failures: readonly SafeTourLiveFailure[] }
  | { status: 'unavailable'; reason: SafeTourLiveFailure };
```

- `ready`: 목록 전체 페이지와 snapshot에 포함되는 모든 필수 `detailIntro2`가 검증됨. 후보 0은 ready empty snapshot이며 장애와 다르다.
- `partial`: 목록은 완결됐지만 일부 상세가 실패. 실패 후보만 제외한 검증 후보 snapshot을 제공하며 오래된 로컬 운영시간으로 성공 승격하지 않는다.
- `unavailable`: 목록/auth/schema/page budget이 실패해 활성 집합을 신뢰할 수 없음. 로컬 번들을 최신 성공으로 조용히 반환하지 않는다.
- safe failure에는 키, URL, query, 좌표, content 원문, provider message, user/session ID를 넣지 않는다.
- snapshot ID는 난수/opaque session token이며 키·content 목록·좌표를 encode하지 않는다.

세션 메모리 dedup key는 `operation + canonical public filters + page` 또는 `operation + contentId + contentTypeId`다. location 방식이 선택되면 정확 좌표/radius는 메모리 내부 key에만 포함하고 문자열화·로그·navigation payload·영속 저장하지 않는다. 같은 세션의 in-flight와 성공 정규화 결과만 재사용하고 오류·partial raw response는 재사용하지 않는다. 새 추천 세션, 명시 재시도, 앱 종료에서 폐기한다.

## 7. downstream 반영 경계

1. 목록 완결 후 live active content ID와 로컬 승인 ID를 교집합한다. 목록에 없는 기존 ID는 해당 snapshot에서 제외한다. 신규 ID는 자동 추천하지 않고 session-only `unreviewedCount` 같은 안전 집계만 남긴다.
2. live 제목·주소·좌표·수정일은 정규화한다. 제목/좌표 급변은 동일 장소로 추정하지 않고 conflict로 제외한다. 임계값은 데이터 담당 결정 전 구현하지 않는다.
3. 로컬 분류, 체류시간, category/subCategory, 중복/site group, 개인화 정책은 그대로 결합한다. 어댑터가 추천 순위나 stay를 결정하지 않는다.
4. **현행:** catalog의 최신 좌표로 상위 역할이 queue를 만들고 초기12·후속6씩 detail batch를 선택한다. detail 성공/실패를 같은 snapshot ID에 누적한 뒤 실제 경로 검증 후보는 최대18개로 제한한다.
5. `detailCommon2`의 overview/주소와 목록의 최신 제목은 결과/상세 표시 snapshot에만 반영한다. 추천 점수로 사용하지 않는다.
6. `detailImage2` 실패는 기본 이미지로 끝낸다. `cpyrhtDivCd`가 없거나 허용되지 않은 신규 이미지는 표시하지 않는다.
7. snapshot 확정 뒤 백그라운드 응답으로 결과를 교체하지 않는다. continuation·2곳 선택·코스 확인은 같은 snapshot을 재사용한다.

이 결합은 API 소유자가 직접 엔진/UI에 구현하지 않는다. 엔진 담당에게 정규화 snapshot 입력, UI 담당에게 typed 상태와 표시 필드 계약으로 인계한다.

## 8. 키·release build 감사

- `.env`: `EXPO_PUBLIC_TOURAPI_KEY`와 `TOURAPI_KEY` 이름 모두 존재. 값은 읽거나 출력하지 않았다. `.env.local`에는 두 이름 없음. 현재 process에도 두 이름 없음. `.env.production*` 파일은 없음.
- `scripts/release-build.cjs`: client allowlist에 `TOURAPI_KEY`가 있어 `EXPO_PUBLIC_TOURAPI_KEY`를 public build environment에 그대로 허용한다. 합성 fixture로 public 키가 결과 environment에 유지됨을 확인했다. 비공개 `TOURAPI_KEY`는 secret/key 필터로 제거된다.
- `src/engine/tourapi.ts`: 실제 client는 public 이름만 읽고 URL query `serviceKey`로 보낸다.
- 따라서 **공개 키의 노출·활성 입력 경로가 존재한다.** 최종 App Store artifact에 실제 값이 포함됐는지는 이번 조사에서 산출물을 생성·검색하지 않았으므로 미확인이다.
- 서버 proxy 확정 시 release allowlist에서 `TOURAPI_KEY`를 제거하고 public 변수 존재 자체를 fail하도록 하는 것이 권장된다. secret은 Edge에만 두며 이 작업에서는 변경하지 않았다.

## 9. 사용자·운영자 결정 필요

통합 세션은 아래를 한 번에 사용자에게 확정받아야 한다.

1. 호출 주체: **비저장 Supabase Edge pass-through 권장** / 앱 직접 호출.
2. 목록: **부산 전체 `areaBasedList2` 권장** / 수동 좌표 `locationBasedList2`.
3. 좌표 전송: 권장안은 `locationBasedList2` 미사용·수동 좌표 전송 없음. 사용할 경우 수령자·목적·보유·App Privacy 반영 승인 필요.
4. 예산 현행: area pages2, intro 초기12·후속6·누적30, common4, image1, 동시성3, 목록4초/페이지·상세3초/건, 자동 retry0·명시 retry1. 전체/session deadline은 실측 후 결정.
5. 전체 실패: 오래된 번들을 최신 성공으로 쓰지 않고 `unavailable` + 명시 재시도/입력 수정으로 둘지 확정.
6. 운영계정: 국문 관광정보 서비스 운영 심의승인 상태, 승인 오퍼레이션, 일/초 한도를 계정 소유자가 값 없이 확인해야 한다.
7. 부산 필터: 삭제 예정 `areaCode=6`을 임시 유지할지, 법정동 시도 코드 조회·전환을 선행할지 결정.
8. 서버 확정 후 `EXPO_PUBLIC_TOURAPI_KEY`를 release build와 로컬/CI public 입력에서 제거할지 승인.

## 10. 인수인계

### 변경 파일과 목적

- `docs/work/external-api/tourapi-live-contract.md`: 현재 호출0, 공식 오퍼레이션 비교, 보안·호출량·typed 계약·downstream·키 감사와 권장안을 기록.
- 그 외 파일 변경 없음. 다른 세션 dirty 변경을 보존했고 stage/commit/push하지 않았다.

### 유지한 계약

- 제품 코드, UI, 추천/체류/개인화, DB, 카탈로그, 환경변수, 운영 API·배포를 변경하지 않았다.
- GPS 재도입, 원본 저장, dummy 호출, 키·좌표·원문 출력, 로컬 stale fallback 성공을 구현하지 않았다.

### 실행 검증

- `rg`로 public 추천 import/call graph, TourAPI source, release input, storage/write 경계를 정적 감사.
- 합성 `publicEnvironment`에 fixture public TourAPI 이름을 넣어 allowlist 유지 여부만 확인. 비밀값 사용0.
- `.env*`는 변수명 존재 boolean만 확인. 값 출력0.
- 공식 data.go.kr 페이지와 임베드 Swagger를 읽기 전용으로 확인. 실제 TourAPI provider 요청0.
- 문서 작성 후 `git diff --check` 실행.

### 남은 위험·재현 조건

- 운영계정 승인/실제 page size/응답 schema는 실제 제한 호출 전 미확인이다. 단계 A2 완료 체크는 아직 불가.
- 610은 2026-07 과거 추출 수이며 운영 totalCount가 아니다.
- area 법정동 코드, 급변 충돌 임계값, 타입별 운영시간 parser, 필드 우선순위는 데이터·엔진 계약이 필요하다.
- 사용자 결정 뒤 fixture-first 구현 → 운영키 제한 호출 정확히 1회 → 안전 집계 → TestFlight 순서를 지킨다.
