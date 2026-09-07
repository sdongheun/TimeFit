# DB-PROFILE-ACCOUNT-01 — 프로필·가입 동의·계정 삭제 계약

2026-09-07: 아래는 조사 당시 초안이다. 최신 실행은 [DB-RELEASE-IDENTITY-01](release-identity-personalization.md). 나이 입력/신규 수집은 철회됐으므로 아래 SignUpInputV2.birthYear를 구현하지 않는다. 닉네임·삭제·동의 초안의 미승인 값을 자동 확정하지 않으며 A 공개 계약 수락 뒤 구현한다.

상태: **계약 조사·설계 실행 가능 / 구현·원격 적용 전**. 부모 결정은 DEC-PROFILE-SETTINGS-01. UI 기본 구조는 구현됐지만 저장 기능 완료를 뜻하지 않는다.

## 현재 근거와 충돌

- AuthContext.signUp은 입력 확인과 무관하게 terms_agreed_at/privacy_agreed_at을 현재 시각으로 저장한다. UI에는 실제 동의 확인이 없다.
- 데이터베이스설계.md의 초기 닉네임 미수집은 최신 프로필 요구와 충돌한다. 최신 결정은 닉네임 표시/수정을 허용하지만 저장 필드·검증 규칙은 미확정이다.
- 초기 privacy_agreed_at의 개인정보·개인화 결합 의미는 최신 별도 체류 opt-in과 충돌한다. 과거 값을 체류 수집 동의로 재해석하면 안 된다.
- 계정 삭제는 기존 문서에 서버 Edge Function 경계가 있으나 앱용 구현 유무·삭제 범위·실패 복구는 실코드 확인이 필요하다.

```text
DB-PROFILE-ACCOUNT-01을 진행해. AGENTS.md, docs/README.md, docs/04_backend/데이터베이스설계.md, docs/work/integration-decision/profile-settings.md, docs/work/uiux/profile-settings.md 완료 인계와 이 파일을 읽어. 이번 단계는 계약 조사·설계와 검증 계획이며 제품 코드/DB migration/원격 데이터는 변경하지 마.

1. profiles·Auth metadata·가입 trigger·일반 account 판정·기존 repository·Edge Function·RLS와 실제 수집 데이터를 조사한다. 외부 운영 데이터 조회나 키 출력 없이 저장소 근거로 존재/부재를 구분한다. 닉네임 미수집 및 privacy_agreed_at 초기 의미와 최신 결정의 차이를 표시하고, 구형 동의를 신규 개인화 동의로 간주하지 않는다.
2. 닉네임 read/update 계약을 제안한다. canonical 저장 위치 하나, account-only, 기존 사용자 null 처리, validation/정규화/길이/중복 허용 여부, 허용 필드·RLS·실패 결과를 명시한다. 닉네임은 로그인 식별자나 공개 사용자 검색 기능으로 확장하지 않는다. 규칙의 기존 근거가 없으면 권장안과 사용자 승인 필요 항목을 분리한다.
3. 가입 동의 계약을 제안한다. 필수 항목의 실제 문서/버전과 명시 확인을 입력으로 받고, 누락 시 Auth 요청 전에 차단하는 경계, 서버 저장 신뢰 경계, 이메일 인증 대기/중복 요청/실패를 정의한다. 필수 약관·개인정보 처리와 선택 체류 동의를 분리한다. 기존 timestamps를 실제 명시 동의 증거라고 승격하거나 소급 생성하지 않는다. 법률 적합성을 코드 설계만으로 확정하지 않는다. 정책 URL/문서 버전 미확정은 출시 차단 항목으로 인계한다.
4. 계정 삭제 계약을 제안한다. 검증된 JWT에서 사용자 identity를 결정하는 서버 entry, anonymous 거절, 재인증 필요 여부와 지원 방식, userId 입력 위조 방지, 사용자 소유 데이터 목록, Auth/storage/관련 데이터의 실패·재시도·멱등 처리, 클라이언트 성공 확인을 정의한다. 여러 시스템 삭제를 근거 없이 단일 transaction이라고 주장하지 않는다. 기기 로컬 완료 기록/진행 코스와 서버 개인정보의 범위를 분리하고 미확정 로컬 삭제 정책은 사용자 결정으로 남긴다. 서비스 키는 서버에만 두고 계정 삭제를 signOut으로 대신하지 않는다.
5. DB-DWELL-01과 소유 경계를 비교해 체류 동의 스키마를 중복 설계하지 않는다. 이번 계약에는 향후 연결점만 적고 Live Activity·알림 예약·GPS는 구현하지 않는다.
6. 후속 구현을 DB repository/서버 경계와 UI AuthContext consumer로 나눠 정확한 entry 이름·입력/출력 타입·오류·인증·호출 순서를 제안한다. UI가 실행 가능한 공개 계약 초안을 작성하되 승인 전 구현 기준으로 승격하지 않는다. 성공/거절/타 사용자/입력 누락/중복/부분 실패 fixture 및 전용 테스트 데이터 정리 계획을 남긴다.
7. 이 문서에 변경 파일(문서만)/불변 경계/조사 근거/통합·사용자 결정 필요 목록을 인계하고 git diff --check를 실행한다. 중앙 정책·UI·AuthContext·migration·env 변경, 실제 계정 생성/삭제·메일 발송·원격 배포·commit/push 금지. 결과를 통합 세션이 승인한 후 구현 작업을 발행한다.
```

## 조사 결과 — 2026-09-06

이번 결과는 저장소의 코드와 migration만 읽어 조사한 **통합 승인 전 계약 초안**이다. 운영 Supabase 사용자·행·Storage object는 조회하지 않았고, 실제 계정 생성·삭제·메일 발송도 하지 않았다.

### 존재/부재와 실제 수집 경계

| 항목 | 저장소 근거 | 판정과 영향 |
| --- | --- | --- |
| 일반 account 판정 | `src/ui/authStateModel.ts`의 `authKindFor`/`accountSessionFor` | loading을 먼저 분리하고, session 없음 또는 `user.is_anonymous === true`는 guest, 그 밖은 account로 판정한다. 이메일 유무를 판정에 쓰지 않는 현행 계약은 재사용 가능하다. |
| Auth 공개 entry | `src/ui/AuthContext.tsx` | `signIn(email, password)`, `signUp({ email, password, birthYear })`, `signOut()`만 있다. 닉네임·명시 동의 입력·계정 삭제 entry는 없다. |
| 가입 입력/UI | `src/ui/LoginScreen.tsx` | 이메일·비밀번호·비밀번호 확인·출생연도만 받는다. 약관/개인정보의 문서·버전·체크 상태는 받지 않고 안내 문구만 있다. |
| 가입 동의 metadata | `AuthContext.signUp` | 제출 시점의 클라이언트 시각을 `terms_agreed_at`, `privacy_agreed_at`에 무조건 넣는다. 사용자의 명시 확인과 연결되지 않는다. |
| 가입 trigger | `202608110002_create_profiles.sql`, `202608270012_anonymous_auth_cleanup_contract.sql` | 일반 Auth 사용자에 profile을 만들며 metadata가 없거나 비어도 DB 현재 시각으로 보정한다. 따라서 두 timestamp의 존재는 명시 동의 증거가 아니다. anonymous는 최신 trigger에서 profile 생성을 건너뛴다. |
| 닉네임 | `profiles` schema, `src/` repository 전역 | 컬럼·Auth metadata canonical key·read/update repository·validation이 모두 없다. UI는 준비 중이라고만 표시한다. |
| profile RLS/권한 | `202608110005_enable_rls_and_policies.sql`, `202608130008_grant_authenticated_app_tables.sql` | 본인 행 select/update RLS는 있으나 authenticated에 table 전체 insert/update/delete 권한이 부여돼 있다. trigger가 id/birth/age/email 검증만 하고 동의 timestamp 변경은 막지 않는다. 닉네임을 추가할 때도 허용 컬럼을 명시적으로 축소해야 한다. |
| 일반 account repository 격리 | `authStateModel`, `src/services/courseRepository.ts` | UI용 account guard는 존재하지만 course repository의 `currentUserId()`는 `is_anonymous`를 확인하지 않는다. 새 profile/account repository는 이 패턴을 복사하지 않고 account-only를 entry와 서버 양쪽에서 강제해야 한다. 기존 course repository 수정은 이번 범위가 아니다. |
| 계정 삭제 DB helper | `202608110006_account_deletion_function.sql` | service role 전용 `purge_account_data(target_user_id)`는 존재하고 반복 delete 자체는 멱등이다. events→feedback→courses→profiles를 먼저 삭제한다. |
| 계정 삭제 서버 entry | `supabase/functions/` | 앱용 `delete-account` Edge Function이 없다. 현재 있는 Admin `deleteUser` 호출은 anonymous 30일 정리 전용이며 일반 사용자 요청 entry가 아니다. 앱에도 계정 삭제 호출이 없다. |
| 서버 사용자 연결 데이터 | migrations 002~005 | Auth 이메일/identity/session, `profiles`의 birth year·age band·email 확인·두 legacy timestamp, `courses`의 출발/약속 label·좌표·시각·snapshot, stops/legs, feedback 자유 의견, recommendation events를 저장할 수 있다. Storage bucket/object schema와 업로드 구현은 발견되지 않았다. |
| 계정 비연결 서버 데이터 | route proxy migrations, anonymous cleanup migration | 공개 route cache/geometry/budget/lease와 anonymous cleanup 일자별 집계에는 일반 user ID가 없다. 일반 계정 삭제 대상이 아니다. |
| 기기 로컬 데이터 | Supabase auth storage, completion/feedback/notification repository | Auth session은 AsyncStorage에 남는다. `@timefit/course-completions-v1`, `@timefit/place-feedback-v1`, `@timefit/course-notification-ids`도 로컬이다. 완료/legacy 후기는 계정과 자동 연결되지 않는다. 현재 active course는 process lifetime이고 App Group 영속은 아직 구현 전이다. |
| 이메일 확인 | `AuthContext`, DB 설계 | DB 문서는 이메일 확인 필수를 말하지만 앱의 환경 분기는 redirect URL 포함 여부만 바꾸며, 실제 확인 강제 여부는 Supabase Auth 서버 설정에 달려 있다. `data.session` 유무로 즉시 account/pending을 가르는 현재 boolean 반환은 실패 원인을 충분히 표현하지 못한다. |

추가 관찰: DB 문서의 개인정보 최소화 문구 일부는 정확한 출생연도를 저장하지 않는다고 쓰지만 실제 `profiles.birth_year`는 필수 저장이다. 이번 부모 결정 범위를 넘으므로 수정하지 않았으며, 통합 세션이 별도 개인정보 최소화 검토 여부를 판단해야 한다.

### 정책 충돌과 변경 이력

1. **닉네임 — 충돌.** 이전 방식은 “닉네임 미수집”이고 실제 schema도 그 상태다. 최신 `DEC-PROFILE-SETTINGS-01`은 로그인 사용자에게 닉네임 표시·수정을 요구한다. canonical 저장과 검증이 없으므로 UI가 metadata key를 임의 생성하면 데이터 원천이 둘로 갈린다. 아래 `profiles.nickname` 단일 원천을 권장한다. 상태는 **통합 승인 전·구현 전**이다.
2. **가입 필수 동의 — 충돌.** 이전 방식은 가입 호출과 동시에 두 timestamp를 자동 생성하고 trigger가 누락값도 DB 시각으로 채웠다. 실제 체크·문서 버전·서버 검증이 없어 증거성을 주장할 수 없다. 명시 확인 입력과 버전별 append-only 증거를 요구하고 legacy timestamp는 `legacy_unverified`로만 취급한다. 상태는 **통합 승인 전·기존 동의 증거로 사용 금지**다.
3. **개인정보와 개인화 — 충돌.** 기존 `privacy_agreed_at`은 개인정보 처리와 개인화를 한 값으로 설명한다. 최신 `DEC-LIVE-DWELL-01`/DB-DWELL-01은 체류 개인화를 별도 선택 동의로 확정했다. 필수 개인정보 처리 동의와 체류 opt-in을 분리하며, 기존 값을 신규 체류 동의로 소급하지 않는다. 상태는 **분리 계약 현행·DB-DWELL 구현 전**이다.
4. **계정 삭제 — 불완전.** 이전 문서는 Edge Function이 public data, Auth, 알림을 “하나의 처리 단위”로 삭제한다고 적었지만 실제로는 public purge helper만 있고 Edge Function·재인증·Storage/로컬 처리·부분 실패 복구가 없다. 여러 시스템을 단일 transaction으로 표현하지 않고 단계별 결과와 재시도를 노출한다. 상태는 **계약 승인 전·기능 부재**다.
5. **이메일 확인 — 불일치 위험.** 문서는 필수이나 클라이언트 환경값만으로 이를 보장할 수 없다. 출시 Supabase Auth 설정, redirect URL과 딥링크 검증이 별도 출시 게이트다.

## 공개 계약 제안 — 통합 승인 전

아래 이름과 타입은 UI가 구현 범위를 평가할 수 있게 한 초안이다. 승인 전 제품 코드나 DB 기준으로 승격하지 않는다.

### 공통 account guard

모든 profile/consent/delete entry는 raw session이 아니라 다음 판정을 공유한다.

```ts
type AccountIdentity = Readonly<{ userId: string; email: string | null }>;

type AccountGuardResult =
  | { status: 'account'; identity: AccountIdentity; accessToken: string }
  | { status: 'loading' }
  | { status: 'account_required' };
```

- `user.is_anonymous === true`, session 없음, 만료 JWT는 `account_required`이며 DB write는 0회다.
- 클라이언트 guard는 UX 조기 차단이고 신뢰 경계가 아니다. RLS/RPC/Edge Function도 검증된 JWT의 `sub`와 anonymous 여부를 다시 확인한다.
- 이메일은 표시/재인증 보조값일 뿐 identity나 닉네임으로 쓰지 않는다.

### 닉네임 read/update

**권장 canonical 위치:** `public.profiles.nickname text null` 하나. Auth `raw_user_meta_data`에는 복제하지 않는다. 기존 사용자는 migration 뒤 `null`이며 `닉네임 설정하기`로 보인다.

```ts
type AccountProfile = Readonly<{
  nickname: string | null;
  nicknameUpdatedAt: string | null;
}>;

type ReadAccountProfileResult =
  | { status: 'ok'; profile: AccountProfile }
  | { status: 'account_required' | 'not_found' | 'unavailable' };

type UpdateAccountNicknameInput = Readonly<{ nickname: string | null }>;
type UpdateAccountNicknameResult =
  | { status: 'updated'; profile: AccountProfile }
  | { status: 'unchanged'; profile: AccountProfile }
  | { status: 'invalid_nickname'; reason: 'empty' | 'too_long' | 'invalid_character' }
  | { status: 'account_required' | 'forbidden' | 'unavailable' };

readAccountProfile(): Promise<ReadAccountProfileResult>
updateAccountNickname(input: UpdateAccountNicknameInput): Promise<UpdateAccountNicknameResult>
```

**권장 검증안(사용자 승인 필요):** NFC 정규화 → 앞뒤 공백 제거 → 연속 Unicode 공백을 한 칸으로 축약한 뒤 1~20 Unicode code point. 줄바꿈·제어문자는 거절한다. 다른 사용자의 동일 닉네임은 허용하며 uniqueness 조회를 하지 않는다. `null`은 명시적 닉네임 제거로 권장하고, 빈 문자열은 제거 요청으로 암묵 변환하지 않는다. 대소문자·한글/영문/숫자/일반 emoji를 이유 없이 제한하지 않는다. 욕설·예약어 정책은 확정 근거가 없으므로 이번 계약에 넣지 않는다.

- read는 본인 profile의 `nickname`, nickname 전용 갱신 시각만 조회한다.
- update는 JWT의 `auth.uid()` 행만 대상으로 하고 userId를 입력받지 않는다.
- 새 migration은 authenticated 권한을 `select`와 `update(nickname)` 등 실제 허용 컬럼으로 축소하고 DB constraint/trigger로 우회 update도 막아야 한다. `terms_agreed_at`, `privacy_agreed_at`, birth/age/email 확인값을 nickname update와 함께 바꿀 수 없어야 한다.
- 닉네임은 로그인 식별자, 공개 프로필, 다른 사용자 검색, 추천 근거로 확장하지 않는다.

### 가입 필수 동의

필수 약관과 개인정보 처리는 각각 실제 문서 식별자와 버전을 가진다. 선택 체류 동의는 이 입력에 포함하지 않고 DB-DWELL-01 entry에서만 처리한다.

```ts
type RequiredConsentInput = Readonly<{
  documentId: 'terms-of-service' | 'privacy-policy';
  version: string;
  accepted: true;
}>;

type SignUpInputV2 = Readonly<{
  email: string;
  password: string;
  birthYear: number;
  requiredConsents: Readonly<{
    terms: RequiredConsentInput;
    privacy: RequiredConsentInput;
  }>;
}>;

type SignUpResultV2 =
  | { status: 'account_session_ready' }
  | { status: 'email_confirmation_pending' }
  | { status: 'rejected'; reason: 'input_missing' | 'consent_required' | 'document_version_stale' | 'age_restricted' | 'signup_unavailable' };

signUp(input: SignUpInputV2): Promise<SignUpResultV2>
```

호출 순서는 다음과 같다.

1. UI는 실제 약관/개인정보 문서 제목·버전·링크를 표시하고 두 항목을 기본 미선택으로 둔다. 둘 중 하나라도 누락되면 `supabase.auth.signUp` 호출 0회다.
2. UI는 submit 중 모드 전환/중복 submit을 막되 실패 뒤 재입력을 허용한다. 선택 체류 동의를 필수 체크에 묶지 않는다.
3. Auth 요청에는 accepted boolean과 exact document ID/version을 보내되 클라이언트 timestamp는 canonical 증거로 받지 않는다.
4. 서버 `handle_new_user` 경계는 anonymous를 계속 제외하고, 일반 계정에 대해 현재 승인된 필수 문서 두 개의 `accepted === true`와 exact version을 검증한다. 누락/stale이면 profile/consent를 보정 생성하지 말고 가입 transaction을 거절한다.
5. canonical 증거는 별도 append-only `account_consent_records(user_id, consent_kind, document_id, document_version, accepted_at, evidence_schema_version)`를 권장한다. `accepted_at`은 서버 시각이며 본인 read만 허용하고 클라이언트 update/delete는 금지한다. 문서 개정 재동의는 새 version 행을 추가한다.
6. 기존 `profiles.terms_agreed_at/privacy_agreed_at`과 Auth metadata는 `legacy_unverified` 호환값이다. 새 표본으로 소급 insert하거나 체류 opt-in으로 승격하지 않는다. 기존 계정의 재동의 시점/차단 범위는 별도 사용자 결정을 받아야 한다.
7. `data.session`이 있으면 account state 확인 뒤 ready, 없으면 이메일 확인 대기다. 중복 요청/이메일 존재/메일 provider 오류는 계정 존재를 과도하게 노출하지 않는 `signup_unavailable`로 정규화하고 원시 서버 오류를 화면·로그에 남기지 않는다.

정책 URL, 실제 문서 내용과 버전, 개정·철회/보유 정책은 법률 검토를 거쳐야 한다. 코드 설계는 법률 적합성의 증명이 아니며, 이 값들이 없으면 가입 기능 출시를 차단한다.

### 계정 삭제

**서버 entry 권장 이름:** `POST /functions/v1/delete-account`. body는 `{ requestId: string }`만 받고 `userId`가 있으면 거절한다. 서비스 역할 키는 함수 환경에만 둔다.

```ts
type DeleteAccountInput = Readonly<{ requestId: string }>;
type DeleteAccountResult =
  | { status: 'deleted'; requestId: string }
  | { status: 'reauth_required'; method: 'password_sign_in' }
  | { status: 'rejected'; reason: 'account_required' | 'invalid_request' }
  | { status: 'retryable_failure'; stage: 'storage' | 'database' | 'auth' };

deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountResult>
```

인증·처리 순서는 다음을 권장한다.

1. 클라이언트가 파괴적 행동을 재확인하고 account guard를 통과한다. anonymous는 호출하더라도 서버가 `account_required`로 거절한다.
2. 서버는 Authorization JWT를 Supabase Auth로 검증하고 그 user의 `id`만 사용한다. body/query의 user ID, 이메일, profile ID로 대상을 정하지 않는다.
3. 민감 작업이므로 최근 인증을 요구한다. 현재 지원 인증이 이메일/비밀번호뿐이므로 stale session은 기존 `signInWithPassword`로 재인증한 새 JWT를 사용하고, 비밀번호를 Edge Function body에 보내지 않는다. 최근 인증 허용 시간은 아래 승인 항목이다.
4. 같은 user에 대한 삭제는 서버 lock/claim으로 직렬화하고 동일 `requestId` 재호출은 같은 결과로 수렴시킨다. 새 service-only 상태가 필요하면 user 소유 public table과 분리하고 보유 기간·정리 job을 함께 정한다.
5. 현재 Storage object와 서버 예약 알림 table은 0개로 조사됐다. 향후 account-owned bucket/외부 예약이 생기면 Auth 삭제 **전에** 소유 목록을 열거해 삭제하며, 실패하면 Auth를 남기고 `retryable_failure`로 종료한다.
6. Auth Admin 삭제를 수행해 Auth 사용자와 FK cascade 대상 public rows를 제거한다. public 대상은 현재 `profiles`, `courses`→`course_stops/course_legs/course_feedback`, `recommendation_events`이며, 승인 후 `account_consent_records`와 DB-DWELL raw/profile도 cascade 대상이어야 한다. route cache/budget/geometry와 집계 anonymous cleanup audit은 user 연결이 없어 제외한다.
7. 삭제 뒤 service role로 사용자 연결 행 0건을 확인한다. 시스템 간 처리를 하나의 transaction이라고 주장하지 않는다. 단계·코드화된 실패만 반환하고 user ID, 이메일, 좌표, comment를 로그에 쓰지 않는다.
8. 클라이언트는 `deleted`를 받은 뒤에만 성공 화면과 local Auth session 제거를 수행한다. `signOut()`만 호출해 성공으로 가장하지 않는다. 응답 유실 뒤 Auth refresh가 user-not-found이면 로컬 pending request와 함께 삭제 완료로 수렴시키고, 아직 유효하면 같은 requestId로 재시도한다.

현행 `purge_account_data`를 Auth 삭제 전에 단독 호출하면 Admin 삭제 실패 시 “계정은 남았지만 public 데이터는 사라진” 부분 상태가 생긴다. 후속 구현은 이를 정상 primary flow로 그대로 연결하지 말고, Auth FK cascade 중심 처리 또는 복구 가능한 delete job 순서를 migration/RLS fixture로 먼저 증명해야 한다. Storage/Auth/외부 시스템 전체가 원자적이라는 표현은 금지한다.

기기 로컬 `course-completions`, legacy place feedback, active/progress, 예약 로컬 알림은 서버 개인정보와 별도다. 계정 삭제 시 이들을 유지할지 함께 지울지, 일부만 지우면서 “전체 삭제”라고 표시하지 않도록 사용자 결정이 필요하다. 결정 전 DB/API 성공이 로컬 기록 삭제 성공을 뜻하지 않는다.

### DB-DWELL-01 연결점

- 이 작업은 `dwell_personalization_enabled`, raw dwell sample, derived profile, 초기화 RPC를 설계하거나 구현하지 않는다.
- 가입 필수 개인정보 동의와 DB-DWELL의 선택 체류 동의는 별도 row/entry/상태다. 기존 `privacy_agreed_at` 또는 새 필수 privacy record 어느 것도 체류 opt-in이 아니다.
- 계정 삭제 contract는 DB-DWELL이 추가할 raw sample·derived profile의 cascade/검증 entry를 소비한다. 개인화 초기화는 account/Auth/코스/로컬 완료를 지우지 않는다.
- Live Activity, 알림 예약, GPS는 이 계약의 입력·부수효과가 아니다.

## 후속 구현 분할과 검증 계획

### DB·repository/서버 소유

1. 실패 migration/RLS fixture 뒤 nullable nickname과 nickname-only 권한, append-only required consent evidence, account deletion claim/lock 및 cascade를 새 migration으로 추가한다. 적용된 migration은 수정하지 않는다.
2. `src/services/accountProfileRepository.ts`에 `readAccountProfile`/`updateAccountNickname`, `src/services/accountDeletionRepository.ts`에 `deleteAccount` adapter를 둔다. 두 repository 모두 account guard를 자체 적용하고 raw error를 정규화한다.
3. `handle_new_user`는 승인된 문서 version을 서버에서 검증하고 누락값 현재시각 보정을 중단한다. legacy rows는 변경하지 않는다.
4. `supabase/functions/delete-account/index.ts`는 JWT identity, anonymous 거절, 재인증 freshness, userId 비수용, 단계별 실패·멱등을 구현한다. 원격 적용과 실제 계정 삭제는 별도 승인 게이트다.

### UI AuthContext consumer 소유

1. `AuthContext.signUp`을 승인된 `SignUpInputV2/SignUpResultV2`로 연결하고 실제 필수 문서 두 개의 unchecked 기본 상태·버전을 전달한다.
2. Profile consumer는 repository 결과가 `updated`일 때만 닉네임 저장 성공을 표시한다. account/loading/anonymous와 중복 submit·실패 재시도를 보존한다.
3. 삭제 확인 → 필요 시 password 재로그인 → 같은 requestId로 delete 호출 → `deleted` 뒤 local 처리 순서를 따른다. signOut을 delete 대체로 쓰지 않는다.
4. 정책 URL/버전, 로컬 기록 처리 결정이 없으면 inert/가짜 성공 UI를 만들지 않는다.

### 필수 fixture와 정리

- **닉네임:** null 기존 사용자, 정상/동일값/명시 clear, NFC·공백·1/20/21 code point, 줄바꿈/제어문자, 중복 닉네임 허용, anonymous, 타 사용자 ID 주입, 허용 외 profile 필드 동시 변경 거절, RLS 격리.
- **가입:** 두 필수 동의 성공, 각 항목 누락, false, stale/알 수 없는 version, Auth 호출 전 UI 차단, 이메일 확인 pending, 즉시 session, 중복 submit, provider/trigger 실패, legacy timestamp 무승격, 선택 체류 row 0건.
- **삭제:** 정상 account, anonymous/null/만료 JWT, stale 인증, 위조 userId, 동일 requestId 중복·동시 요청, Storage 실패 전 DB/Auth 0회, Auth 실패와 재시도, public cascade, 타 사용자 잔존, consent와 향후 dwell 삭제, route cache 잔존, 응답 유실 후 수렴, 서비스 키/민감 로그 부재.
- 로컬 Supabase 또는 transaction 격리 fixture에서 임의 UUID·`example.invalid` 이메일만 쓴다. 생성한 Auth 사용자, profile/course/feedback/event/consent/dwell/delete-job row와 Storage fixture는 `afterEach/finally`에서 Admin test helper로 삭제한다. 테스트 실패 때도 정리되며 운영 프로젝트·실제 메일 provider·실사용자·실제 정책 동의는 사용하지 않는다.

합격 기준은 repository/Edge entry의 observable result와 DB row/RLS를 함께 검사하는 것이다. 문자열 존재 검사만으로 완료 처리하지 않는다. 후속 구현은 집중 계약 테스트, `npm run test:typecheck`, `npm test`, `git diff --check`를 통과해야 하며 원격 migration/Function 배포는 별도 승인 전 0회다.

## 통합·사용자 승인 필요 목록

1. 닉네임 정규화와 길이 `1~20 code point`, 중복 허용, 명시 null 삭제 권장안을 승인할지.
2. 이용약관·개인정보 처리방침의 실제 URL/문서 ID/버전과 개정 시 재동의 정책. 미확정이면 가입 출시 차단이다.
3. legacy 일반 계정에 새 버전 재동의를 언제 요구할지. 기존 timestamp의 소급 승격은 선택지가 아니다.
4. 계정 삭제 최근 인증 허용 시간. 이메일/비밀번호만 지원하는 현재 앱에는 **10분 이내 password sign-in**을 권장한다.
5. 계정 삭제 후 required consent evidence를 법률상 별도 보관해야 하는지와 기간. 별도 확정이 없으면 user-linked evidence도 삭제한다.
6. 서버 계정 삭제 성공 뒤 device-local 완료/legacy 후기/진행·로컬 알림을 유지, 전부 삭제, 사용자 선택 중 어느 정책으로 할지.
7. DB 문서와 실제 schema가 어긋난 `birth_year` 보관을 별도 개인정보 최소화 결정으로 발행할지.
8. `courseRepository.currentUserId()`의 anonymous account-only 누락을 별도 DB 회귀 작업으로 발행할지.

## 완료 인수인계 — 2026-09-06

### 1. 변경 파일과 변경 목적

- `docs/work/db-personalization/profile-account-contract.md`: 저장소 기반 존재/부재, 충돌 이력, 닉네임·필수 가입 동의·계정 삭제의 공개 계약 초안, 후속 역할 분할과 fixture를 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 제품 코드, UI/AuthContext, repository, migration, Edge Function, 중앙 정책 문서, env, Supabase 원격 데이터는 변경하지 않았다.
- anonymous Auth 30일 정리, 기존 course/completion 저장, 추천·운영시간·Route Proxy, DB-DWELL 선택 체류 동의 schema를 변경하거나 중복 설계하지 않았다.
- legacy 동의 timestamp를 명시 동의나 체류 opt-in으로 승격하지 않았다.

### 3. 조사·검증 결과

- 저장소 정적 조사로 nickname 계약 부재, 가입 동의 자동 timestamp/trigger 보정, service-role purge helper 존재, 앱용 delete-account Edge Function 부재, 현재 Storage bucket/서버 알림 table 부재를 확인했다.
- 운영 DB·외부 API·메일·실제 계정 호출은 0회다.
- `git diff --check`: 통과(exit 0). 문서가 현재 untracked여서 `git diff --no-index --check /dev/null docs/work/db-personalization/profile-account-contract.md`도 함께 실행했고 whitespace 오류 출력이 없음을 확인했다.

### 4. 다음 결정·위험·재현 조건

- 위 8개 승인 항목을 통합/사용자가 확정한 뒤에만 migration/repository/Edge와 UI AuthContext 연결 작업을 발행한다.
- 가장 큰 현재 위험은 (a) 동의 없이도 timestamp가 생성되는 가입, (b) 계정 삭제 UI/server entry 부재, (c) 기존 purge를 먼저 호출할 때 Auth 삭제 실패로 생기는 부분 삭제, (d) account-only repository에서 anonymous를 누락할 가능성이다.
- 재현은 `AuthContext.signUp` metadata, `handle_new_user`의 `coalesce(..., now())`, `purge_account_data`, `supabase/functions/` inventory를 비교하면 운영 데이터 없이 가능하다.
