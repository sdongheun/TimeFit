# U-RELEASE-AGE-01 — 신규 가입 연령 자기확인

2026-09-09. DEC-RELEASE-AGE-01 보완, RELEASE-STAGE-02 AGE 명령 수행. 실제 가입·Simulator 조작 없이 고정 화면 fixture 검증. 공개 문서 게시/registry 연결은 별도 LINKS-01이다.

## 1. 변경 파일 / 이전→문제→교체→이유→상태

이전에는 문서 동의와 입력만 충족하면 연령 자기확인 없이 가입 handler를 호출했다 → 확정된 만14세 이상 가입 대상 확인이 UI에 없었다 → 신규 가입에 기본 미선택 `[필수] 만 14세 이상입니다`를 추가하고 제출 준비 상태와 실제 handler 양쪽에서 차단 → 명시적 자기확인 없이는 신규 가입 요청을 보내지 않기 위함 → 구현 완료, 실기기는 최종 링크 확인에 합침.

- `src/ui/LoginScreen.tsx`: 가입 전용 checkbox 상태·즉시 참조 경계 추가. 선택 해제 후 이전 submit callback도 가입하지 못한다. 모드 전환·blur·취소에서 초기화, 새 mount도 false. 제출 중 변경 금지. 흰 텍스트/파란 체크 배경, 44pt 이상 터치 행, checkbox checked/disabled 접근성 제공. 기존 ScrollView/입력 배치 유지.
- `test/ui/release-age-check.test.mjs`: 실제 LoginScreen을 실행하는 4개 고정 fixture. 미선택·선택·해제·중복 제출·stale callback·필수 문서/동의 누락·입력 오류·모드 전환·blur/focus·새 mount·로그인 CAPTCHA 회귀.
- `test/ui/owned-account-screen-flow.test.mjs`: 기존 정상 가입 fixture에 명시적인 연령 체크만 추가. 요청 payload에 age/birth/timestamp가 없다는 기존 검증 유지.
- 이 문서: 변경과 검증/실기기 인계. 기존 dirty worktree의 다른 변경은 되돌리지 않았다.

## 2. 유지 계약

- 이메일/비밀번호 로그인과 새 CAPTCHA 토큰 소비·모드별 입력/비밀번호 정리·복귀 방식 불변. 로그인 화면에는 연령 checkbox가 없고 추가 확인을 요구하지 않는다.
- 기존 privacy/terms 동의·registry 조회·가입 서비스의 검증을 그대로 거친다. 연령 체크만으로 문서 없는 가입을 허용하지 않는다. signUp payload는 requestId/email/password/requiredConsents 그대로이며 신규 metadata/DB 필드/서버 연령 증거 저장은 없다.
- 이 기능은 **클라이언트 신규 가입 자기확인**이지 실제 연령 인증 또는 서버 우회 방지 보장이 아니다. 생년월일·부모 동의·휴대폰 인증·기존 계정 삭제·guest 전역 차단은 추가하지 않았다.
- AuthContext/service/SQL·개인화·guest 가져오기·추천·LA·nav·공용 정책 문서는 이 작업에서 수정하지 않았다. 중앙 DEC 상태 수락은 통합 세션 담당이다.

## 3. 검증 결과

- 제품 수정 전 fixture를 작성했다. 초회 plain node 실행은 TS 의존 로더 누락으로 실패했으며 이를 제품 결함 재현으로 세지 않는다. tsx 실행 후에는 연령 gate가 없던 이전 제출 조건을 메모리에서 복원하여 미확인/해제 후 signUp 1회(기대0) 실패를 확인했다(`/private/tmp/timefit-age-gate-red.log`). 공유 제품 파일을 되돌리지 않은 반증 검사다.
- 최종 집중 4/4 PASS(`/private/tmp/timefit-age-focus-final.log`). 가입 성공 mock 1회·기존 payload 유지, 연령/문서 미확인0회, 로그인 CAPTCHA 뒤 signIn1회/가입0회 확인.
- typecheck PASS(`/private/tmp/timefit-age-type.log`). 전체 UI/core 최종 결과는 아래 마감값 참조. 초회 core의 새 fixture TS 로더 오류4건은 `tsx/cjs` 명시 등록으로 수정하고 전체 재실행했다.
- 최종 `npm run test:ui`: 711건 중710 PASS·기존1 skip·실패0(`/private/tmp/timefit-age-ui-final.log`). `npm test`: 399/399 PASS(`/private/tmp/timefit-age-core-final.log`). `git diff --check` PASS. **로컬 구현·자동 검증 완료, 최종 링크/실기기 확인 대기**로 인계한다.
- public iOS export PASS(`/private/tmp/timefit-age-export.log`). audit: 파일37, 알려진 서버 전용 값0·개인키 패턴0, 기존 공개 provider alias2 별도 분류. Supabase/CAPTCHA endpoint 입력 포함 확인(값 비출력). JS bundle SHA256 `28fa7f4a425b3fae439de64f68a7b5e5194bdd94deab7a05b56b4b5faa4197e3`.
- 실제 API/가입/DB 쓰기·Simulator·Archive/서명 변경·commit/push0. iOS export를 실기기 가입 성공으로 기록하지 않는다.

## 4. 다음 결정 / 최소 실기기 / LINKS-01 인계

- DOCS-05 공개 문서의 만14세 이상 가입 대상과 이 checkbox가 일치하도록 통합 검토. 실제 URL·DB registry 인계 전 예시 URL 삽입/문서 검증 우회0. AGE 화면과 LINKS 화면 작업은 순차 진행한다.
- 최종 링크 확인 묶음에서: 가입 최초 미선택/해제 시 버튼 비활성, 선택 후에도 필수 문서 동의 필요, 로그인↔가입 및 화면 이탈/복귀 후 미선택, VoiceOver 체크 상태, 작은 iPhone·큰 글씨에서 줄바꿈/스크롤로 항목과 CTA 접근 가능 확인. 기존 로그인에는 추가 연령 요구가 없어야 한다.
- 실제 가입은 별도 승인된 전용 계정 확인 때만 한다. 자기확인 UI가 법적 의무 전체 충족 또는 서버 나이 증거 수집 완료라는 주장은 하지 않는다.
