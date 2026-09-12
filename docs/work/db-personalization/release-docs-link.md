# DB-RELEASE-DOCS-LINK-01 — RELEASE-LINKS-01 DB 연결

2026-09-09. **사용자 승인 후 운영 연결·사후 검증 완료. 정확한2행 transaction1회 적용.** [기존 명령](../integration-decision/release-stage-two.md)의 RELEASE-LINKS-01과 [게시 완료 인계](../../05_release/release-document-session.md) 재사용. 새 정책·schema 작업이 아니다. 아래1~4절의 승인 대기·미실행 표현은 사전 점검 당시 이력이며 현행은5절이다.

## 1. 읽기 전용 사전 결과

확인시각 `2026-09-09T12:27:14.985Z` (21:27:14 KST). linked project `hwfsslihmmendxigklrx`, `ap-northeast-2`, `ACTIVE_HEALTHY` 일치.

- `signup_consent_documents`: **전체0행**. 기존 ID/version/URL/active/approved_at 없음. 동일 version 충돌 없음.
- `account_consent_records`: document_id/version별 count 집계 **0그룹**, 과거 연결 동의0건. Auth 계정·이메일·사용자ID·토큰·기록 본문은 조회/출력하지 않음. 계정이 없다는 뜻이 아님.
- RPC `get_signup_consent_documents` ACL: postgres/anon/authenticated/service_role EXECUTE 유지. 관리 API `read_only:true` 역할로 RPC까지 실행한 최초 조회는 `42501 permission denied for function get_signup_consent_documents`로 실패했다. 오류 분류를 좁히는 과정의 읽기 요청4회 실패 뒤 RPC 호출을 분리한 SELECT 성공. 실패 결과를 registry 빈 상태로 취급하지 않았으며 권한 완화0. 공개 anon 경로의 실제 RPC 결과는 적용 후 별도 확인한다.
- 공개 문서2개 인증 없는 GET 각1회 성공, canonical URL HTTP200 및 로컬 게시 HTML/hash 일치. 웹 조회 도구는 안전성 오류로 내용을 얻지 못해 로컬 HTTP 클라이언트로 확인했다.

| ID/version | URL | 확인 SHA256 |
| --- | --- | --- |
| privacy-policy / 1.0 | https://jjaturi-docs.pages.dev/privacy/ | `a42a4e48b5fe9cf6547b33a8a26fd9b1c57d3386fccdbca0b575d4f8b6b0f933` |
| terms-of-service / 1.0 | https://jjaturi-docs.pages.dev/terms/ | `9e2bc417ddd92c469ef74cb003955f7aa465d870482138d3517b0515527d3c14` |

## 2. 정확한 승인 대상·영향

| 대상 행 | 이전값 | 새값 |
| --- | --- | --- |
| `(privacy-policy,1.0)` | 행 없음 | document_url=`https://jjaturi-docs.pages.dev/privacy/`, active=true, approved_at=이번 최종 DB 적용 승인 후 실행시각 |
| `(terms-of-service,1.0)` | 행 없음 | document_url=`https://jjaturi-docs.pages.dev/terms/`, active=true, approved_at=위와 동일 시각 |

시행일은 공개 문서의 **2026-09-09**다. 기존 schema에 시행일 컬럼이 없으므로 신설하지 않는다. `approved_at`을 시행일 자정으로 꾸미지 않으며 실제 운영 승인 이후 transaction 시각을 두 행에 동일 기록한다. 과거 URL/version 덮어쓰기0, 기존 동의·계정·기록 변경0, support 등록0.

영향: 현재 문서 부재로 닫힌 신규 일반 가입의 **문서 registry 게이트가 열림**. 앱의 기본 미동의·연령 자기확인·필수 동의와 서버 Auth trigger의 exact 문서 검사 유지. 실제 가입/메일 발송 시험은 이번 연결에 포함하지 않는다.

### 승인 후 실행 절차

1. 대상·게시 hash·registry/동의 집계를 재대조. 예상 밖 행/동일version 다른 URL·내용 발견 시 중단. 이미 동일 연결이면 변경0으로 검증만.
2. 단일 transaction, `lock_timeout='5s'`, `statement_timeout='15s'`. registry에 `SHARE ROW EXCLUSIVE` 잠금으로 동시 registry 변경 방지. 일반 SELECT를 차단하는 잠금은 아니며 동시 registry 관리 쓰기만 짧게 대기할 수 있다.
3. 잠금 안에서 registry0행 사전조건을 재검사. INSERT2행 `active=false`, 같은 승인시각 → 정확한 ID/version/URL 조건의 UPDATE2행 `active=true`. 예상 행 수가 다르면 예외/rollback. transaction 밖에 한 문서만 활성인 중간 상태를 노출하지 않음.
4. commit 후 registry 전체/동의 집계와 ACL 보존, 공개 anon RPC의2개 ID/version/URL 확인. RPC는 active 필드를 반환하지 않으므로 registry active=true와 함께 판정. 실패/응답 유실 시 자동 반복 INSERT나 복구 금지; 읽기로 부분/commit 여부 보고.

### 복구 수단

- commit 전 실패: transaction rollback으로 원래0행 상태 유지.
- commit 후 문제가 확인될 때: **자동 복구하지 않고 승인 범위 확인 후**, 정확한 두 행의 URL/version/승인시각 일치 조건을 잠금 아래 재검사하고 `active=false`로 원자적 비활성화. 원래의 활성 문서0 상태로 돌아가 신규 가입 문서 게이트가 다시 닫힘.
- 새 동의가 생길 수 있으므로 행 자체 DELETE·동의행 삭제·계정 삭제 금지. URL/version/approved_at은 남겨 FK·과거 수락 근거를 보존한다. 전체DB 복원·추가 백업 불필요.

## 3. UI 공개 계약

실행 전에는 기존 `not_configured` 상태 유지. 적용 뒤 기대값은 `get_signup_consent_documents()`가 `document_id/document_version/document_url` 두 행을 ID순으로 반환하는 것이다.

`accountRegistrationRepository.ts`의 `readSignupConsentDocuments()` 결과:

- 성공: `{status:'ok',documents:[{documentId:'privacy-policy',documentVersion:'1.0',url:'https://jjaturi-docs.pages.dev/privacy/'},{documentId:'terms-of-service',documentVersion:'1.0',url:'https://jjaturi-docs.pages.dev/terms/'}]}`.
- 누락/불완전: `{status:'not_configured',documents:[]}`; 조회 실패: `{status:'unavailable',documents:[]}`. URL 하드코딩으로 우회하지 않는다.
- 가입은 현재 registry 조회→해당 URL 문서 열기→사용자 명시 동의→`signUpAccount`의 exact documentId/documentVersion/accepted=true 계약. 제출 직전 재조회, stale은 `document_version_stale`, 누락은 `signup_unavailable`, 조회 오류는 `retryable_failure`. 기존 연령/UI 문서열기 실패 처리 유지.

실제 적용·공개 RPC 사후검증은 아직 **미실행**이며 UI는 이 기대값을 운영 완료로 취급하지 않는다.

## 4. 인수인계

1. 변경 파일: 이 문서 신규 및 `release-facts-final.md` LINKS-01 상태 추가. 점검기 `/private/tmp/timefit-docs-link-preflight.cjs`는 read_only SELECT·공개 HTTP 확인만 실행; 인증은 기존 Keychain에서 메모리로 사용하며 비밀 파일/로그 저장0.
2. 유지 계약: schema/RPC/권한·실제 동의·기존 계정/기록/표본 보존, 개인화 C·탈퇴·공급자 조사·운영 쓰기0.
3. 검증: registry/연결 집계 SELECT 성공, 공개 HTML2개 HTTP200/hash 일치, RPC ACL 확인. 앱 코드 변경 없어 전체 테스트 미실행. 공개 RPC 실호출 사후검증 대기.
4. 다음: 사용자 최종 운영 적용 승인 후 정확한2행 원자적 연결·사후 검증. 문서 경로를 UI에 인계하되 적용 완료 전 UI 연결 성공으로 기록하지 않음.

## 5. 사용자 승인·실제 운영 적용 완료

사용자가 사전 승인 묶음에 **“승인”**으로 답했다. 기존2절의 정확한2행 등록/원자적 활성화 및 사후 검증만 수행했다. 게시/문안/계정/개인화 정책 승인으로 확대하지 않았다.

### 실행과 검증

- 직전 재확인 `2026-09-09T12:38:19.406Z`: 동일 linked project/서울/ACTIVE_HEALTHY, registry0행·과거 동의 연결0건, 두 게시 URL HTTP200 및 승인 hash 일치.
- 적용기 `/private/tmp/timefit-docs-link-apply.cjs`: 구문 검사 `node --check` PASS. 기존 Keychain 관리 인증 및 앱의 공개 anon 자격을 메모리에서만 사용. 공개 key가 service_role이 아닌지 검사하며 세션 생성·사용자 인증·비밀 출력 없음.
- 공개 RPC 사전 응답 `[]`; transaction 직전 read_only 기준선 재확인. 두 페이지의 승인 hash도 재대조했다.
- SQL SHA256: `367f26619b12a5fb9c4f5ef6ce9fac130cccc31f8e256d7cd154ce54b473392d`. 기존2절의 BEGIN/timeout/registry SHARE ROW EXCLUSIVE 잠금/빈 registry·동의 guard/INSERT inactive2/UPDATE active2/행수 guard/COMMIT 실행. 원격 쓰기 요청 **1회 성공**, 재시도/자동 복구0.
- 두 행 `approved_at` 동일: **2026-09-09T12:39:33.950391+00:00** (21:39:33 KST). 시행일은 게시 문서2026-09-09로 유지하며 새 컬럼 없음.
- 사후 확인시각 **2026-09-09T12:39:34.945Z**. registry 전체 정확한2행, 두 행 active=true, ID/version/URL 일치. 과거 동의 count **0→0**. RPC ACL 동일. Auth 계정·개인 기록은 조회/갱신하지 않았으며 실행 SQL에는 registry 이외 INSERT/UPDATE/DELETE·DDL이 없다.
- 정상 공개 anon REST RPC `POST /rest/v1/rpc/get_signup_consent_documents` 성공. ID순으로 아래2건 반환. 관리 read_only 역할의 이전42501을 권한 완화로 우회하지 않았다.

| document_id | document_version | document_url | registry active |
| --- | --- | --- | --- |
| privacy-policy | 1.0 | https://jjaturi-docs.pages.dev/privacy/ | true |
| terms-of-service | 1.0 | https://jjaturi-docs.pages.dev/terms/ | true |

**이전→교체:** registry0/문서 게이트 닫힘 → 게시 완료 및 정확한 적용 승인 → 문서2종 원자적 활성화 → 실제 공개 문서에 연결하면서 과거 동의/FK 보존 → **운영 적용·DB 검증 완료**. 가입 문서 게이트가 열렸지만 실제 가입/메일 발송·UI 링크 열기 성공을 대신하지 않는다.

### 최종 네 항목 인수인계

1. 변경: 승인된 운영 registry2행 신규·활성화, 이 문서와 `release-facts-final.md` 상태 갱신. 원격 실행SQL·시각·이전값·복구 방법은 위 기록. 제품 코드·migration 변경0.
2. 유지: 계정·기록·과거 동의·RPC schema/ACL·기본 미동의·exact version 검증·연령 자기확인·C 수락. 계정 생성/삭제·표본 쓰기·C 반복·다른 공급자 조사0. 지원 페이지는 registry 대상 아님.
3. 결과: 실행기 구문 PASS, 동일 대상/게시hash 확인, transaction1회 성공, active2행·동의0→0·ACL 보존 및 공개 RPC2행 PASS. 앱 코드 변경 없으므로 전체 테스트/빌드 미실행. 문서 diff 검사 PASS.
4. 다음 UI: **3절 공개 계약을 지금 사용할 수 있음.** `readSignupConsentDocuments()`로 문서 조회 후 registry URL 열기·명시 동의·가입 직전 exact 재검증을 연결한다. not_configured/unavailable/stale/열기실패 때 고정 URL로 가입 우회 금지. 실제 iPhone privacy/terms/support 링크 확인과 가입 화면 회귀는 UI/QA 담당이며 이번 미실행. 이상 시2절 복구안을 재확인하며 두 registry행 비활성화 외 전체DB/계정/동의 삭제 금지.
