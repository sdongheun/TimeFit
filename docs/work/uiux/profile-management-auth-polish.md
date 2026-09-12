# U-PROFILE-AUTH-POLISH-02 — 프로필 관리 화면·혜택 안내·기록 제목·입력 격리

2026-09-08 사용자 요청·구현 전. UIUX 단일 세션 실행. AGENTS.md, docs/README.md, UIUX 공통 규칙 UX-COLOR-01, 본 문서를 읽는다. ProfileScreen/LoginScreen/ActivityRecordScreen/AccountPersonalizationPanel 및 기존 프로필 저장·조회 서비스 계약을 먼저 확인한다.

## 관찰과 교체 이력

- ProfileScreen은 showManagement로 같은 카드 안을 전환하고 `닉네임 설정하기`를 중복 표시한다 → 사용자가 별도 관리 페이지/단순 진입 요구 → 진입 버튼 하나와 별도 관리 화면 → 목적 구분 → 구현 전.
- 비로그인 상태 설명 위주 → 로그인 가치가 드러나지 않음 → 실제 조건에 맞는 맞춤 추천 혜택 문구 → 가입 강제 없이 가치 전달 → 구현 전.
- 기록 제목은 고정 `나의 자투리 기록` → 이름을 반영하지 않음 → 로그인 계정의 유효 닉네임일 때만 이름 표시 → 개인 기록 인지 → 구현 전.
- LoginScreen은 isSignUp만 바꾸면서 같은 email/password state를 사용 → 로그인/가입 입력 공유 → 모드별 폼 격리 → 의도치 않은 자격정보 복사 방지 → 구현 전.

## 1. 내정보와 프로필 관리 분리

- 로그인한 내정보의 `닉네임 설정하기`와 반복 설명을 제거하고 `프로필 관리` 진입 버튼만 둔다. 권한/맞춤 추천 동의/앱 안내는 기존 위치와 기능을 유지한다.
- 버튼은 별도 프로필 관리 화면으로 navigation push한다. inline showManagement 방식은 교체한다. 상단 safe area 아래 제목/뒤로가기, 세로 순서는 **닉네임 변경하기 → 계정 삭제 → 로그아웃하기**. 닉네임 입력/저장은 기존 profile 편집을 재사용한다. 별도 화면 안에 불필요한 중간 페이지를 추가하지 않는다.
- 화면 전환은 앱의 기존 stack 규칙, 탭 전환은 기존 즉시 전환 규칙을 따른다. App.tsx/nav.ts는 이 작업의 단일 UIUX 작성자로만 필요한 route 등록을 수정하며 다른 세션과 동시 편집하지 않는다.
- 계정 삭제는 기존 OwnedDeletionPanel의 최근 재인증/확인/실패·재시도/소유권 정리를 유지한다. 라벨 변경 때문에 모든 요청을 즉시 성공 처리하지 않는다. 로그아웃 성공 또는 계정 소멸 시 관리 화면을 닫고 비로그인 내정보로 안전 복귀한다. 뒤로가기로 이전 계정 정보가 다시 나타나면 안 된다. 실패 시 화면과 재시도 유지, 연타 방지.

## 2. 비로그인 안내

- `로그인하지 않고 이용 중`, `권한과 앱 안내는 로그인 없이 확인할 수 있습니다.`를 제거한다.
- 대체 문구: **`로그인하고 체류 기록에 동의하면, 쌓인 기록으로 나에게 맞는 추천을 받을 수 있어요.`** 로그인 CTA는 유지한다. 주변 설명과 동일 문장이 반복되면 한 곳으로 정리하되 실제 동의 항목의 조건 설명은 없애지 않는다.
- 로그인만으로 자동 개인화/즉시 학습이 완료된다고 표현하지 않는다. 기존 회원+별도 동의+유효 표본 조건은 불변이다. 비로그인의 길찾기/Live Activity/권한 접근을 막거나 가입 강제 모달을 추가하지 않는다.

## 3. 기록 제목

- 로그인 계정에 저장된 유효한 닉네임이 있으면 **`{닉네임}님의 자투리 기록`**, 비로그인·미설정·빈 문자열·조회 실패/로딩이면 **`나의 자투리 기록`**.
- 이메일 앞부분/사용자 ID를 닉네임으로 추정하지 않는다. 개인화 동의 여부와 닉네임 표시는 독립이다. 기존 프로필 조회/저장 경계를 재사용하며 별도 동의가 없어도 로그인 계정 닉네임은 표시할 수 있어야 한다.
- 닉네임 저장 성공 후 기록 탭 복귀 시 갱신한다. 계정 전환/로그아웃 즉시 이전 이름을 제거하고 늦게 도착한 이전 계정 조회가 새 제목에 적용되지 않게 한다. 긴 닉네임/큰 글자 줄바꿈을 허용하고 제목 잘림/겹침을 방지한다.
- 닉네임의 기존 선택·trim·1~20자·제어문자 금지 검증은 그대로다. 기록 집계·카테고리 필터·삭제·개인화 표본 정책 변경0.

## 4. 로그인/회원가입 입력 격리

- 로그인 폼과 가입 폼의 email/password/confirm/errors/touched를 분리한다. 모드 변경으로 값을 복사하지 않는다. 처음 가입으로 전환하면 가입 폼은 빈 값이며 반대도 동일하다. 같은 모드로 돌아왔을 때 이메일은 해당 모드 메모리 값만 유지 가능, 비밀번호/확인은 모드를 떠날 때 지운다. 폼 이탈/인증 완료 시 민감값 정리, 저장소·로그·route params에 비밀번호 저장0.
- 자동완성은 OS의 사용자 선택과 앱 state 공유를 구분한다. 이를 막겠다고 비밀번호 관리자 기능을 무조건 끄지 않는다.
- 모드 전환 시 이전 모드 오류/CAPTCHA 대기/요청 callback이 새 모드에 반영되지 않게 한다. 제출 중 전환은 기존 잠금 규칙 유지. 약관 동의·문서 버전·signup requestId 재시도·CAPTCHA·중복 제출·뒤로가기 계약은 손상시키지 않는다. 모드와 payload가 항상 일치하는지 검증한다.

## 검증·완료

실패 fixture부터 추가: 관리 진입 실제 route/뒤로가기, 로그아웃 실패/성공·관리 중 계정 변경, 기존 탈퇴 재인증/정리 대기, 닉네임 없음/저장/재방문/긴 이름/조회 실패/이전 계정 late 응답, 미동의 회원 이름 표시, 로그인↔가입 입력 교차0·password 정리·약관/CAPTCHA/요청 격리.

typecheck, test:ui, npm test, diff-check, iOS export를 실행한다. 실기기 최소 확인은 화면 전환/키보드·폼 전환/닉네임 표시/삭제 확인 취소로 인계한다. 실제 계정 탈퇴·운영 데이터 삭제·운영 API 반복·C 재검증·commit/push0.

소유 경계는 UIUX 및 관련 테스트다. DB·프로필 스키마·서비스/인증 정책을 바꿔야 한다면 직접 변경하지 않고 필요한 계약과 근거를 해당 역할에 인계한다. 변경 파일·목적 / 유지 계약 / 테스트 결과 / 남은 위험·실기기 조건을 본 문서에 기록한다. U-HISTORY-FINAL-03은 사용자 완료 보고이며 이번 작업이 이전 작업 전체 검증 수락을 대신하지 않는다.

## 완료 인수인계 — 2026-09-08

### 1. 변경 파일·목적

- `src/ui/ProfileScreen.tsx`: 중복 닉네임 안내와 inline showManagement/로그아웃을 제거하고 `프로필 관리` 진입 하나를 남겼다. 비로그인 안내는 확정된 로그인+별도 체류 기록 동의 혜택 문구로 교체했다. 권한 영역의 반복 혜택 문장은 줄이고 비로그인 길찾기/실시간 현황 접근 안내는 유지했다.
- `src/ui/ProfileManagementScreen.tsx` 신규, `App.tsx`, `src/ui/nav.ts`: 독립 stack 화면을 등록했다. safe area 아래 뒤로가기/제목과 닉네임 변경하기(기존 편집 재사용)→계정 삭제→로그아웃하기 순서다. 같은 UIUX 작성자로 필요한 route 등록만 수정했고 탭 animation:none 계약은 변경하지 않았다. 로그아웃은 ref 잠금/안전한 실패 문구/재시도이며 성공·계정 소멸·계정 변경 시 Profile로 stack reset하여 이전 관리 화면을 남기지 않는다. 이전 계정의 편집 영역은 render 단계에서 즉시 숨긴다.
- `src/ui/OwnedDeletionPanel.tsx`: 선택적인 계정 버튼 표시명만 추가했다. 새 화면에서 `계정 삭제`로 표시하며 기존 perform/재인증/정리/실패·동일 요청 재시도 로직은 그대로다.
- `src/ui/profileDisplayModel.ts`, `src/ui/useRecordTitle.tsx` 신규 및 `src/ui/ActivityRecordScreen.tsx`: AuthContext의 일반 accountSession을 기준으로 기존 프로필 repository를 조회한다. 조회 전/후 resolver와 화면 focus 수명 guard를 확인하며 제목 state는 subject로 구분한다. 유효한 nickname만 표시하고 null/빈값/실패/로딩/로그아웃/계정 전환에는 기본 제목을 사용한다. 기존 1~20 codepoint/NFC/trim/제어문자 금지에 맞춘 **표시 검증만** 수행하며 저장 검증은 서비스에 남겼다. 제목에 줄 수 제한은 추가하지 않았다.
- `src/ui/AccountPersonalizationPanel.tsx`: nickname 저장 updated/unchanged 성공 뒤 UI 갱신 알림을 발행한다. 알림에는 subject만 전달하고 닉네임 cache/저장소를 새로 만들지 않는다. 프로필 저장 문구를 `닉네임을 저장했어요.`로 구분했다. 기록 focus 재진입과 성공 알림 모두 기존 조회 경계로 다시 읽는다.
- `src/ui/LoginScreen.tsx`: login/signup 각각 email/password/confirm/failure/error/touched 메모리 state를 둔다. 모드를 떠날 때 해당 비밀번호·확인·오류·touched를 지우고, 화면 blur/취소/인증 완료에도 민감 입력을 정리한다. 해당 모드 이메일만 유지하며 복사하지 않는다. mode switch는 attempt 세대를 바꾸고 CAPTCHA를 정리하며 제출 중에는 차단한다. signup 비동기 응답도 attempt/focus guard로 새 화면·새 모드에 적용하지 않는다.
- `test/ui/profile-auth-polish.test.mjs` 신규, `test/ui/profile-settings-screen.test.mjs` 보완 및 본 문서. 제품 코드와 작업 문서 외 중앙 문서/보드/다른 세션 변경은 건드리지 않았다.

이력: inline 프로필 카드·중복 안내·고정 제목·공유 auth 입력(이전) → 별도 관리/개인 제목/입력 교차0 요구 → 독립 관리 route·혜택 문구·소유 계정 프로필 조회·모드별 폼(현행 구현). 이전 inline/입력 공유 방식은 철회이며 복원하지 않는다. 사용자 실기기 수락은 아래 별도 대기다.

### 2. 유지한 계약

- profile repository의 선택 nickname/null 삭제/중복 허용/normalize·길이 검증/mutationId 계약 유지. DB schema/서비스 소유 파일/프로필 저장 정책 변경0. 이메일 앞부분·metadata·ID로 이름을 추정하지 않는다. 개인화 동의와 이름 표시는 독립이다.
- 일반/익명 인증 분리, 새 CAPTCHA token·signIn 옵션, CAPTCHA 취소/만료·중복/늦은 응답 차단, 필수 두 문서/버전/체크·signup requestId 재시도·서버 이메일 확인을 유지했다. 비밀번호 관리자 기능을 차단하지 않았으며 비밀번호/토큰/계정 원문을 로그·route params·저장소에 추가하지 않는다.
- 탈퇴 최근 재인증·확인·서비스 결과·pending cleanup·소유권 기반 진행 정리와 개인정보 계약 불변. 계정/guest 기록 집계·격리·필터·삭제·추천/학습·Live Activity·기기 권한 계약도 변경하지 않았다.
- 실제 계정 생성/탈퇴/운영 데이터 삭제·운영 API 반복·C 검증·Simulator·commit/push0. UI 관리 화면의 로그아웃 fixture만 사용했다.

### 3. 검증 결과

- 실패 선행: signup 최초 진입에서 로그인 email이 그대로 남는 실패(`login@example.test` != 빈 값), Profile 중복 안내/독립 route 부재를 실제 production 화면 handler fixture로 확인한 뒤 수정했다.
- 집중 회귀: 모드별 email 격리·departing password/confirm 정리·이전 오류 비노출·blur 정리, 별도 관리 진입/뒤로가기/순서·계정 삭제 panel 재사용·로그아웃 연타/실패/성공·관리 중 계정 변경, 닉네임 선택/빈값/긴 값/제어문자·loading/조회 실패/이전 owner late 응답·저장 성공 알림을 검증했다. 기존 CAPTCHA token 전달·안전 오류 분류·signup 필수 동의/같은 요청·탈퇴 재인증/소유권 회귀도 통과했다.
- 초기 UI 전체는 통과했고, npm 전체에서 신규 mjs의 TS ESM import 확장자 오류가 발생하여 기존 tsx CJS 로더와 createRequire 방식으로 테스트 연결만 보완했다. 테스트 실행 환경 오류를 제품 인증 실패로 해석하지 않는다.
- 최종 자동 검사 수치/로그는 아래 확정 항목에 기록한다. iOS export는 JS 번들 검증이며 실제 키보드/stack/인증 SDK 실기기 확인을 대체하지 않는다.
- 최종 확정: `npm run test:typecheck` 통과, `npm run test:ui` **624건 중623 통과·기존1 skip·실패0**, `npm test` **291/291 통과**, `git diff --check` 통과, `CI=1 npx expo export --platform ios --output-dir /private/tmp/timefit-profile-auth-ios` 통과. 로그 `/private/tmp/timefit-profile-auth-{typecheck,ui,all,export}.log`, 산출물 `/private/tmp/timefit-profile-auth-ios`. 네이티브/실기기 테스트는 실행하지 않았다.

### 4. 남은 위험·최소 실기기 확인

1. 로그인 내정보에 프로필 관리 버튼 하나만 표시되는지, 새 화면의 뒤로가기와 닉네임 변경→계정 삭제→로그아웃 순서, 작은 화면/큰 글자의 safe area와 줄바꿈을 확인한다.
2. 본인 계정 nickname 저장 후 기록 탭 재방문 시 이름 반영, nickname 비우기 시 기본 제목, 로그아웃·다른 계정 로그인 시 이전 이름이 남지 않는지 확인한다. 이름 표시를 위해 체류 기록 동의를 켤 필요는 없다.
3. 로그인/회원가입에서 서로 다른 이메일 입력 후 모드를 왕복하여 각 이메일만 유지되고 비밀번호/확인은 비워지는지, 키보드·OS 자동완성의 사용자 선택과 앱 상태 공유를 구분해 확인한다. 제출/CAPTCHA 중 모드 전환 잠금도 확인한다.
4. 계정 삭제 버튼은 **확인창을 열고 취소만** 한다. 실제 탈퇴/운영 삭제는 이번 확인에 필요하지 않다. 로그아웃 실패의 연결 안내 및 성공 후 비로그인 내정보 복귀를 확인한다.

자동 fixture만으로 실제 키보드 자동완성·글자 크기별 배치·native stack 제스처·실계정 재인증을 수락한 것으로 표시하지 않는다. 새로운 DB/API 계약 요청은 없다. 이전 U-HISTORY-FINAL-03의 확인 범위는 확대하지 않았다.

## 사용자 시각 보완 — 뒤로가기·저장·관리 버튼 (2026-09-08)

이전 작은 문자형 뒤로가기/입력과 비슷한 저장 버튼/왼쪽 정렬 텍스트 행동 → 사용자 크기·식별성 보완 요청 → 28pt chevron/파란 저장/중앙 테두리 행동 → 터치 대상과 위계 구분 → 현행 구현. 아래는 기존 기능 계약을 바꾸지 않는 시각 보완이다.

1. **변경 파일·목적:** `ProfileManagementScreen.tsx` 뒤로가기를 기존 Feather 28pt chevron-left(최소44pt 터치)로 교체했다. 로그아웃을 52pt 높이/12pt radius/1pt C.line 테두리/C.bg 배경/중앙 정렬로 변경했다. `AccountPersonalizationPanel.tsx` nickname 입력은 패널색·16pt 글자·52pt 높이, 저장은 같은 높이의 C.accent 파란 배경/중앙 흰색 `저장`으로 구분했다. 다른 동의 버튼 스타일은 유지했다. `OwnedDeletionPanel.tsx`는 account 행동에만 로그아웃과 같은 테두리/높이/어두운 배경/중앙 정렬을 적용하고 삭제 경고색은 유지했다. 계정 기록 전체 삭제·행 삭제 스타일은 바꾸지 않았다.
2. **유지 계약:** nickname 저장·동의·탈퇴 확인/재인증/동일 요청·로그아웃/계정 격리·오류/로딩 잠금·경로는 변경하지 않았다. API/DB/개인화/Live Activity·중앙 문서/보드 변경0. 운영 삭제/Simulator/commit/push0.
3. **검증:** 기존 `닉네임 저장`과 새 `저장` 기대값의 실패 fixture부터 실행했다. 저장 배경/중앙 정렬, 뒤로가기28pt, logout/account deletion 테두리·배경·중앙 정렬을 실제 컴포넌트 fixture에서 검증했다. 테스트 실패 시에도 profile observer가 정리되도록 테스트 cleanup도 보완했다. 전체 자동 검사 결과는 아래 확정 항목에 남긴다.
4. **실기기 최소 확인:** 뒤로가기 크기와 터치, 입력창과 파란 저장 버튼의 식별성, 긴 nickname/큰 글자의 버튼 중앙 정렬, 두 어두운 테두리 행동의 높이/간격을 확인한다. 계정 삭제는 확인창을 열고 취소만 하며 실제 탈퇴는 필요하지 않다. 실제 화면 캡처/시각 수락은 아직 수행하지 않았다.

자동 확정: typecheck 통과, UI **624건 중623 통과·기존1 skip·실패0**, 전체 **291/291 통과**, diff check 및 iOS export 통과. 로그 `/private/tmp/timefit-profile-buttons-{typecheck,ui,all,export}.log`, 산출물 `/private/tmp/timefit-profile-buttons-ios`.

## 작업 마감 — 2026-09-08

사용자의 순차 실행 지시에 따라 U-PROFILE-AUTH-POLISH-02의 구현·자동 검증을 마감하고 U-RELEASE-180-01로 이동한다. 위 실기기 미확인 항목을 임의로 수락 처리하지 않는다. 이후 180분 작업에서 프로필/인증 파일은 수정하지 않으며 두 작업의 파일 편집을 병행하지 않는다.
