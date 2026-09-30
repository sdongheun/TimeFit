# API-TOUR-LIVE-PROGRESSIVE-03 — catalog/detail 점진 조회 계약

2026-09-21. 사용자 승인된 점진 조회 정책을 외부 API 경계에 구현했다. **fixture·typed contract 완료 / 원격 배포·실제 공급자 호출·추천 연결 미실행** 상태다.

## 변경 파일 / 목적

| 파일 | 목적 |
| --- | --- |
| `supabase/functions/tourapi-live/handler.ts` | 단일 18건 요청을 `catalog`와 `detail_batch`로 분리. 서명된 비저장 budget token으로 같은 snapshot의 12→6→최대30 누적 예산 검증 |
| `src/services/tourApiLiveAdapter.ts` | catalog/detail typed port, 응답 fail-closed validator, 명시 catalog retry1회, 같은 snapshot batch 병합 helper. 이전 합성 snapshot 타입은 orchestrator 이행용 type-only 호환 경계로 유지 |
| `test/tourapi-live-progressive.test.ts` | 12 조기 종료, 12+6, 30, 초과 차단, 중복 무과금, partial, catalog 불완전, 좌표 입력 거절, budget 상수·token 변조 fixture |
| `test/tourapi-live-handler.test.ts` | identity conflict, 이메일/anonymous JWT, 안전 provider 오류 계약을 새 catalog 경계로 이관 |
| `test/tourapi-live-adapter.test.ts` | 인증 invoker, 무토큰 차단, catalog/detail validator·병합·retry 이행 계약 |
| `docs/work/external-api/tourapi-live-contract.md` | 이전18/전체10초 방식의 문제·교체·이유·철회 상태와 현행 progressive 계약 기록 |
| 본 문서 | 변경·보존 계약·테스트·orchestrator 위험 인계 |

## 현행 요청·응답 계약

### 1단계 catalog

`{ action: 'catalog', approvedCandidates }`는 부산 전체 `areaBasedList2`를 최대2페이지 완결한 뒤 exact 승인 content ID/type만 교집합한다. 응답은 `liveSourceSnapshotId`, 최신 제목·주소 선택값·좌표·수정일 선택값, `inactive | active_catalog | identity_conflict`, 안전 집계와 budget token이다.

사용자 출발·도착 좌표를 받지 않는다. 신규 미승인 source ID의 제목·좌표·목록을 반환하지 않는다. 동일 content ID/type 변경은 `identity_conflict/partial`이며 상세 대상이 아니다. 목록 불완전·schema 실패는 `unavailable`이고 로컬 주소·좌표를 성공값으로 합성하지 않는다.

### 2단계 detail batch

`{ action: 'detail_batch', liveSourceSnapshotId, budgetToken, candidates }`는 catalog에서 active exact로 서명된 ID만 허용한다. 첫 신규 고유 ID 최대12, 이후 각6, 누적30이다. 요청 내부 중복과 이미 요청한 ID는 provider 호출·예산을 늘리지 않는다. 응답은 같은 snapshot ID, 이번 batch의 운영정보, `active_ready | active_detail_failed`, 누적 budget과 갱신 token이다.

API는 다음 batch를 자동 호출하지 않는다. 추천 orchestrator가 결과 충분성을 판단해 호출을 멈추거나 `nextBatchMax` 이하를 추가 요청한다. 실제 route 검증 후보 최대18과 route attempt 예산은 변경하지 않았다.

budget token은 HMAC-SHA256 서명하며 provider secret에서 domain-separated key material을 메모리에서 파생한다. token에는 snapshot ID, active exact ID, 이미 요청한 ID와 common/image 카운터만 있고 좌표·원문·사용자 ID는 없다. 변조·다른 snapshot token은 provider 호출 전에 거절한다. DB/file/cache/log/trace write는 없다.

## 호출 예산·timeout

- catalog: `areaBasedList2` 최대2페이지, 페이지당 timeout4초.
- detail: 초기12, 후속6, 누적30, 동시성3, 건당 timeout3초.
- 후속 예약 예산: `detailCommon2` 최대4, `detailImage2` 최대1. 현재 endpoint는 열지 않았고 token/상수에서 상한만 보존한다.
- 자동 retry0. 사용자 명시 retry1은 새 catalog/session 시작으로만 제공한다.
- 과거 단일 요청 전체10초는 철회했다. catalog와 각 batch의 건별 timeout은 구현됐지만, 초기12 batch deadline·후속6 batch deadline·추천 세션 누적 deadline은 실제 Edge/TestFlight 지연 측정 전 확정하지 않았다. 임의 deadline으로 정상 batch를 중단하지 않는다.

## 유지한 계약

- `ready/partial/unavailable`, `inactive`, `active_detail_failed`, `identity_conflict` 의미를 보존했다. catalog 성공과 detail 성공은 별도 단계이므로 catalog 활성 상태는 `active_catalog`다.
- exact source ID만 사용한다. 신규 source ID 자동 매칭·승격, AI-Hub 관여, API의 추천 개수·순위·충분성 판단은 없다.
- catalog common facts와 detail 운영정보가 없으면 오래된 로컬 필드로 채우지 않는다.
- 이메일 로그인 JWT와 기존 Supabase anonymous session JWT를 같은 Edge Auth gate로 검증한다. 무토큰 공개 endpoint·anon key 우회는 없다. CAPTCHA/UI/Auth 생성 흐름은 수정하지 않았다.
- route-proxy, 추천 정책, 엔진 연결 로직, UI, DB/migration, 환경변수, secret, release 입력을 변경하지 않았다.
- 원격 배포·실제 TourAPI 호출·commit/push 없음.

## fixture-first 및 테스트

- **RED:** progressive fixture 최초 실행 **1 PASS / 8 FAIL**. 기존 단일 request parser·18 cap·전체10초가 catalog/detail 요청과 누적 예산을 수용하지 못함을 확인했다.
- 구현 후 API+합성 snapshot 집중 실행: **30/30 PASS**, skip0.
- `npm run test:typecheck`: **PASS**.
- `npm test`: **575/575 PASS**, skip0.
- `npm run test:ui`: **823 PASS / FAIL0 / 기존 skip1**, 총824.
- `git diff --check`: **PASS**.
- 원본 영속 write/log/cache/trace: **0**. 좌표 shaped catalog/detail 입력은 provider 호출 전 거절한다.

## orchestrator 인계 / 남은 결정·위험

1. orchestrator는 catalog의 live 좌표만 메모리에서 사용자 수동 좌표와 비교해 queue를 만든다. 사용자 좌표를 detail 요청이나 budget token에 넣지 않는다.
2. 초기12 결과로 충분하면 종료한다. 부족할 때만 6씩 추가하고, API의 `nextBatchMax`를 충분성 신호로 오인하지 않는다. route 후보는 상세 검증 뒤 최대18이다.
3. `mergeTourLiveDetailBatches`는 같은 snapshot ID만 누적한다. 호환 `TourLiveSourceResult` 타입은 기존 엔진 작업트리의 컴파일 이행용이며, 제거된 단일 handler 요청을 복원하는 runtime wrapper가 아니다.
4. 상세 실패 ID를 inactive로 바꾸지 않는다. conflict는 review-required, inactive는 완결 catalog에 content ID 자체가 없을 때만이다.
5. 세션 누적 deadline, token/session 유효기간, app background 뒤 재개/새 catalog 기준은 추천·QA가 실제 지연과 UX를 측정해 결정해야 한다. secret rotation은 기존 token을 의도적으로 무효화한다.
6. `detailCommon2`4·`detailImage2`1을 실제로 열 때 같은 token counter를 사용해야 한다. 현재 호출0을 구현 완료로 확대하지 않는다.

다음 연결 전에도 Edge 배포·개발계정 호출은 별도 수락 범위다.
