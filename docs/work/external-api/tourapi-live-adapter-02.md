# API-TOUR-LIVE-ADAPTER-02 — TourAPI 비저장 실시간 어댑터

> 후속 현행: 2026-09-21 [`API-TOUR-LIVE-PROGRESSIVE-03`](tourapi-live-progressive-03.md)에서 아래 단일 목록+상세18 계약을 catalog + 초기12/후속6/누적30 계약으로 교체했다. 아래 수치와 단일 snapshot 설명은 구현 이력이며 실행 기준이 아니다.

2026-09-21. [`DEC-LIVE-PUBLIC-DATA-01`](../integration-decision/live-public-data-transition-master-plan.md)의 승인된 A2 정책과 [`API-TOUR-LIVE-CONTRACT-01`](tourapi-live-contract.md)을 fixture-first로 구현했다. **로컬 구현·자동 계약 검증 완료 / 원격 배포·개발계정 실제 호출 미실행** 상태다.

## 변경 파일 / 목적

| 파일 | 변경 목적 |
| --- | --- |
| `supabase/functions/tourapi-live/handler.ts` | 인증 뒤 부산 전체 `areaBasedList2`를 최대 2페이지 조회하고 승인된 content ID/type 교집합의 최대 18건에만 `detailIntro2`를 호출하는 비저장 handler. 목록 완결 실패는 `unavailable`, 상세 일부 실패는 해당 후보 제외 + `partial`로 정규화 |
| `supabase/functions/tourapi-live/index.ts` | 기존 Supabase Auth JWT를 `getUser`로 검증하고 Edge secret `TOURAPI_KEY`만 handler에 주입하는 진입점 |
| `src/services/tourApiLiveAdapter.ts` | 앱이 승인 ID/type만 보내고 `ready/partial/unavailable`, 승인 ID별 membership/detail 상태 및 안전 failure enum만 받는 typed port. 자동 재시도0, adapter 인스턴스당 명시 재시도1회 경계 |
| `test/tourapi-live-handler.test.ts` | 성공·빈 목록·schema 오류·timeout·401/403·429·2페이지 cap·부분 상세 실패·동시성·요청 cap·좌표 입력 거절 fixture |
| `test/tourapi-live-adapter.test.ts` | Auth 전달·typed 결과·malformed fail-closed·자동/명시 재시도 계약 |
| `test/tourapi-live-safety.test.mjs` | 영속 write·로그·위치 기반 오퍼레이션·public key read가 없는지 정적 감사 |
| 본 문서 | red-green, 호출/저장 수, downstream 인계와 미검증 경계 기록 |

## 구현 계약과 유지 경계

- Edge 요청은 `{ approvedCandidates: [{ contentId, contentTypeId }] }`만 허용하며 후보마다 그 두 키 외 입력을 거절한다. 앱의 수동 위치, GPS, 사용자 좌표는 Edge/TourAPI에 전달하지 않는다.
- 인증 activation은 새 체계를 만들지 않고 기존 `routeProxyAnonymousAuth` / `routeProxyProductionPorts` / `routeProxyActivatedCourseAdapter`의 세션 우선·CAPTCHA 기반 Supabase anonymous Auth 계약을 재사용해야 한다. 이메일 로그인 세션과 기존 anonymous session은 모두 같은 유효 Supabase user JWT로 Edge `getUser` 검증을 통과한다. 토큰이 없으면 앱에서 Edge 호출 전 `unauthorized`, 직접 요청도 Edge에서 401이며 anon key만으로 공개 호출하지 않는다.
- 목록은 `areaBasedList2`와 부산 법정동 시도 코드 `lDongRegnCd=26`만 사용한다. `locationBasedList2`는 소스와 테스트 경계에서 금지했다.
- 목록은 직렬 최대 2페이지, 페이지당 1,000건이다. 첫 응답 `totalCount>2000`, 두 페이지 미완결, 중간 페이지 오류·timeout·schema 오류는 부분 목록을 성공으로 사용하지 않고 `unavailable`이다.
- 목록 완결 뒤 승인된 ID/type와 교집합하고 입력 순서를 유지해 `detailIntro2` 최대 18건을 동시성3으로 실행한다. 상세 실패 후보만 제외하고 안전 failure와 `partial`을 반환한다. 빈 활성 목록은 장애와 구분한 `ready` 빈 snapshot이다.
- [`DATA-LIVE-MAPPING-CONTRACT-02`](../data-curation/live-source-mapping-contract.md) 인계에 따라 snapshot의 `candidateStates`는 요청에 포함된 승인 ID/type 각각을 `inactive | active_ready | active_detail_failed | identity_conflict`로 보존한다. `inactive`는 동일 content ID 자체가 완결 목록에 없을 때만 사용하며, 상세 timeout/오류는 `active_detail_failed`이므로 삭제·비공개로 오인할 수 없다.
- 같은 승인 content ID가 목록에 있지만 content type이 달라졌으면 `identity_conflict`다. 목록은 완결됐으므로 전체 결과는 `partial`이지만 해당 ID의 `detailIntro2`는 호출하지 않고 `places`에서도 제외한다. 변경된 유형·제목·좌표를 반환하거나 category/AI-Hub 매칭으로 자동 승격하지 않는다. API는 로컬 별칭·거리·복합 이상 판정을 구현하지 않는다.
- 클라이언트는 요청하지 않은 ID, 중복/누락 상태, `active_ready`와 `places`가 불일치하는 응답, 실패/충돌 상태 없는 `partial`, 충돌을 `ready`로 표시한 응답을 `invalid_response`로 거절한다. 미승인 신규 ID 목록은 반환하지 않고 `unreviewedCount` 안전 집계만 유지한다.
- timeout은 목록 4초/페이지, 상세 3초/건, 전체 10초다. 총 신규 공급자 상한은 목록2+상세18=`20`이며 자동 재시도0, 사용자 명시 재시도1회다.
- 원본 body, provider message/error, 키, 전체 query URL, 좌표, 사용자 ID를 DB·파일·cache·로그·trace에 쓰는 코드가 없다. DB/RPC/storage/cache/console write는 0이다. 정규화된 장소 좌표는 응답 snapshot에만 존재하며 이 작업은 그 snapshot을 영속화하거나 화면에 연결하지 않는다.
- 추천 순위·체류시간·운영 가능 판정·신규 content ID 승격을 구현하지 않았다. route-proxy, 추천 엔진, DB migration, UI를 변경하지 않았다.
- 기존 `src/engine/tourapi.ts` 직접 경로, `EXPO_PUBLIC_TOURAPI_KEY`, release build 입력은 서버 운영 검증 전 제거하지 않았다. public 추천 흐름에도 새 adapter를 연결하지 않았다.

## red-green 및 테스트 결과

- **RED**: 구현 파일을 만들기 전 집중 실행은 모듈/파일 부재로 **0 PASS / 3 FAIL**이었다.
- 1차 구현 뒤 **9 PASS / 2 FAIL**: 숫자 ID fixture 오류1건과 `Array.from`을 DB `.from`으로 오인한 안전성 정규식1건을 교정했다. 제품 계약 완화나 skip 추가는 없었다.
- 최종 TourAPI 집중 계약: **19/19 PASS**, skip0. 기존 17건과 동일 content ID/type 변경→`identity_conflict/partial`·상세 호출0·변경 필드/분류 노출0, 클라이언트의 conflict-ready 거절 fixture를 포함한다.
- `npm run test:typecheck`: **PASS**.
- `npm test`: **575/575 PASS**, skip0.
- `npm run test:ui`: **823 PASS / FAIL0 / 기존 skip1**, 총824.
- `git diff --check`: **PASS**.

fixture는 실제 provider·운영 DB를 호출하지 않는다. 안전성 감사에서 persistent write는 **0**, 로그·trace 출력도 **0**이다.

## 실제 호출 / 배포 상태

- 실제 TourAPI 공급자 호출: **0회**.
- Supabase Edge 배포·secret 변경·운영 설정 변경: **0회**.
- 테스트 통과 뒤 Supabase CLI로 기존 함수/secret 이름만 읽으려 했으나 응답 없이 대기해 중단했다. secret 값을 로컬 `.env`에서 읽어 우회 호출하지 않았다.
- 따라서 “개발계정 최소 실제 호출1회”는 구현 실패가 아니라 원격 Edge 배포·`TOURAPI_KEY` 존재 확인 뒤 수행할 운영 검증 차단점으로 남는다. 다음 단계도 공급자 호출을 최대1회로 제한하고 원문·키·URL·좌표를 출력하거나 저장하지 않아야 한다.

## 엔진 handoff / 다음 결정·위험

- 엔진 입력 port는 `TourLiveSourceResult`다. `ready`는 완결 목록+모든 활성 승인 대상의 필수 상세 성공, `partial`은 완결 목록+실패 상세 후보 제외, `unavailable`은 활성 목록을 신뢰할 수 없는 상태다.
- snapshot은 `snapshotId`, `fetchedAt`, 입력 순서의 정규화 `places`, 승인 ID별 `candidateStates`, 안전 집계 `unreviewedCount`를 제공한다. 결합층은 `inactive`만 비활성 근거로 사용하고 `active_detail_failed`는 상세 검증 실패, `identity_conflict`는 review-required 세션 제외로 유지해야 한다. type 변화로 로컬 category/subCategory·체류·AI-Hub 근거를 바꾸지 않는다. 제목+좌표 복합 이상·별칭·거리 판정은 API가 아닌 데이터/결합층 입력이다.
- public 추천 연결, 세션 수명 snapshot 고정, 운영시간 parser/정책 반영은 추천 엔진 작업이다. API 담당은 그 경로를 임의 연결하지 않았다.
- 실제 activation 담당은 기존 session을 먼저 사용하고, session이 없을 때만 기존 환경 gate와 CAPTCHA를 거친 `signInAnonymously` 결과의 access token을 이 adapter에 주입해야 한다. 이번 작업은 추천 UI·CAPTCHA UI·anonymous signup 흐름을 변경하지 않았다.
- 새 handler는 인증 확인 외 사용자 레코드·JWT를 저장하지 않고 TourAPI snapshot도 비저장이므로, 기존 anonymous Auth 재사용 자체로 현재 고지/30일 inactivity 정리 정책과 다른 데이터 보유는 추가되지 않는다. 다만 이는 코드 경계 감사이며 운영 anonymous Auth enablement나 cleanup 실행 상태의 증거는 아니다.
- 원격 수락 순서는 Edge secret 이름 확인 → 함수 배포 → 개발계정 공개 고정 fixture로 공급자 호출 정확히1회 → 안전 집계 확인이다. 이를 통과하기 전 public key/legacy 직접 경로를 제거하거나 운영 완료로 표시하지 않는다.
- public 추천 연결 전 운영 환경 gate에서 anonymous Auth 활성 상태, CAPTCHA 설정, signup/rate limit, 기존 anonymous cleanup 경로를 실제 환경 기준으로 확인해야 한다. 개발 로컬 config만으로 운영 상태를 추정하지 않는다. 이 gate가 충족되지 않으면 비로그인 추천을 이메일 로그인으로 축소하거나 무인증 endpoint로 우회하지 않고 activation blocker로 보고한다.
- `areaBasedList2`의 법정동 시도 필터와 개발계정 승인 오퍼레이션이 실제 계정에서 수락되는지는 아직 미확인이다. 401/403/429/page cap은 이미 typed fail-closed fixture로 고정했다.

commit/push는 수행하지 않았다.
