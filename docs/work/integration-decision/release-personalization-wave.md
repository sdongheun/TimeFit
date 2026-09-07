# 출시 개인화·안전성 작업 Wave — 2026-09-07

## 현재 서버 보존 점검 — C 사전 점검 후 사용자 승인

사용자 결정: 실제 사용자는 없지만 현재 Supabase는 보존 대상이다. 승인 범위는 현재 서버 읽기 전용 점검이며 migration/테스트 계정 생성/업무 데이터 쓰기·삭제는 승인하지 않았다.

통합 직접 확인(2026-09-07): 앱 Supabase URL·CLI linked project·DATABASE_URL 대상 일치(true, 값/자격증명 기록0). `npx supabase@latest migration list --linked`에서 001~014 local/remote 일치, `202609070015`/`202609070016` remote 없음. 기존 설치 CLI는 config 최신 키를 해석하지 못해 최신 CLI로 조회했고 config는 수정하지 않았다.

psql 세션의 `default_transaction_read_only=on`, statement timeout 10초에서 pg_tables/pg_proc/pg_namespace 메타데이터 SELECT로 실제 객체도 확인했다. public 테이블은 기존12개이고 전부 RLS enabled=true. dwell 관련 테이블/함수, 새 account 완료 저장 함수는 없음(관련 함수 검색은 기존 purge_account_data만 반환). 따라서 단순 migration 이력 누락으로만 판단하지 않고 **개인화·계정 기록의 015/016 서버 구성 미반영을 확인**했다. 기존 RLS enabled 확인은 정책 내용/격리 기능 전부 통과를 뜻하지 않는다.

변경: 본 통합 기록만 추가. 제품 코드/schema/migration 적용/업무 데이터 조회·쓰기·삭제·테스트 계정 생성0. 자격증명 출력0, 부수효과 있는 consent/sample RPC 호출0. 실행은 migration list·대상 일치 검사·서버 카탈로그 SELECT이며 신규 단위 테스트는 실행하지 않았다. 최초 sandbox 호스트 해석 실패 뒤 승인된 네트워크에서 재확인했다.

다음: DB 담당이 015/016의 기존 데이터·정책·trigger 영향, 백업/복구 가능 여부, 적용 전 검사·적용 순서·실패 대응을 먼저 제시한다. 015는 기존 정책/함수도 변경하므로 단순 신규 표본 테이블 추가로 간주하지 않는다. **사용자의 별도 migration 적용 승인 전 현재 서버 변경 금지.** 이후 승인된 전용 테스트 계정/최소 데이터로 C 저장→조회→추천 반영 검증. A 자동 통과와 사용자 실기기 확인은 유지하되 실제 서버 학습 완료로 승격하지 않는다.

## 최신 실행 — UI 학습 연결 검토 완료·QA 시작

U-LIVE-LEARNING-EVIDENCE-01 인계/실제 코드 대조 완료. 통합 직접 재실행: 집중71/71, UI549 PASS·기존skip1·FAIL0, core270/270, typecheck/diff PASS. 기존 await starts 완료 대기와 구형 진단 실패는 해소됐다. unsigned Release 성공 로그 확인은 실기기 수락이 아니다.

현재 [QA-LIVE-LEARNING-EVIDENCE-01](../qa-release/live-learning-evidence-validation.md) A 자동 게이트 실행 승인. 이후 B 새 internal build 최소 실기기 → C 준비된 별도 환경의 실제 서버 반영 확인. 아래 UI 구현/DB 대기는 과거 이력이다. 전체 개인화·출시 수락은 별도이며 미확인 서버/실기기 항목은 유지한다.

## 최신 수락 — DB-LIVE-LEARNING-EVIDENCE-01

2026-09-07 통합 검토: 실제 DTO·서비스 publication/consume·production exports와 6절 인수인계를 대조하여 **DB 로컬 학습 증거 계약을 수락**한다. 통합 직접 재실행: 집중96/96 PASS, typecheck PASS. UI lifecycle은 4 PASS/1 FAIL이며 기존 잠금 결함을 기대한 diagnostic이다. 전체 core267/UI520 PASS·1 FAIL·1 skip은 DB 보고값으로 통합 재실행값이 아니다.

다음은 [U-LIVE-LEARNING-EVIDENCE-01](../uiux/live-learning-evidence-integration.md) **지금 실행**. UI 완료 앞 await starts/cold proof 잔여 연결과 앱/native 증거 연결을 같은 UI writer가 순서대로 수행한다. 아래 DB 실행/계약 대기는 과거 이력이며 해제됐다. 서비스 수락은 Swift/실기기/앱 학습/출시 수락이 아니다. cross-process publication·최초 이벤트 durable 저장·실기기 잠금 접근과 전체 저장 장애는 UI/QA 잔여 게이트다.

현재 첫 작업 명령: **DB-LIVE-LEARNING-EVIDENCE-01 지금 실행**. DB의 live-learning-evidence-contract.md를 따른다. 증거 공개 계약+서비스 구현/fixture까지 같은 DB writer가 수행하고 통합 확인 후 UI/native 연결로 인계한다. 기존 UI B 잠금/cold 소비 보완은 소유 파일이 달라 병렬 가능하나 새로운 증거 DTO를 추정 구현하지 않는다. 원격/출시 승인 아님.

최신 사용자 확정: DEC-LIVE-LEARNING-EVIDENCE-01. 로컬 참조 기반 회원 app/native 학습·최소 표본 안전 저장 후 활성 증거 정리·일반 알림 학습 제외 유지 승인. 조사 결정 질문은 해소됐다. DB 증거 공개 계약→UI/native 연결→QA 순서이며 기존 DB 잔여 UI 연결은 별도로 진행 가능하다. 구체 구현 명령/계약 인계 전 기능 완료나 원격 승인으로 해석하지 않는다.

## 최신 통합 검토 — 공유 잠금/cold 조회 수락·학습 조사 반환

DB 두 보완의 **서비스 계약을 수락**한다. 통합이 코드와 production aliases를 대조하고 집중54/54·typecheck PASS를 재실행했다. UI lifecycle은 4 PASS/1 FAIL이며 실패는 기존 결함을 기대한 진단에서 local 완료가 이제 먼저 성공하여 발생했다. 테스트 삭제나 전체 PASS로 은폐하지 않고 UI가 성공 기대와 새 계약으로 전환해야 한다.

UI B 잔여 연결은 지금 실행 가능: 완료 앞 `await starts` 제거, 동일 active의 명시 완료에만 `preserveUnverifiedOwnedCourseRun`→실제 complete 성공→exact cleanup→별도 sync, cold readonly/proof 소비 및 계정/active 변경 검증. 이 서비스 수락은 UI 전체·원격·실기기/출시 수락이 아니다. 자체 탈퇴 후 Auth 이벤트가 먼저 발생하면 proof가 무효인 제한도 유지·검증한다.

Live Activity 학습 조사는 완료 인수했으며 **구현안 승인 전**이다. 로컬 불투명 참조+확인 순간 receipt+제출 직전 서버 거절 게이트가 권장안이다. 새 보유기간은 임의로 정하지 않고 기존 active 종료 경계 정리 방안을 우선 검토한다. 일반 알림 액션의 당시 증거 부재와 Live Activity 버튼은 구분한다. 증거 수준·정리 범위·일반 알림 학습 제외 유지에 대한 확인 뒤 상세 구현 명령을 확정한다. 현재 동의로 과거 receipt를 승격하거나 도착 재탭을 요구하지 않는다.

최신 B 연결 검토: **DB 공유 잠금·cold readonly 두 보완 구현 ∥ UIUX Live Activity 학습 증거 조사**를 진행한다. 각 역할 README 최신 명령을 따른다. 이전 세 보완 수락은 철회하지 않으나 B 전체는 아직 수락 전이다. DB 인계→UI 잔여 연결, 별도 증거 계약 확인→native 학습 구현, 둘을 통합한 뒤 QA로 진행한다. 병렬 조사는 native 학습 구현의 자동 승인이 아니다.

상태: **DB 세 보완 통합 수락·UIUX B 실행 가능·QA 대기**. 기준은 DEC-RELEASE-PERSONALIZATION-01과 DEC-GUEST-MEMBER-BENEFIT-01. 아래 과거 단계 상태는 이력이며 최신 수락이 우선한다.

## DB 세 보완 통합 수락 — 2026-09-07

대화에서 수락했으나 문서 갱신이 누락되어 UI 세션이 승인 대기로 멈춘 사실을 확인했다. 이번 기록으로 그 선행 조건을 해제한다. 새로운 제품 정책 변경이 아니라 이미 검토한 구현의 수락 기록이다.

- 범위: 완료 응답과 원격 sync 분리, 7일/32건 제거 표본 재등록 차단, 실제 Supabase 인증 조회 오류와 정상 무세션 구분을 **수락**한다. DB 활성 문서의 “최우선 보완 완료 인수인계”가 현재 공개 계약이다.
- 근거: 통합 세션이 실제 코드·production export·경계 fixture를 대조하고 집중 테스트 **36/36 PASS**, `npm run test:typecheck`와 `git diff --check` PASS를 직접 확인했다. 전체 core/UI 결과는 DB 인수인계의 보고값이며 통합이 이번에 재실행한 것으로 표기하지 않는다.
- 실행 승인: **U-RELEASE-PERSONALIZATION-01 B의 남은 연결을 지금 진행**한다. local 완료 성공 → 화면/진행/Live Activity cleanup → 별도 `retryOwnedCourseRunSync`; 재시작은 `readPendingOwnedCourseRunSyncs`를 소비한다. DB 완료를 UI 구현 완료로 오인하지 않는다.
- 유지 경계: 원격 migration/Edge 배포·운영 데이터 변경·실기기/최종 QA·출시 승인은 포함하지 않는다. 공개 약관 registry와 삭제 결과 unknown 등 별도 게이트를 유지한다.
- 인수인계: 변경 파일은 Wave·보드·DB/UI 활성 문서와 역할 README이며 목적은 승인 상태 동기화다. 제품 코드·스키마·추천 정책은 변경하지 않는다. 다음 담당은 UIUX B, 이후 통합 검토→QA다.

## 순서와 병렬 경계

최신 통합 검토(2026-09-07): DB 기기 소유권 구현·집중30/30·typecheck 확인. 그러나 local 완료의 remote 대기, 7일 만료 표본 재등록, 실제 세션 조회 오류의 guest 판정이 발견되어 **DB 최우선 세 항목 보완 → 통합 수락 → UI B → QA**로 진행한다. 이전 기능은 유지하며 상세는 DB 활성 문서 맨 위 최신 절을 따른다.

최신 후속(2026-09-07 UI B 부분 인계 뒤): **DB 기기 소유권·eligibility 복원·완료 적재 composition 보완 → UI 기존 B 나머지 연결 → QA**. 기존 DB 로컬 검증만으로 consumer 준비가 끝났다는 판단은 철회한다. 서버 repository는 있으나 기기 owner 없는 단일 목록/신규 sample writer 미연결이 확인되어 보완한다. 상세 명령은 각 DB/UI 활성 문서 맨 위 최신 절이며, 새 작업 ID로 중복 구현하지 않는다.

2026-09-07 후속: 1차 병렬 작업을 검토했고 현재 통합 재실행은 typecheck PASS·UI504 PASS/기존skip1·core251 PASS다. DB는 A만 완료, UI는 A 자동 검증 완료(B 미착수), API persistent baseline 결정은 잔여다. 사용자 lifecycle1~6와 선택 닉네임/탈퇴10분 재인증을 승인했다. **지금 DB-RELEASE-IDENTITY-01의 B 실행 승인 절과 DATA-RELEASE-PERSONALIZATION-01 세부분류 후속을 병렬 진행**한다. API baseline은 승인 없이 제거하지 않는다. UI B/QA 최종은 아래 선행 조건대로 대기한다.

| 단계 | 역할/작업 | 시작 조건 | 산출물 |
| --- | --- | --- | --- |
| 1 | DB: DB-RELEASE-IDENTITY-01 A | 지금 | 계정·동의·기록·표본의 단일 공개 계약, 미결정 목록 |
| 1 | UIUX: U-RELEASE-PERSONALIZATION-01 A | 지금, DB와 병렬 | Live Activity 실패 복구 수정; 개인화 consumer 구현은 대기 |
| 1 | API: API-RELEASE-SAFETY-01 | 지금, 위와 병렬 | 안전 로그·캐시 경계 수정, 출시 도달성/운영 확인 인계 |
| 1 | 데이터: DATA-RELEASE-PERSONALIZATION-01 | 지금, 위와 병렬 | 사진 허락 검증/안전 투영, 실제 category/subCategory 전달 |
| 1 | 엔진: 2-AB 현행 연결 검증 | 지금, 순수 fixture만 | 기존 구현 재사용 검증 및 정확한 공개 계약 |
| 2 | DB: DB-RELEASE-IDENTITY-01 B → DB-DWELL-01 | A 계약 통합 수락, 미결정 범위 승인 | 계정·기록 격리/삭제 → 체류 동의·표본 저장 |
| 3 | UIUX: U-RELEASE-PERSONALIZATION-01 B | DB/엔진/데이터 공개 계약 확정·필수 검증 통과 | 계정별 이력/가져오기/표본 전송/추천 snapshot/UI 혜택 연결 |
| 4 | QA: QA-RELEASE-PERSONALIZATION-01 | 위 구현 인계 완료 | 전체 fixture, 제한 실기기와 원격 필요 게이트 |
| 5 | 통합·출시 | 사실표 갱신·필수 게이트 통과 | 정책 문서·App Privacy·최종 Release·제출 승인 요청 |

병렬은 별도 세션의 파일 소유권 분리를 뜻한다. UIUX A/B는 같은 세션에서 순차, DB B/DB-DWELL도 같은 DB writer가 순차로 작업한다. 슬롯이 부족하면 DB/UI/API를 먼저 시작하고 여유에 데이터/엔진을 배치한다. 전체 테스트와 native build는 작업 중 공유 worktree 경쟁을 피해서 조정한다.

## 공통 실행 규칙

1. AGENTS.md, docs/README.md, 자기 역할 README, 이 Wave와 해당 활성 명령만 우선 읽는다. 과거 archive 전수 조회 금지.
2. 동일 목적 기존 작업은 재사용한다. 특히 2-AB는 순수 계산 구현 완료다. DB-DWELL-01은 미구현이며 새 이름으로 중복 schema를 만들지 않는다.
3. 코드 변경 전에 실제 공개 entry를 실행하는 실패 fixture부터 작성한다. 문자열 검색 테스트만으로 수락하지 않는다.
4. 코드 변경 후 npm run test:typecheck, npm run test:ui, npm test 및 집중 테스트, git diff --check. native/UI 의존 변경은 적절한 iOS bundle/unsigned build 검증 추가. 기존 skip/실패와 새 실패를 구분하고 테스트 수는 실행값을 기록한다.
5. 운영 API 반복 호출, 실제 사용자 데이터 조회, 키 출력, 원격 migration/배포/삭제, commit/push는 하지 않는다. disposable local DB 테스트만 허용하고 자체 생성 데이터는 정리한다. 원격 검증은 별도 승인.
6. 미확정 닉네임 정책·공개 문서 URL/버전·서버 표본 보유기간·레거시 소유권 처리·오프라인 보유기간을 임의 확정하지 않는다. DB A가 구체적 대안/권장값/영향을 통합에 조기 반환한다. 그 결정이 필요한 부분만 대기하고 독립 안전성 수정은 계속한다.
7. 추천 최대 120분/1~2곳/최적 순서/경로 호출 예산, GPS 자동 감지와 원격 push 제외를 유지한다. 로그인 전용 Live Activity로 변경하지 않는다.
8. 완료 인계: 변경 파일/목적, 유지한 계약, 실행 테스트/실패/증거, 다음 역할의 entry·타입·미결정·위험. 중앙 기준/보드는 통합만 갱신한다.

## 계약 수락 게이트

DB A는 함수 이름·소유 파일·입출력·오류·identity/consent version·idempotency key·시간순 표본 순서를 먼저 확정 가능한 형태로 제출한다. UI가 이름을 추측해 선구현하지 않는다. DB의 통계용 파생 프로필과 엔진의 장소별 ±10/min/max 적용을 이중 구현하지 않는다. 실제 계산은 기존 엔진 계약을 재사용하며 서버는 적격 표본과 집계/버전을 제공한다.

이 Wave는 기능축소가 아니라 출시 범위 확대다. 기존 출시 날짜 목표는 남지만 소요 기간이나 심사 성공을 보장하지 않으며 보안·동의·삭제 게이트를 생략하지 않는다.
