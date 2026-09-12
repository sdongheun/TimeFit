# RELEASE-DEPLOY-PREP-01 — 배포 준비·종료 경로 최소 보완

2026-09-09. 관계: RELEASE-MINIMAL-FOLLOWUP-01 보완. 명령 작성 / 실행 전.

## 근거와 현행

NATIVE-02는 clock/Extension manifest 및 public Archive 로컬 검증 완료. Development 서명이며 Distribution 자격은 아직 없다. DB-OPS-02에서 delete-account 실제 미배포 확인. API-OPS-02에서 기록 없는 종료가 MyCourses로 연결되는 과거 경로 확인. 따라서 이전 포괄 준비→실제 미배포·예외 경로 발견→기존 함수 배포 준비/배포 서명 준비/현행 종료 경로 최소 보완→새 기능 없이 제출 차단 축소→현행.

AGENTS.md, docs/README.md, 본 문서와 해당 역할 release-*-final.md 최신 인계를 읽는다. 180분/2곳·동의 기반 개인화·앱/LA 공유 상태·guest 격리·표시 디자인·Bundle ID/App Group 유지. 개인화 C/사진/네이티브 manifest 보완을 다시 시작하지 않는다.

이번 범위는 명시한 로컬 구현 및 승인된 접근 범위 내 읽기 전용 준비다. 운영 배포/secret 변경/registry 변경/인증서 생성·취소/프로필 생성/계정 생성·삭제/업로드·온라인 Validate/제출·공개/commit/push는 별도 승인. 준비 완료와 운영 적용을 구분한다.

## 순서

- DB-RELEASE-DELETE-PREP-03과 UIUX 세션은 병렬 가능.
- UIUX는 U-RELEASE-EXIT-03 → U-RELEASE-SIGNING-PREP-03 순서. 같은 세션/공유 파일을 여러 작성자가 동시에 수정하지 않는다.
- 결과를 통합이 검토한 뒤 정확한 delete-account 신규 배포 및 서명 자격 준비 승인을 받는다. 승인이 필요하면 해당 항목만 대기하고 안전한 나머지 준비를 진행한다.
- 문서 URL/registry 연결 이후 승인된 전용 계정 탈퇴1회와 최종 후보 QA. 이번 명령으로 실제 삭제하지 않는다.

## DB-RELEASE-DELETE-PREP-03 — DB 세션

소유: docs/work/db-personalization/release-facts-final.md 후속 절과 필요 시 별도 배포계획 파일. 제품·SQL 변경 없이 기존 함수 배포 승인 묶음을 작성한다.

1. DB-OPS-02의 delete-account 미배포 근거를 재사용한다. 로컬 index/handler/import 전체와 supabase config를 대조해 배포 묶음 hash/파일목록·대상 linked project 일치 확인방법·현재 미배포 상태·인증 설정을 기록한다. 실제 사용자 행과 credential 원문은 읽지 않는다.
2. 호출 클라이언트의 JWT/키 형식과 Edge gateway verify_jwt 설정이 호환되는지 확인한다. 타 함수 설정을 기계적으로 복사하지 않는다. gateway 설정과 함수 내부 getUser/getClaims·최근 password AMR600초·request 멱등·owner 검사를 분리한다. 인증을 약화시키거나 관리자 직접 삭제로 우회하지 않는다. 불일치가 있으면 배포 전에 최소 수정 제안으로 반환.
3. 필요한 secret의 이름/자동 제공 여부/서버 전용 범위만 정리한다. 값 조회·로그·문서·명령행 인자 노출 금지. Supabase service-role이 앱 번들로 이동하지 않도록 한다.
4. 기존 삭제 cascade/재인증/부분 실패 fixture를 확인하고 해당 테스트만 실행. Storage no-op은 현재 업로드 기능 없음과 함께 한계 명시. 신규 Storage 기능·migration·전체 C 재검증 불필요.
5. 승인 가능한 실행 계획을 한 묶음으로 작성: 정확한 프로젝트의 delete-account 함수1개 신규 배포, 필요한 설정 변경의 정확한 항목, 데이터 즉시 삭제0, 성공 시 metadata/인증 거절 경계의 최소 확인, 코드 동일성 증거, 배포 실패/검증 실패 시 중단 및 신규 endpoint 비활성·제거의 영향. 배포 전 운영 상태가 예상과 다르면 중단. 계정 삭제 E2E는 별도 후속임을 명시.
6. anonymous-auth-cleanup/학습 purge는 이 배포와 묶지 않는다. 실제 외부 scheduler 존재 여부와 보관 정책/고지의 불일치만 명시하고, 일정·대상·삭제 상한이 없는 자동 삭제를 생성하지 않는다. plan/log retention 등의 접근 불가 확인은 사용자에게 필요한 화면 항목으로 한 번에 반환한다.

완료: 실행할 정확한 배포 명령/설정/영향/검증/복구가 준비되고 사용자가 승인할 범위가 명확함. 실제 배포·삭제0. API 공통 route-proxy v14 metadata는 재조회 없이 인계 재사용.

## U-RELEASE-EXIT-03 — UIUX 세션, 디자인 변경 아님

소유: CourseConfirmScreen.tsx·ExecutionScreen.tsx 및 관련 화면/네비게이션 테스트. App.tsx/nav/mainTabNavigation은 기본 수정하지 않는다. 필요하면 이유와 영향을 먼저 반환한다.

1. 현행 완료는 기록 성공→기록 탭, 기록 없이 종료→현재 메인 흐름이며, 과거 MyCourses 진입은 현행 주변 탭 전환 결정과 다르다. CourseConfirm의 recorded=false→courses→MyCourses 및 해당 failure CTA를 먼저 실패 테스트로 재현한다. 새 코스 작성/기존 기록 삭제로 재현하지 않는다.
2. 사용자가 기존 실패 UI에서 명시적으로 ‘기록 없이 마치기’를 선택한 경우에만 Home으로 스택 reset한다. 성공은 ActivityRecord로 유지. 자동 저장 실패만으로 코스를 종료하거나 Home으로 보내지 않는다. 재시도·취소/계속 머무르기 기존 행동 유지.
3. 기록 없는 종료의 기존 terminal=incomplete·active 정리·학습 제외/중복 방지 의미는 그대로 둔다. 허위 완료 기록/표본 생성 금지. LA 정상 완료의 기록 성공 경로 변경 금지. 뒤로가기로 종료 코스가 부활하지 않게 검증한다.
4. 공개 종료 분기에서 MyCourses로 더 이상 연결되지 않음을 실제 route/reset 인자로 검사한다. legacy 화면·기존 저장코스/repository·provider를 전역 삭제하지 않는다. 이 한 경로를 닫았다고 모든 legacy 도달 불가 또는 TMAP/ODsay 전송0으로 단정하지 말고 남는 entry를 API에 인계한다.
5. ExecutionScreen의 raw error console 인자를 확인하고 고정 안전 코드로 교체한다. hydration 외 같은 파일 알림/재계산 catch도 해당하면 함께 처리한다. UI 오류 상태/재시도 의미 유지, err/token/좌표/query URL/응답 body 로그 금지. 민감값 포함 합성 오류 fixture로 console 원문 미노출 검증. 실제 유출이 있었다고 주장하지 않는다.
6. typecheck·test:ui·npm test 및 public iOS export 검증. 종료 성공/저장 실패 후 대기/재시도/명시 기록없는 종료/중복 클릭·뒤로가기/LA 성공 경로를 고정 fixture로 확인. 운영 쓰기/시뮬레이터 반복0, 실기기 확인은 최종 후보에 합침.

결과: docs/work/uiux/release-exit-final.md. 이전 방식→문제→현행 교체→이유→상태, 파일/유지계약/테스트/남는 entry 인계. 공개 공급자 문서에서 legacy를 바로 삭제하지 않는다.

## U-RELEASE-SIGNING-PREP-03 — 동일 UIUX·네이티브 세션, EXIT-03 후

소유: 기존 scripts/release-build.cjs·audit-release-artifact.cjs 및 release-build-final.md. 서명 절차 준비만, 인증서/계정 원격 변경 없음.

1. NATIVE-02의 clock/manifest 완료·Development Archive·Distribution0 근거를 재사용한다. 실제 사용 가능한 signing identity/profile은 승인된 로컬 접근에서 유효성/종류·대상 일치만 확인하고 인증서/개인키를 출력/내보내지 않는다.
2. 기존 Apple Developer 개인 계정 Team, main/extension Bundle ID 및 App Group을 유지한다. App Store 배포 자격이 준비되는 방법을 현재 Xcode/Apple 공식 절차로 확인해 사용자에게 최소 단계로 안내한다. 개발 서명 Archive가 export 때 재서명될 수 있다는 점과 실제 export 성공을 구분한다. 반드시 수동 방식만 가능하다고 단정하지 않는다.
3. 자동 서명/수동 프로필 중 프로젝트에 맞는 권장 경로 하나를 근거와 제시하되, 인증서 생성·원격 provisioning 업데이트는 승인받은 후 별도 실행한다. 기존 인증서 취소·Bundle ID 변경·App Group 재생성 금지. 계정 로그인/MFA는 사용자에게 맡기고 비밀번호 요청 금지.
4. 같은 public 환경 wrapper를 유지하는 archive/export 절차를 마련한다. 최종 URL/아이콘/가입 연결 전 산출물은 최종 후보가 아님. build 중복 여부는 Connect 확인 전 미확인으로 남기고 버전 자동 증가 금지. 가짜 profile UUID/credential을 파일에 작성하지 않는다.
5. 준비된 export 옵션은 destination=export로 업로드와 분리하고, 출력 IPA의 distribution signing/get-task-allow·extension/entitlement·manifest·version·endpoint/internal flags를 재검사하는 절차를 적는다. 원격 Validate/업로드는 후속 승인. 스크립트 변경 시 실패 선행 계약테스트/typecheck·UI·core 및 적절한 로컬 번들 검증, 문서만이면 전체 테스트 반복 불필요.

결과: release-build-final.md에 SIGNING-PREP-03 추가. 사용자 실행/승인이 필요한 단계, 나머지 자동화 가능 단계, 최종 후보 진입 조건을 분리. 인증서가 없다는 이유로 동일 Archive를 계속 재생성하지 않는다.

## 이후 승인·수락

통합이 배포1개 승인/서명 자격 준비 승인/사용자 사실/공개 URL 및 registry 연결을 각각 명시한다. 운영 함수 배포만으로 탈퇴 테스트나 모든 로그 보관 검증을 완료 처리하지 않는다. 계정 테스트는 기존 DB-OPS-02 §D의 전용 계정1개 범위를 적용하고 심사 계정과 분리한다. 기존 기능 C는 반복하지 않는다.

기록 없는 종료 목적지 보완은 현행 메인·기록·주변 탭 정책으로의 복구이며 새 화면 기능이 아니다. 중앙 요구사항에서 이 관계를 기록하고 과거 MyCourses 정상 종료 지시를 복원하지 않는다. 위치 문의 답변 전 특례·공개 가능 미확정 유지.
