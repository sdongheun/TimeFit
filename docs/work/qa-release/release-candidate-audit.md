# QA-RELEASE-CANDIDATE-AUDIT-01 — 출시 후보 감사

2026-09-08. 담당 QA·출시. **자동 회귀 PASS / 제출 준비 미완료**. 제품 결함을 고쳐 PASS로 만들지 않았으며, 현재 로컬 입력으로 만든 빌드를 공개 제출용으로 수락하지 않는다.

## 범위와 증거 구분

- 기준: AGENTS.md, docs/README.md, `../integration-decision/release-submission-final.md`, UIUX `final-interaction-wave.md` 최신 인계, `release-three-hour-validation.md` 최종 자동 수락, 기존 `release-preflight.md`.
- 작업 중 공유 worktree에는 여러 역할의 미커밋 변경이 있다. 이번 결과는 검사 시점 worktree 기준이며 고정 Archive/업로드 산출물 인증이 아니다. QA가 기존 변경을 되돌리거나 stage하지 않았다.
- 사용자 FINAL-02 실기기 확인 접수는 통합 문서의 최신 기록을 재사용한다. 새 OS·새 제출용 빌드에서 직접 재검증했다고 주장하지 않는다.
- DB 역할 README 최신 인계는 017 운영 적용·개인화 C 저장/조회/추천/제한 정리 완료를 명시한다. 과거 C 보류 문구를 현행 실패로 재등록하지 않았고 C를 재실행하지 않았다.

## P0 — 제출 차단 및 최소 인계

| 항목 | 확인 근거·현상 | 최소 조치·담당 | 해제 검증 |
| --- | --- | --- | --- |
| 공개 빌드의 internal flag 격리 | `TimeSetupScreen.tsx`, `liveActivity/liveActivityDiagnosticsModel.ts`, `ProfileScreen.tsx`, `CValidationPanel.tsx`, `CValidationRecoveryPanel.tsx`. LA 진단은 dev **또는** exact diagnostics flag로 열리며, C 도구는 exact C flag만 검사한다. 현재 로컬 빌드 입력 분류에서 두 flag 모두 활성이다. Release라는 이유로 닫히지 않는다. | 빌드/통합 소유자가 제출 환경의 `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS`, `EXPO_PUBLIC_C_VALIDATION_INTERNAL`을 비활성으로 고정하고 실제 산출물에서 확인. internal 기능 전체 삭제나 인증 정책 변경 불필요. | 동일 제출용 산출물의 TimeSetup·내정보에서 진단/fixture/C 준비·실행·복구 버튼 없음. false/미설정 fixture와 artifact 설정을 모두 대조. |
| 사용자 확정 표시명·기기 범위 불일치 | 사용자 확정 표시명은 **짜투리**, iPhone 전용. `app.json` name과 생성 `ios/mobile/Info.plist` DisplayName은 mobile. supportsTablet=true, 실제 Release `TARGETED_DEVICE_FAMILY=1,2`. | UIUX/native 빌드 소유자가 app config·생성 target 일치만 최소 수정. 기존 Bundle ID 임의 변경 금지. | 생성 plist 및 최종 Archive DisplayName=짜투리, main/extension 지원 기기 범위 확인. |
| 공개 안내·지원 연결 미완료 | `ProfileScreen.tsx` 앱 안내는 ‘안내 페이지 준비 중’·‘문의 방법 준비 중’인 비클릭 InfoRow. `LoginScreen.tsx`는 registry 문서 2개/버전·동의를 소비하며 문서 미준비 시 가입을 막는다. 공개 URL 게시·연결은 통합 문서상 미승인. | RELEASE-DOCS-02와 통합이 운영자/연락처/공개 페이지 확정 및 게시 승인 → UIUX 링크 연결 → DB 승인 범위 내 registry 버전/URL 연결. 가짜 문서/동의로 우회 금지. | 공개 HTTPS URL·지원 연락처와 앱/가입/Connect 일치. 서버 registry 현재 내용은 이번 감사에서 조회하지 않았으므로 별도 승인된 확인 필요. |

C 패널 노출은 인증 우회가 확인됐다는 뜻이 아니다. 현재 패널은 계정 확인·prepare·receipt·명시 run을 요구한다. 그러나 제출 앱에 내부 검증 작업을 열어두는 것은 별도 위험이며 `cValidationSupabase.ts`의 실제 앱 연결을 통해 테스트 저장을 실행할 수 있는 경로다. 이번에는 runner를 fixture로 대체해 검증했으며 원격 실행은 0회다.

## P1 — 제출 전 확인

| 항목 | 현재 근거·남은 조건 | 담당·검증 |
| --- | --- | --- |
| 버전·서명·OS·아이콘 | config1.0.0, plist1.0.0/build1, 실제 Release main MARKETING_VERSION1.0/build1, deployment17.0. Info.plist의 LSMinimumSystemVersion12.0만으로 지원 OS를 결론내리지 않는다. 아이콘은 assets/icon.png 지정; 최종 사용자 확정 여부 미확인. | native/통합: 최종 Archive main/extension 버전·MinimumOSVersion·서명/프로비저닝·아이콘 일치. 기존 로컬 서명 Release 성공은 Store 업로드 성공 증거가 아니다. |
| 권한·App Group | main/extension App Group 동일, foreground 위치 문구, background location 비활성, NSSupportsLiveActivities. ATS arbitrary loads=false/local networking=true, push entitlement 제거 plugin. | native/출시 문서: 최종 Archive 권한·SDK privacy manifest·App Privacy 선언을 실제 기능과 대조. local networking 허용만으로 개발 서버 접속이 확인된 것은 아니다. |
| endpoint·키 | 로컬 분류상 route proxy 활성, Supabase 클라이언트 키는 publishable. 조사 경계에서 서버 비밀키 명칭/개인키 문자열 미발견. `.env` 원문·URL·키는 기록하지 않음. | API/빌드: 제출 환경 endpoint와 proxy 활성 고정, artifact의 비밀키 부재 확인. 제한적 소스/변수명 감사는 전체 secret scan·침투검사 대체가 아니다. |
| 사진 근거 | `placePhotoModel.ts`는 verified·상업/변경 허용·권리자/출처/라이선스 HTTPS·확인일을 요구하고, `PlacePhoto.tsx`는 미확인/실패 fallback. 실제 카탈로그 소비 및 화면 fixture PASS. | 데이터: `place-photo-recheck.md`는 조사/반영 전 상태. 최종 사진별 근거 인계 후 재검증. ‘약70개 모두 허용’으로 기록하지 않는다. 미확인 사진은 계속 기본 이미지이므로 전부 확보할 때까지 제품을 확장할 필요 없음. |
| 고정 제출 후보 | 공유 작업 진행 중이며 이번에 Archive/export/업로드를 새로 생성하지 않았다. 이전 QA180 export와 FINAL02 로컬 서명 성공은 참고 이력이다. | 통합: P0 최소 보완/최종 데이터 반영 후 후보 고정 → 해당 후보 번들/Archive 검사. 변경 전 자동 PASS를 변경 후 결과로 대체하지 않는다. |

## 실제 경로·공개 계약 감사

- `App.tsx`: Results, LegacyResults, CourseConfirm, MyCourses 등 실제 screen 등록을 확인. `TimeSetupScreen.tsx` → `recommendation/v1Session.ts`의 공개 runner 경로를 검증했다. QA fixture 파일 존재와 사용자 실행 가능성을 구분했다.
- 개발 시계는 `__DEV__` 전용. QA launcher는 dev AND exact flag이므로 Release에서 flag=true여도 숨김. 반면 LA 진단/C 패널은 위 P0의 별도 환경 gate다. 기존 tests의 false/true·미설정·비정확 문자열 조합과 실행형 TimeSetup/C panel 테스트를 재사용했다.
- proxy true에서는 activated factory, false에서는 legacy factory를 선택하고 proxy 실패 시 legacy로 조용히 전환하지 않는 경계를 fixture로 확인. 제출에서는 proxy 활성 확인을 유지한다. 이 경계 시험의 모의 token은 운영 token이 아니다.
- `LoginScreen.tsx`·내정보/계정관리 실제 소비 경로의 로그인/익명 구분, 로그아웃·삭제·계정 전환, guest 기록 가져오기와 계정별 기록 표시, 완료 저장 실패는 기존 실행형/격리 repository 회귀를 재사용했다. 이번 자동 PASS는 실제 서버 계정 삭제/이관을 다시 실행했다는 뜻이 아니다.
- `PlacePicker.tsx`는 GPS 거절/실패에도 검색·지도 수동 선택을 제공한다. 부산 밖 심사자가 부산 출발/목적지를 수동 지정할 수 있는 UI 경계를 검증했다. 해외 네트워크·실제 장소 검색 API 성공은 이번 fixture로 증명하지 않는다.
- 최대180분·최대2곳·익일 원본 날짜 보존·120분 저장 복원·완료/알림 연결은 최신 QA180 수락 및 이번 전체 회귀 유지. 개인화 별도 동의/guest 학습 제외 정책 변경 없음.
- **기존 한계 유지:** 대중교통 예정 출발 시각을 provider에 전달하지 않으므로 미래/익일 실제 운행을 보장하지 않는다. 시간 계산/날짜 보존 PASS와 운행 보장은 별개다.

## 실행 결과

모두 고정 fixture/로컬 검사. 실제 API/운영 DB 호출, Simulator 조작, 계정 생성/삭제 없음.

| 실행 | 결과 | 로컬 로그 |
| --- | --- | --- |
| launcher·LA diagnostics·runtime·internal model·API safety·photo2·계정/auth 화면9파일 (`node --import tsx --test`) | 47/47 PASS | /private/tmp/qa-candidate-focus.log |
| C panel2·unified setup·location search·completion history·guest display·guest repository2, 8파일 (`node --import tsx --test`) | 101/101 PASS | /private/tmp/qa-candidate-boundaries.log |
| npm run test:typecheck | PASS | /private/tmp/qa-candidate-typecheck.log |
| npm run test:ui | 696건:695 PASS/0 FAIL/기존1 skip | /private/tmp/qa-candidate-ui-approved.log |
| npm test | 362/362 PASS, skip0 | /private/tmp/qa-candidate-core.log |
| xcodebuild Release -showBuildSettings | PASS, device family1,2/deployment17.0 확인 | /private/tmp/qa-candidate-build-settings-approved.log |

UI 최초 실행은 tsx IPC listen EPERM으로 테스트 시작 전 실패해 권한 승인 후 같은 명령을 재실행했다. build settings도 sandbox 실패 후 승인 실행했다. 제품 실패로 분류하지 않는다. 집중 결과는 전체 게이트와 중복되므로 합산해 고유 테스트 수로 표시하지 않는다. 기존 skip을 제거하거나 새 skip을 추가하지 않았다.

## P2 — 출시 후 개선

- 공개/내부 빌드 설정을 재현 가능한 별도 검증 계약으로 자동 검사해 flag 누락을 예방한다. 현재 출시 차단 해제는 최소 설정 고정과 실제 산출 확인으로 가능하며 대규모 구조 변경을 선행 조건으로 만들지 않는다.
- legacy/진단 파일의 유지 필요성과 삭제는 실제 진입·호환성을 기준으로 후속 정리한다. 파일 존재만으로 테스트 인증 우회로 판정하지 않는다.

## 완료 인계

1. **변경 파일:** 본 문서만 신규 작성. 제품·테스트·중앙 문서·DB·env 수정 없음. 기존 공유 변경 보존, stage/commit/push0.
2. **유지 계약:** 180분/2곳, 원본 날짜, proxy 실패 경계, 사진 미확인 fallback, 별도 동의 학습, guest/계정 격리, LA 완료/최신 버튼 결정 유지.
3. **판정:** 자동 회귀 통과, 공개 제출은 P0 미해소로 보류. 새로운 기능 결함을 추측해 수정하지 않았다.
4. **다음 담당:** 통합이 P0별 최소 보완을 UIUX/native·빌드·RELEASE-DOCS-02·DB에 배정. 사용자 사실과 게시 승인은 기존 통합 흐름에서만 받는다. 보완 후 고정 후보에서 개발 도구 비노출, 공개 링크/가입 문서 연결, 표시명/지원 기기를 확인한다. 기존 FINAL02 실기기 전체 목록과 개인화 C는 반복 요청하지 않는다. 최종 후보에서만 남는 native 차이는 필요 시 한 묶음으로 요청하며, 이번에는 추가 실기기 조작을 요청하지 않는다.
