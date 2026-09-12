# RELEASE-MINIMAL-FOLLOWUP-01 — 출시 감사 후 최소 보완

2026-09-08. 부모 RELEASE-EXECUTION-WAVE-01 보완, 명령 작성 완료 / 실행 전.

## 판단·변경 이력

5개 준비 작업 완료 보고 → 통합이 BUILD/DB/API/DATA/DOCS 인수인계와 설정·진단 코드를 대조 → 표시명/iPhone/public 환경 및 사진 감사는 재실행하지 않고 native privacy·Archive 경계와 운영 미확인만 후속 분리 → UI/기능 동결과 9/21 전 출시 준비 유지 → 현행.

로컬 public Release는 development 서명이며 Store Archive가 아니다. Extension 진단의 uptime 사용 이유/manifest가 미확정이다. DB 서울 리전은 확인됐지만 계정 삭제 Edge 배포·로그/백업·scheduler 상태는 미확인이다. API도 운영 환경·provider 제한을 원격 확인한 결과가 아니다. 새 제품 결함·법률 위반이 확정됐다고 기록하지 않는다.

## 공통 경계

- AGENTS.md, docs/README.md, 본 문서 및 자기 역할의 release-*-final.md 인계만 우선 읽는다. 공개 정책180분/2곳·개인화/guest·앱/LA 공유 상태·UI 디자인 불변.
- 아래 3작업은 파일 소유 경계가 달라 병렬 가능. Supabase 프로젝트 공통 메타데이터는 DB가 조회·기록하고 API가 재사용한다. 사용자 데이터·키·토큰 원문 조회/출력 금지.
- 승인된 인증의 읽기 전용 설정 조회만 허용. 도구/권한 부족은 최소 설정 화면을 요청한다. 로그 조회라는 이름으로 사용자 행을 읽거나 purge를 실행하는 RPC를 호출하지 않는다.
- 원격 함수 배포·설정/registry 변경·계정 생성/삭제·실제 경로 API 호출·업로드·스토어 검증 서비스로 전송·제출·공개·commit/push는 별도 승인. 이 명령의 전달은 위 작업 승인으로 확대하지 않는다.
- 운영 확인 실패 시 같은 조회를 반복하지 말고 필요한 화면/필드·이유를 한 번에 반환. 보유기간/자격/신고 면제를 추정하지 않는다. 위치 신고 문의는 답변 대기.
- 완료 인수인계는 변경 파일/유지 계약/테스트·근거/미확인·승인 필요 사항을 포함한다. 과거 PASS를 이번 빌드나 운영 성공으로 복사하지 않는다.

## U-RELEASE-NATIVE-02 — UIUX·네이티브 세션

선행: U-RELEASE-BUILD-01 완료. 소유: plugins/live-activity, config plugin, 생성 iOS, scripts/release-build.cjs·audit-release-artifact.cjs, 관련 native/config 테스트. 새 화면/표현 수정 금지.

1. `release-build-final.md`의 privacy manifest 보류 전체를 읽는다. `TimeFitLiveActivityDiagnostics.swift`의 DispatchTime.now().uptimeNanoseconds 호출이 main/extension 중 어디에서 빌드·실행되는지, 다른 required-reason API도 포함해 확인한다.
2. 최신 Apple 공식 required-reason API·extension manifest 규칙을 읽고 실제 목적에 맞게 최소 보완한다. 이벤트 순서/충돌 방지 목적과 공식 reason이 맞지 않으면 단지 통과를 위해 reason을 선언하지 않는다. 불필요한 clock 사용 제거/대체 또는 적합한 manifest resource 연결 중 근거 있는 최소안을 선택한다. 진단 파일 고유성·정렬·동시 작성·기존 읽기 호환성을 유지하고 앱/LA 상태·action receipt 의미는 변경하지 않는다.
3. 실패 재현/계약 테스트를 먼저 추가한다. 원본 plugin과 생성된 main/extension resource·target membership을 맞추고 반복 prebuild에서도 중복/누락이 없는지 확인한다. main manifest가 extension을 자동 대체한다고 가정하지 않는다. 다른 UserDefaults 등의 사용도 누락 없이 대조하되 의존성 전체 업그레이드는 하지 않는다.
4. 기존 public env allowlist·강제 false/proxy true·EXPO_NO_DOTENV 경계를 재사용하는 로컬 `archive` 실행 경로를 준비한다. 일반 Xcode Archive를 public으로 간주하지 않는다. archive/export 옵션·distribution profile 선택·version/build 중복 확인 절차를 명시한다. 자동 인증서 생성/취소, 개발자 계정 원격 수정, 업로드는 금지.
5. 코드 변경 후 typecheck·test:ui·npm test 및 public export/native build를 검증한다. 가능하면 로컬 Archive 생성·내부 plist/manifest/번들/environment·서명을 검사하되 development 서명을 distribution으로 표시하지 않는다. 배포 서명 자격이 없으면 정확한 준비 항목만 남긴다. 아직 URL/최종 아이콘/계정 연결 전이므로 이 산출물을 최종 제출 후보로 선언하지 않는다.
6. 알려진 비밀키 검사는 값 대신 건수로 보고한다. App Privacy 전체 수집항목과 required-reason manifest는 별개임을 유지한다. Apple 온라인 Validate/업로드는 후속 승인 대상이다.

완료 기준: API 사용 목적/manifest 범위에 미해결 추정이 없고, plugin 재생성 및 로컬 번들 검증 PASS, public Archive 재현 절차가 마련됨. 미해결이면 정확한 이유·최소 대안을 반환. 이번 단계 실기기 반복 요청 없이 최종 QA에 변경 영향만 인계.

결과는 `docs/work/uiux/release-build-final.md`에 U-RELEASE-NATIVE-02 절 추가. 기존01 결과 보존. 실행 로그·산출물 식별자·서명 종류·공식 근거/확인일 포함.

## DB-RELEASE-OPS-02 — DB 세션

선행: DB-RELEASE-FACTS-01 완료. 소유: `docs/work/db-personalization/release-facts-final.md`의 후속 절. 읽기 전용 운영 확인과 1회 탈퇴 테스트 계획만 작성. SQL/제품 코드 수정0.

1. 기존 승인 인증/연결 프로젝트를 사용해 사용자 데이터 없이 plan·region, 관리형 Auth/DB/Edge 로그 retention, backup/PITR 실제 보유 설정, 정기 삭제 scheduler 등록/마지막 실행 상태를 확인한다. API가 사용할 공통 메타데이터를 안전하게 인계한다. 키/URL 원문·DB 행·로그 메시지 본문 불필요.
2. delete-account 및 anonymous-auth-cleanup의 배포 유무·버전/배포시각·인증 설정을 확인한다. 배포 ID만으로 로컬 코드와 동일하다고 단정하지 않는다. 동일성 확인에 필요한 hash/빌드 이력이 없으면 이를 구분한다. 실제 삭제 함수는 호출하지 않는다.
3. 익명30일·학습180일 정책은 유효 범위/접근 시 purge/정기 물리 삭제를 구분한다. scheduler 미설정이면 몰래 설정하지 않고 문서에 실제 동작을 인계. 기존 암호화 보호 백업은 재생성/열람/삭제하지 말고 폐기 일정의 사용자 결정 필요만 남긴다.
4. 계정 삭제 최신 소스/fixture42 PASS를 재사용하고 운영 배포와 실제 E2E가 없는 지점을 확정한다. 현재 사용자 업로드가 없다는 근거와 Storage 삭제 no-op의 적용 한계를 명시하며, 사용되지 않는 Storage 삭제 기능을 새로 개발하지 않는다.
5. 전용 계정1개에 대한 최종 테스트 승인 묶음을 작성한다: 공개 문서 registry 준비 후 정상 가입/메일·비밀번호 재인증, 완료기록 최대1/동의·표본 최대1(검증상 필요한 경우만), 필요성이 입증된 저장코스 최대1, 앱 내 탈퇴1회와 해당 owner 삭제 확인. 실제 계정은 승인 이후 지정하고 현 로그인 계정 사용 금지. 삭제된 테스트 계정은 심사 계정과 별개다.
6. 정상 cascade/기기 owner 정리/실패 시 진행 정책을 확인하도록 설계한다. 기존 C 재실행·관리자 우회 삭제·테이블 전체0·모든 백업 즉시삭제를 요구하지 않는다. 실패하면 자동 재시도 없이 같은 요청 상태만 안전하게 확인하고 반환한다. UI 조작은 최종 QA/사용자, 서버 증거는 DB 담당으로 인계한다.

완료 기준: 운영 사실 확인/접근 불가 구분, 공개 고지에 필요한 확정 사실, 배포 보완이 필요하면 정확한 대상과 영향, 실행 전 승인 가능한 1회 탈퇴 검증 범위. 문의 대기를 이유로 나머지를 미완 방치하지 않는다.

## API-RELEASE-OPS-02 — API 세션

선행: API-RELEASE-FACTS-01 완료. 소유: `docs/work/external-api/release-facts-final.md` 후속 절. 읽기 전용 설정·공식 공급자 근거 확인. 제품/운영 수정0.

1. BUILD의 public 입력 경계와 실제 출시 endpoint 소유 프로젝트·CAPTCHA Worker 일치 여부를 승인된 메타데이터로 대조. 값/키를 문서에 노출하지 않는다. 원격 접근이 없으면 필요한 해당 설정 화면만 요청.
2. route-proxy의 배포 버전/인증 설정·snapshot 계약, quota/rate/timeout 구성의 확인 수준을 기록. 보안 secret 내용 열람 없이 가능한 배포 메타데이터만 사용. DB 공통 retention/region 확인은 DB 결과 재사용. 가용성 실제 요청은 수행하지 않고 최종 smoke 1회로 묶는다.
3. Kakao 앱/웹 도메인 제한과 지도 synthetic origin, Turnstile 허용 hostname·Worker 연결 설정을 확인. 권한이 없으면 ‘설정됨’으로 쓰지 않는다. 현재 지도가 동작한다는 실기기 보고와 제출 후보 설정 확인을 구분한다.
4. legacy 화면 등록만으로 공개 도달을 단정하지 않는다. 공개 탭/스택/딥링크/기존 저장코스에서 실제 도달 가능한지 코드를 추적해 근거를 작성한다. 도달 가능 provider는 공개 사실표에 포함하도록 인계하고, 추천 정책/키/legacy 코드를 이번에 제거하지 않는다.
5. Supabase/Cloudflare/Kakao 공식 계약·처리방침에서 법인 주체·연락처·처리 범위·보유 공개 내용을 확인하여 출처/확인일과 함께 문서 담당에게 제공. 법인 소재지를 처리 국가로 대체하거나 ‘서울 DB=전부 국내’로 쓰지 않는다. 공급자가 공개하지 않는 세부사항은 일반 문구로 창작하지 않고 남는 질문만 좁힌다.
6. 운영 경로/API/계정 반복 호출은 금지. 로컬 코드 추적만으로 가용성을 보장하지 않는다. 필요한 최종 확인은 quota 소모·입력 종류·최대 요청 수를 제시해 QA 승인 묶음으로 인계한다. 기존84 PASS를 재실행할 필요는 없으며 새 재현이 필요한 부분만 fixture로 확인.

완료 기준: 실제 확인된 설정/미확인/검증 계획의 분리, 공개 문서에 반영할 추가 사실, 공급자 도달성 결론, 최소 수정이 필요하면 근거와 소유 역할. 후속 자동 배포 금지.

## 결과 후 순서

1. 통합이 위3개 결과와 사용자 결정(아이콘/책임자/가격·category/연령정책/심사 연락·계정/문서 시행일)을 묶어 검토. 미확정값 임의 승인 금지.
2. 출시 문서 세션은 새 기능 조사 없이 확정된 추가 사실만 DOCS-03에 후속 반영. 게시 승인을 얻은 뒤 기존 RELEASE-LINKS-01로 진행.
3. 운영 배포가 실제 필요하면 정확한 대상/이전상태/영향을 제시하고 별도 승인. registry 준비 및 전용 계정 승인 후 계정 생성→탈퇴1회 검증을 최종 QA와 합침.
4. 공개 URL/최종 asset 연결 이후 동일 public 경계로 최종 distribution Archive 고정→QA-RELEASE-FINAL-01→별도 심사 제출 승인. 법적 공개 조건은 위치 문의 답변과 별도 확인.

이번 통합 인계: 작업 문서·색인만 변경. 제품/원격 작업0, diff check로 문서 검증. 명령 작성은 작업 실행 완료나 공개 승인 의미가 아니다.
