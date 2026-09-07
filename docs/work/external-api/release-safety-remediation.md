# API-RELEASE-SAFETY-01 — 출시 로그·위치 캐시 안전성

상태: **API 국소 보완·집중 fixture 완료, 전체 통합 게이트 미통과·baseline 영속 전환 결정 대기** (2026-09-07). 개인화 DB/UI와 병렬. 근거는 release-api-audit.md와 DB release-data-audit.md다. 실제 provider 장애로 단정하지 않는다.

1. V1 proxy/legacy Execution/저장 코스 진입의 호출 graph를 정리하고 실제 Release config가 필요한 곳을 미확인으로 구분한다. 키/환경 값은 출력하지 않는다. TMAP/ODsay를 무작정 삭제하거나 proxy flag를 조용히 바꾸지 않는다.
2. adapter/transport의 정확 좌표·raw Error 로그를 안전한 고정 code/count/status로 대체한다. src/engine/travel.ts는 이번 작업에서 네트워크/로깅 함수만 소유하며 순수 추천 정책은 변경 금지. UI AuthContext 로그는 UI 인수인계로 남긴다.
3. routeBaselineService의 개인 좌표를 담은 persistent key/geometry 경로를 조사한다. 활성 코스 복구 snapshot과 성능 cache는 별개다. 불필요한 legacy 성능 cache를 process memory로 대체 가능한지 fixture로 증명한다. 추천 호출량/복구/공개 계약을 바꾸면 자동 구현하지 말고 영향과 대안을 반환한다.
4. 기존 위치 cache 정리는 정확한 전용 prefix/key만 대상으로 계획한다. Auth/완료/활성/다른 앱 저장소 전체 clear 금지. 임의 24시간을 약관 근거로 쓰지 않는다. 앱 삭제·운영 cache 삭제는 하지 않는다.
5. public/private route 캐시와 서버 비영속 계약은 보존한다. local snapshot 영속을 서버 비영속과 혼동한 문서 표현은 인계에서 바로잡는다.
6. UI A handoff에서 필요한 API adapter 변경은 UI와 정확한 반환 이벤트/파일 writer를 먼저 합의한다. Expo browser Promise resolve를 외부 앱 성공으로 오인하는 경계, 실패/불명확/취소를 구분한다. 준비 완료를 실제 route success로 반환하지 않는다.
7. cache purge/anonymous cleanup/TTL·region·log/backup 설정과 provider 권한·약관·지도 출처는 읽기 전용 확인 계획으로 남긴다. 이번 작업은 원격 실행/배포 승인 아님. 계정별 계약이 미확인이면 compliance 완료로 표시하지 않는다.
8. fixture: raw 로그 민감값 부재, private/public cache 격리, dedicated legacy purge의 다른 데이터 보존, provider 성공/실패/취소, 기존 route count/TTL/geometry 계약. transport 변경으로 호출량이 달라지면 중단·보고한다.

## 공통 검증·권한

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.

## 2026-09-07 수행 결과와 판단

### 현행 변경과 보류 이력

- 이전: `travel.markRouteCall/markOdsayCall`이 정확 좌표를 console에 기록 → 실제 transport fixture에서 민감 필드 검출 → 좌표 인자를 logging 함수에서 제거하고 고정 `route_request` code/provider/mode/count만 기록 → 호출 관찰을 유지하면서 위치 노출 차단. **국소 구현 완료**. provider 종류·요청·fallback·retry·카운터 저장은 불변이다.
- 이전: 위치 검색 결과와 baseline geometry를 cache 소유 객체로 반환 → 소비자가 배열/좌표를 바꾸면 다음 cache hit 및 in-flight 소비자의 결과 오염 → 반환 객체/배열/좌표를 분리하고 baseline 입력 geometry도 복사 → 재호출 없이 cache 소유권 보장. **국소 구현 완료**. 검색 key·TTL·허용 수단·geometry 값·순서·호출 수는 유지한다.
- 이전: `travel.ts` 주석의 24시간을 약관 근거처럼 표현 → 계정별 공식 허용/물리 삭제 증거가 없음 → 기존 성능 cache의 재사용 TTL이라는 표현으로 교정. **주석 교정 완료**, 수치는 바꾸지 않았다.
- baseline 영속 제거는 **보류**다. `routeBaselineService`의 기본 namespace는 `timefit:route-baselines:v1`이며 key 자체에 양 끝 정규화 좌표, value에 수단별 geometry/fetchedAt이 들어간다. `travel.ts`가 AsyncStorage를 주입하고 `ExecutionScreen.tsx` 재계산이 `getActualRouteBaselines`를 호출한다. 활성 진행 snapshot과는 별개의 성능 cache다.
- `SAFETY-04`는 같은 유효 cache로 service를 재생성하면 fetcher 0회, storage 없는 새 service면 세 수단 fetcher 3회임을 증명한다. 실제 네트워크 수는 하위 transport cache·키·수단 결과에 달려 있으나 cold restart에서는 provider 비용 증가 가능성이 있다. 그러므로 “불필요하니 삭제해도 호출량 불변”은 입증되지 않았다. production storage 연결을 해제하거나 기존 데이터를 지우지 않았다.
- 선택지: (A) 출시 legacy 도달성/지원 범위를 먼저 확정하고 불필요 경계만 제거하도록 별도 승인, (B) 필요한 legacy는 메모리 전환에 따른 재시작 신규 검증 예산을 명시 승인. 계정 보유/삭제 정책과 함께 통합이 결정한다. 좌표 hash key만으로 geometry의 개인정보가 사라진다고 보지 않는다.

### 출시 호출 graph와 설정 미확인

| 코드상 진입 | 요청 경로 | 확정과 미확인 |
| --- | --- | --- |
| Results V1 / 선택형 2곳 | `recommendationPortsFor` → proxy-enabled adapter → Supabase Auth/Edge → Kakao walk/publictraffic | 코드상 경계 확인. 실제 Release flag, 번들 포함 설정, 배포 handler 일치는 미확인 |
| proxy-disabled branch | `createLegacyRoutes` → legacy travel | branch 존재 확인. provider 키 존재/값이나 최종 Release 선택은 열람하지 않음 |
| 저장 코스/legacy 진행 | `MyCourses` → `Execution`; 재계산 → `getActualRouteBaselines` → 세 수단 baseline fetcher → TMAP/ODsay; LegacyResults 연결도 존재 | 해당 기능을 임의 삭제하지 않음. 실제 사용자 동선에서 접근 가능한 상태/저장 데이터는 미조회 |
| 장소 검색/GPS 라벨 | PlacePicker/TimeSetup → Kakao Local adapter → 앱 직접 요청 | 위치 cache는 프로세스 메모리. 검색 query·확정/GPS 좌표 전송은 이전 감사와 동일 |
| 상세 도보 보충 | privateWalkConnector → 기존 session Edge → Kakao walk | public cache와 격리된 메모리 reuse·attempt 계약 유지 |

실제 provider 변경·운영 호출은 0회다. 이전 [출시 감사](release-api-audit.md)는 수정 전 증거이며 이번 국소 변경만으로 전체 Release가 안전해졌다는 판정에 재사용하지 않는다.

### 전용 정리 경계

`src/services/legacyRouteBaselineCleanup.ts:purgeLegacyRouteBaselineCache(storage)`를 **주입 fixture용·미연결 도구**로 준비했다. 기본 v1 prefix와 정확한 두 좌표 key 형식/범위가 모두 맞는 항목만 `removeItem`으로 처리한다. caller 임의 prefix, value 조회, 전체 clear는 지원하지 않는다. 반환은 `completed | partial | unavailable`과 삭제/실패 수이며 key·좌표·raw Error는 반환/로그에 넣지 않는다.

fixture에서 Auth, 활성 코스, 완료 이력, 사용량 집계, 유사 prefix, v2, suffix 추가 key가 모두 보존됐다. 열거 실패는 unavailable, 삭제 실패는 partial이며 중복 key는 한 번만 시도한다. **앱 startup·logout·계정 삭제 어디에도 연결하지 않았고 실제 기기 저장소를 삭제하지 않았다.** baseline writer가 남아 있는 상태에서 먼저 자동 purge를 연결하면 재생성·호출 증가가 발생할 수 있으므로 전환 결정과 writer 차단 순서 확정 뒤 담당자가 연결해야 한다. 네트워크 provider 결과나 활성 코스 복구 snapshot을 지우는 도구가 아니다.

### UI 인수인계와 소유권

- `src/ui/AuthContext.tsx`의 raw 오류 객체/메시지 console은 UI writer 소유다. 실패 stage를 고정 `auth_session_failed`, `auth_link_failed` 등으로 투영하고 URL/token/message를 전달하지 않는 수정 요청을 UI A 인계로 남긴다. API transport에는 해당 raw log가 없고 Edge throw/AbortError는 기존 `route_proxy_transport_failed`로 닫히는 것을 fixture로 검증했다. API의 취소를 새 success/새 enum으로 승격하지 않았다.
- `src/ui/execution/schedule.ts`, CourseConfirm, Live Activity runtime은 현재 UI 단일 writer가 편집 중이다. 이 API 세션은 해당 파일을 수정하지 않았다. provider receipt와 외부 앱 handoff는 다른 계약이며 API adapter에 browser 성공 판단을 넣지 않았다.
- 읽은 handoff는 `KakaoRouteOpenResult` 및 `KakaoRouteDiagnostic`이고 browser Promise resolve는 현재 `browser_fallback_cancelled`로 반환한다. background 관찰은 `browser_fallback_opened`로 분류하지만 **그 관찰만으로 목적 카카오앱의 실제 경로 성공을 증명하지 못한다**. 불명확 상태의 별도 표현·성공 판정 변경이 필요하면 UI writer가 `schedule.ts` 반환 이벤트와 소비자/fixture를 함께 소유하고 통합 수락을 먼저 받아야 한다. 준비 완료→opened 합성은 허용하지 않는다. 이 문서는 계약 제안/위험 인계이며 파일 소유권 합의가 완료됐다는 기록이 아니다.

### 원격 읽기 전용 확인 계획 — 이번 실행 대상 아님

| 확인 대상 | 후속에서 필요한 비밀 없는 증거 | 현재 판정 |
| --- | --- | --- |
| Release/배포 연결 | proxy branch 선택 boolean, release artifact 식별, handler 계약 버전 일치, 진단 Function 배포 제외 여부 | 미확인 |
| cache/lease purge | job 활성 여부·주기·최근 성공시각·집계 삭제 수, 실패 경보 유무 | 함수 존재와 운영 실행은 별개, 미확인 |
| anonymous cleanup | scheduler 인증/활성 여부, 30일 후보 규칙·연결 데이터 재확인·최근 집계 결과 | 사용자 row/ID 없이 확인 필요 |
| TTL·region·로그·backup | cache TTL 설정 일치 판정, 처리 region, 로그 종류별 보유·drain, backup/PITR 삭제 후 잔존기간 | 앱 TTL/서버 비영속으로 대체 불가 |
| provider 계정/약관 | 사용 제품별 승인·도메인/플랫폼 등록·요금/권한, cache/geometry 저장 허용 조항의 공식 URL·버전·확인일 | 미확인; 24시간 주석을 근거로 사용 금지 |
| 지도/사진 출처 | 실제 Release logo 가림 여부, 경로 데이터 표시 조건, 사진별 권리/보이는 표기 | 데이터/UI writer의 별도 게이트 |

로그·키·좌표·사용자 row를 가져오는 전수 감사 대신 위 안전 집계/설정 판정만 후속 승인 범위에서 확인한다. 현재 compliance 완료로 표시하지 않는다. server private 비영속과 `activeVerifiedCourseStorage`의 local snapshot 영속은 계속 별개다.

## 완료 인수인계

### 변경 파일 / 목적

- `src/engine/travel.ts`: 이번 소유권의 transport logging 함수에서 정확 좌표 제거, TTL 주석의 미검증 약관 단정 교정.
- `src/engine/routeBaselineService.ts`: 성능 cache 입출력 geometry 소유권 분리. 영속 storage·TTL·네트워크 순서는 유지.
- `src/services/kakaoLocationSearchAdapter.ts`: cache 응답 suggestions/노선 label/attempt/진단 객체 복사.
- `src/services/legacyRouteBaselineCleanup.ts`: 정확한 전용 key만 삭제 가능한 미연결 정리 port 및 안전 집계 receipt.
- `test/api-release-safety.test.ts`: 실제 transpile된 legacy transport와 주입 fetch/storage를 실행하는 7개 fixture. 좌표/raw 오류 부재, 취소 provider 0, cache 오염 방지, 재시작 비용 반례, 전용 정리 격리, Edge 실패 폐쇄 검증.
- 이 문서: 호출 graph·보류 결정·UI 소유권·운영 확인 계획 기록.

### 유지 계약

provider/legacy 기능/추천 정책/호출 예산/TTL/실제 geometry 값·순서/public-private scope/Edge server 비영속/활성 코스 복구 계약 불변. 보드·UI·DB migration·env·배포·실제 저장소 수정 없음. baseline memory-only 전환과 purge 앱 연결은 미실행이다.

### 테스트 결과

- failure-first: 첫 4개 fixture 중 **1 통과·3 실패**(실제 legacy 좌표 로그, 검색 cache 오염, baseline geometry 오염). 교정 뒤 통과. purge는 구현 전 모듈 부재 실패를 확인한 뒤 추가했다.
- 집중 최종 명령: `npx tsx --test test/api-release-safety.test.ts test/ui/route-baseline-service.test.ts test/kakao-location-search-adapter.test.ts test/kakao-location-label-adapter.test.ts test/course-v1-route-adapter.test.ts test/api-two-stop-route-budget.test.ts test/private-walk-connector.test.ts test/route-proxy-client-adapter.test.ts test/route-provider-adapter.test.ts` — **75/75 통과**, skip 0. 기존 public/private·cache-only·provider attempt/geometry 회귀 포함.
- `npm run test:typecheck`: 신규 fixture의 readonly array 타입 오류 1건을 수정한 뒤 **통과**.
- `npm run test:ui`: **489 통과·7 실패·기존 skip 1 / 497개**. 실패는 `test/ui/place-course-screen-runtime.test.mjs`의 CourseConfirm/외부 handoff 관련 항목이다. 이 세션 수정 파일이 아니며 API 집중 PASS로 전체 실패를 가리지 않는다.
- `npm test`: top-level **233 통과·11 실패 / 244개**. 사진 미허락 URL fixture 1, loader wrapper 1(하위 실패 포함), UI runtime/preflight 9. `DATA-RELEASE-PERSONALIZATION-01`의 URL 잔존과 CourseConfirm handoff/rollback fixture에서 실패했다. 병렬 편집 시점이 달라 UI 단독 실행과 실패 수가 다르므로 고정 baseline 실패라고 단정하지 않는다.
- UI/집중 명령의 sandbox `tsx` IPC EPERM은 테스트 시작 전 환경 실패였고 동일 명령의 승인된 실행으로 위 실제 결과를 얻었다. 로그: `/private/tmp/timefit-api-release-safety-focused.log`, `/private/tmp/timefit-api-release-safety-ui.log`, `/private/tmp/timefit-api-release-safety-core.log` (로컬 fixture 결과만).
- 운영 API/원격 쓰기/실기기·사용자 저장소 삭제/키 열람 **0회**. 코드·신규 파일 공백 검사 수행.

### 다음 결정·위험

API 소유 국소 보완과 집중 fixture는 완료했지만 **Wave 전체 통과/출시 안전성 완료는 아님**. UI A가 raw Auth 로그와 handoff 실패를, 데이터 writer가 사진 fixture를 교정한 뒤 QA 통합 재실행이 필요하다. baseline 영속 제거는 재시작 조회 증가/보유정책 결정을 통합에 반환한다. 결정 전 현행 persistent 좌표 key·geometry는 남아 있으며, 준비된 purge port도 앱에 연결하지 않는다. 운영 설정·삭제·provider 계약 확인은 별도 승인 단계다.
