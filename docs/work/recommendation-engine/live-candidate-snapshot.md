# 2-LIVE-CANDIDATE-SNAPSHOT-01 — 순수 TourAPI 후보 snapshot 결합

2026-09-21. 부모: [DEC-LIVE-PUBLIC-DATA-01 §3.3/단계B](../integration-decision/live-public-data-transition-master-plan.md).
상태: **순수 결합 구현·자동 검증 완료 / public 추천 미연결 / 운영 전환 미완료**.
시작 HEAD: `96c55128cd0e6140c345e06a8e034799791e58e2`. 커밋하지 않았다.

## 변경 파일 / 목적

- `src/engine/liveCandidateSnapshot.ts`: 로컬 정책 projection과 실제 API `TourLiveSourceResult`의 순수 결합. type-only import이며 HTTP·clock·DB·카탈로그 import 없음. 공개 index·types 단일 작성자 파일을 수정하지 않고 해당 모듈 직접 import로만 제공한다.
- `test/live-candidate-snapshot.test.ts`: 11개 순수 fixture. 변경·비활성·상세 실패·유형 충돌·단독/복합 변화·신규 ID·AI-Hub 격리·전체 장애·순서·동결·1km 경계·중복·빈 결과 검증.
- 본 문서: 공개 계약, 실패 증거, 다음 담당 인계. UI/App/src/data/API/DB/중앙 문서/보드 수정0.

이전 방식 → 저장 원천 사실과 앱 정책만으로 후보 제공 → 실시간 수정/삭제가 고정 번들과 불일치 가능 → exact source mapping으로 세션 사실만 overlay하는 별도 순수 계층 → 앱 정책 유지와 최신 사실 분리를 위해 구현 → **현행 순수 모듈, 운영 연결 전**.

## 공개 순수 계약

`buildLiveCandidateSnapshot(local: readonly LocalLivePlaceProjection[], source: TourLiveSourceResult): LiveCandidateSnapshot`

- local: 내부 `id`, 안정적인 `order`, 검토된 exact `mapping.tourapiContentId/contentTypeId`, 기존 source `facts`, 검토 aliases, category/subCategory/classification/min/recommended/max 정책, 동일 단지 관계, 검토 사진 권리 projection. AI-Hub 장소명/좌표/장소별 dwell 입력 필드는 없다.
- output: `status`, 원천 `snapshotId/fetchedAt` 또는 unavailable의 null, 성공 `candidates`, 내부 placeId+enum의 `diagnostics`. source raw failure·원본 응답·알 수 없는 추가 필드를 복사하지 않는다.
- `active_ready` (R1 현행): 제공된 title/address/lat/lon/modifiedAt/opening 필드만 포함한다. optional 누락은 output에서 absent이며 로컬 source 값으로 보충하지 않는다. provenance는 실제 포함한 필드의 `tourapi_live`만 허용한다. 명시 빈 문자열은 원천 제공값으로 보존한다. local facts는 title/aliases/lat/lon 동일성 비교에만 사용한다.
- `inactive`: 완결 membership에 해당 상태가 명시된 경우만 제외. 상태 누락은 `not_in_snapshot`이며 삭제라고 주장하지 않는다. 요청 범위 밖/미연결은 `out_of_scope`, 신규 provider ID는 무시하고 자동 mapping하지 않는다.
- `active_detail_failed → detail_failed`; `identity_conflict → review_required`. 유형 변경은 별도 `content_type_changed`, 미등록 제목+1km 이상은 `compound_identity_change`. 모호한 중복 mapping은 `ambiguous_mapping`, 무효 source 좌표/중복 ready place는 `invalid_source`로 제외한다.
- source unavailable은 stale 후보0. 정상 inactive-only는 ready+빈 candidates다. 원천 partial 또는 결합 검증 실패는 partial이며 단순 비활성/대상 범위 제외와 구분한다.
- `order` 오름차순, 동률 내부 ID의 코드 단위 순서로 정렬한다. caller의 배열/API 배열 순서로 우선순위를 만들지 않는다. 결과는 복사 후 깊게 동결하여 입력 변경과 consumer mutation의 영향을 차단한다.
- 같은 snapshotId **및 같은 입력 내용**은 같은 결과다. 이 순수 함수는 ID별 전역 registry/cache를 갖지 않으므로 같은 ID에 다른 payload를 공급하는 caller를 감지·보관하지 않는다. 세션 담당이 한번 확정한 snapshot을 유지하고 새 응답을 덮어쓰지 않아야 한다.
- `sourceDistanceMeters`는 반경6,371,000m haversine이다. 무효 좌표는 NaN. 1km의 포함 경계를 안정화하기 위해 계산값의 마이크로미터 미만 부동소수점 오차만 반올림한다. routing 거리나 사용자 위치 계산이 아니다.

### 운영시간의 중요한 경계

`openingVerification: required`는 모든 성공 source 후보에 붙는다. 이 계층의 ready는 **원천 결합 준비 완료**이지 실제 운영/휴무/행사/경로 검증 완료가 아니다. live opening raw를 기존 structured availability에 덮어씌우거나 누락을 상시 운영으로 합성하지 않는다. R1에서 로컬 opening 보충을 제거했고 live opening 항목이 없으면 `{}`를 반환한다. 누락/빈 운영정보는 후속 parser가 fail-closed로 처리해야 한다. CourseV1Candidate provider를 반환하지 않으므로 실수로 현재 public provider에 바로 연결하지 않는다.

## RED → GREEN / 테스트 결과

1. 구현 파일 전에 fixture 작성: 모듈 부재로 파일1 FAIL, PASS0.
2. 기본7개 GREEN 후 999/1000/1001m 반례 추가. 수학적으로1000m인 입력이999.9999999999999m로 계산되어 미등록 제목 복합 이상을 허용: 9 PASS/1 FAIL. 마이크로미터 이하 오차 정규화 후 GREEN.
3. 최종 집중: `node --import tsx --test test/live-candidate-snapshot.test.ts test/dwell-personalization.test.ts test/dwell-personalization-course.test.ts test/release-three-hour-engine.test.ts test/release-two-stop-selection.test.ts test/tourapi-live-adapter.test.ts` → **74/74 PASS**, skip0. 신규11개 포함.
4. `npm run test:typecheck` → PASS.
5. `npm run test:ui` → 총824, **823 PASS / FAIL0 / skip1**.
6. `npm test` → **575/575 PASS**, skip0. 이 명령과 신규 TS 집중 실행은 별도이며 위 숫자에 신규11개가 포함된 것으로 부풀리지 않는다.
7. `git diff --check` → PASS.

실제 외부 API·DB·Simulator·운영 설정 변경·stage/commit/push0. 승인 요청/생략 항목 없음. 공유 작업 트리 결과이며 최종 고정 revision 출시 QA와 구분한다.

## 보존 계약

- min20/recommended30/max60, 문화시설 max120을 그대로 복사한다. 원천 유형·제목·좌표·AI-Hub 추가 필드가 이 값을 바꾸지 않는다. 잘못된 local 정책을 이 계층에서 기본값으로 수선하지 않는다.
- category+subCategory 개인화 경계·실제 체류 표본·개인화 알고리즘 변경0. 기존 one-stop/pair fail-safe 회귀 재사용.
- 내부 ID·분류(hold 포함)·관계·사진 권리 projection 유지. 사진 URL을 새 live 값으로 교체하거나 권리를 추정하지 않는다.
- 최대180분·최대2곳·도착 여유·route attempt ledger 변경0. 후보 조립/경로 호출 entry 연결0.
- 데이터 문서 §4의100m/미등록 제목 단독 차단·250m 제안은 최신 마스터 §3.3과 이번 사용자 명령으로 대체된 이력이다. API의 실제 identity_conflict 타입을 확인하고 사용했으며 추측 타입이나 API 파일 수정 없음.

## 데이터·API·UI 다음 인계 / 미완료

- 데이터: 실제 카탈로그 전체를 투입하는 구현은 하지 않았다. LocalLivePlaceProjection에 정확 mapping·기존 TourAPI source facts·검토 별칭·명시 order·앱 정책/관계/사진 권리를 투영하는 경계를 제공해야 한다. AI-Hub identity/dwell을 facts/policy로 새로 끌어오지 않는다. 데이터 문서의 철회 제안/fixture는 최신 승인과 정합성 정리가 필요하다.
- API: identity_conflict 타입 연결 성공. source snapshot ID는 opaque ID, fetchedAt은 원천 조회 시각으로 주입하는 책임을 유지한다. 세션 ID/metadata·정규화 텍스트에 사용자 좌표/ID/키/원문 오류를 넣지 않는 upstream 계약이 전제다. 엔진은 허용 필드만 복사하나 문자열 안의 민감정보를 탐지하는 DLP는 아니다.
- 엔진 후속/통합: raw opening/휴무/행사→structured availability의 정확한 최신성·실패 계약 및 부산 source와의 필드 충돌 규칙이 아직 필요하다. 이 모듈만으로 마스터 단계B의 운영시간 gate·전체 카탈로그 동등성·실제 추천 통합 완료를 체크하면 안 된다.
- UI: ready-empty/partial/unavailable와 diagnostics를 소비할 수 있지만 이번 작업에서는 연결하지 않는다. session snapshot 고정·취소·새 세션·날짜·출처 표시 수명은 UI/준비 계층 책임이다.
- 운영: 대표191개를 TourAPI-only로 축소하지 않는다. TourAPI+부산 live를 함께 검증한 뒤 최종 운영 전환. 원격 배포/실제 호출/기존 원천 제거는 승인된 별도 단계다.

## 2026-09-21 R1 — stale optional 사실 보충 제거

이전 방식: live optional 누락에 로컬 값과 local_snapshot provenance를 보충 → 통합 관찰: provenance로 구분하더라도 stale 사실을 성공 후보에 포함하므로 최종 비저장 전환 취지와 충돌 → live 응답에 있는 필드만 output에 포함 → 오래된 운영/주소/수정 사실의 조용한 복원을 방지 → **로컬 보충 방식 철회, live-only 현행**. 앞선 테스트 수치는 최초 구현 이력이다.

- 변경 파일: `src/engine/liveCandidateSnapshot.ts`의 optional address/modifiedAt/opening 결합과 provenance 타입만 보완, `test/live-candidate-snapshot.test.ts`의 누락/빈 값 반례, 본 문서 갱신.
- 유지 계약: local title/aliases/좌표 동일성 기준, live 필수 title/좌표, 정책·체류·개인화·분류·관계·사진 권리, `openingVerification: required`, deterministic freeze, public 미연결 모두 유지.
- RED: 보완 fixture를 먼저 실행해 12건 중10 PASS/2 FAIL. live에 없는 기존 휴무·주소가 반환되어 undefined/absent 기대 실패.
- GREEN: 보충 제거 후 집중75/75 PASS(신규 파일12건 포함), skip0. 주소·수정일은 Object.hasOwn=false, 운영시간/휴무/행사 누락은 opening 빈 객체, provenance에도 누락 필드 없음. 명시 빈 문자열은 그대로이며 required 유지.
- 최종 회귀: `npm run test:typecheck` PASS; `npm run test:ui` 총824 중823 PASS/FAIL0/기존 skip1; `npm test` 575/575 PASS; `git diff --check` PASS. 권한 승인 대기·검증 생략 없음.
- 다음 인계: 후속 parser/UI는 누락 필드를 번들에서 다시 채우지 않고 미확인 상태로 처리해야 한다. 운영시간 parser·부산 live·public 연결은 여전히 후속 범위다. 외부 호출·운영 변경·commit/push0.
