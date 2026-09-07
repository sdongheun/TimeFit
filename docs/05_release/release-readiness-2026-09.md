# TimeFit 출시 검증·문서 실행계획 — 2026-09-07

상태: 준비 착수, 심사 제출/공개 배포 미승인. 목표는 2026-09-21 전 공개이며 심사 소요/승인을 보장하지 않는다. 9/12 기능 동결 판단, 9/14 전후 최초 제출 준비를 목표로 한다. 통과하지 않은 개인정보·보안·핵심 기능은 일정 때문에 생략하지 않는다.

## 범위와 이력

현행 사용자 결정(2026-09-07): [DEC-RELEASE-PERSONALIZATION-01](../work/integration-decision/release-personalization-account.md)에 따라 제한적 서버 체류 개인화를 출시 범위에 포함한다. 계정·동의·기록 격리와 감사 결함 해결이 선행이다. 구현/검증 전이며 기능 완료로 광고하지 않는다.

아래 기존 감사 명령의 개인화 보류 문구는 감사 당시 이력으로만 보존한다. 새 개인화 구현을 금지하는 현행 지시가 아니며, 감사 결과가 확장 후 상태까지 증명하지도 않는다. 구현 뒤 데이터 사실표와 출시 회귀를 갱신한다.

이전: Live Activity/개인화 기능 확장 중심 → 관찰: 핵심 동작 확인 뒤에도 공개 문서·Release 안정성·계정 게이트 미확인 → 교체: 기능 동결, 실제 데이터 감사와 출시 회귀 우선 → 이유: 배포 일정과 사용자 데이터 안전성 확보 → 상태: 현행 준비 계획.

## 실행 순서와 담당

최신 구현 순서와 복사용 명령은 [출시 개인화 Wave](../work/integration-decision/release-personalization-wave.md)를 따른다. 아래 1~3의 사전 감사는 수행 완료 이력이며, 확장된 기능의 계정/저장/추천 연결과 재검증을 생략하는 지시가 아니다.

1. **병렬 가능:** QA의 Release 사전 감사(QA-RELEASE-PREFLIGHT-01), DB/API 담당의 데이터 흐름 감사(RELEASE-DATA-AUDIT-01). 모두 읽기/fixture 중심이며 기능 변경 없음. 단일 작성 파일/동일 build output을 공유하지 않는다.
2. 통합 세션이 감사 결과로 개인정보 처리방침·지원 안내·App Privacy 응답·심사 메모 초안을 작성한다. 운영자/연락처/공개 URL/보유기간 미확정은 표시하고 임의로 채우지 않는다.
3. 발견된 제출 차단 결함만 소유 역할에 구현 명령. 계정 노출 범위, iPad 지원 변경 등 제품 선택은 사용자 결정 뒤 적용한다.
4. 동일 최종 Release artifact에서 최소 실기기·TestFlight 검증. 자동 fixture로 되는 테스트를 사용자에게 반복시키지 않는다.
5. 문서 공개·앱 링크·스토어 입력·서명된 Archive 검증 뒤 사용자의 제출 승인. 원격 게시/서명 변경/업로드/제출은 이 계획만으로 실행하지 않는다.

## 필요한 산출물

| 문서/산출물 | 최소 내용 | 완료 기준 |
| --- | --- | --- |
| 데이터 처리 사실표 | 항목→수집 entry→기기/서버/제3자→목적→계정 연결→보유/삭제→코드 근거 | 정책상 계획과 실제 구현 분리 |
| 개인정보 처리방침 | 운영자·문의, 실제 처리 항목/목적/위탁·이전 여부/보유·삭제/권리 행사 | 사실표와 일치, 공개 URL 접근, 앱/Connect 연결 |
| 위치 관련 안내·약관 적용 검토 | 현위치/수동 좌표·서버 전송·저장 흐름에 대한 적용 의무 | 관할/전문 검토 필요 사항 식별, 추정 면제 금지 |
| 사용자 지원 페이지 | 지원 이메일, 기본 사용법, 부산 서비스 범위, 문제 신고 | 로그인 없이 공개 접근 |
| App Privacy 작성표 | SDK 포함 데이터 종류/목적/연결/추적, 근거 | 로컬 전용과 서버 전송 구분, 실제 Connect 답변 대조 |
| 심사 메모 | 부산 수동 출발/목적지, 현재 시각 사용, 핵심 기능, 외부 지도, 권한 거절 대안 | 개발 QA 버튼 없이 재현, 필요한 심사 계정은 안전 전달 |
| 스토어 메타데이터 | 표시명·설명·키워드·분류·연령등급·지원 URL·실제 스크린샷 | 미구현 개인화 광고 없음, 지원 기기와 일치 |
| 최종 Release 증거 | build/commit, 자동 결과, 실기기 결과, 잔여 결함 | 항목별 PASS/FAIL/미확인, 제출 차단0 |

일반 서비스 이용약관이 모든 앱에 동일하게 필수라고 단정하지 않는다. 개인정보 공개와 실제 위치/계정 기능에 적용되는 의무를 분리해 확인한다. 이 문서는 법률 검토를 대신하지 않는다.

## QA 세션 명령 — QA-RELEASE-PREFLIGHT-01

```text
현재 출시 사전 감사를 수행해. AGENTS.md, docs/README.md, 본 문서와 출시준비_체크리스트.md 현행 절을 읽어. Live Activity 서버 개인화 확장은 보류다. 보고서는 docs/work/qa-release/release-preflight.md에 작성해.
1. 기존 QA 인수인계의 관련 결론만 재사용하고 전체 archive를 순회하지 마. 최근 변경 기준 build/commit/dirty 상태를 기록해. 미확인 사실을 완료로 추정하지 마.
2. npm run test:typecheck, npm run test:ui, npm test를 실행해. 테스트 수/skip/실패를 보존하고 기존 발견 범위가 축소되지 않았는지 확인해. 네트워크 없는 fixture를 우선하고 제품 코드는 수정하지 마.
3. 일반 production 경로에서 시간/수동 위치→추천1/2곳→선택취소→코스/지도→길찾기→도착/출발→완료1건→기록, 주변 둘러보기·권한 거절·네트워크 실패·빈 결과·재실행을 기존 자동 테스트와 매핑해. 빠진 반례만 추가하고 구현을 바꾸어 합격시키지 마.
4. app.json/생성 native를 대조해 앱 이름 mobile, iPad 지원, 실제 최소 OS, main/extension 버전·서명, debug/QA/진단 화면의 배포 비노출, 테스트 계정/고정 시각/fixture 누출을 감사해. Live Activity foreground 사전 준비가 실제 handoff 성공 기록과 분리되는지도 점검해. 미확인 수정 권한은 요청으로 반환해.
5. Release JS 번들·native/SDK privacy manifest/required reason API·배포 Archive/export compliance·스토어 자산 준비 여부를 검사해. 기존 evidence와 새 실행을 구분해. prebuild/Archive가 다른 세션 파일을 바꾸면 먼저 조정하고 동시에 같은 DerivedData로 빌드하지 마.
6. 자동화로 대체 못 하는 실제 지도/카카오 설치·미설치/권한/Live Activity/콜드 복귀만 짧은 사용자 체크리스트로 남겨. Simulator 수동 순회/운영 API 반복/앱 삭제 금지. 현재 성공한 Live Activity 흐름을 다시 전부 미확인으로 취급하지 마.
7. P0 제출 차단/P1 출시 전 권장/후속 개선으로 분류하고 파일 근거·재현·담당·합격조건을 남겨. 사용자 데이터/키 출력, 원격 배포·게시·제출·commit/push는 하지 마. 변경 파일/유지 계약/테스트/남은 위험으로 인계해.
```

## DB/API 역할 명령 — RELEASE-DATA-AUDIT-01

```text
출시 데이터 처리 사실표를 읽기 전용으로 감사해. AGENTS.md, docs/README.md, docs/05_release/release-readiness-2026-09.md를 읽어. 서버 체류 개인화는 이번 출시 준비에서 보류다. 결과는 docs/work/db-personalization/release-data-audit.md에 작성해.
이메일/생년월일/사용자 ID/anonymous Auth/현위치·수동 좌표/코스·후기·완료기록/체류/진단/SDK 데이터별 실제 처리 entry, 기기 저장, 서버 및 외부 수신자, 계정 연결, 보유/삭제, 코드 근거를 표로 작성해. 안 쓰는 모델 필드만 보고 수집 중이라고 결론내리지 마. 로컬 기록이라고 외부 route 전송까지 없다고 쓰지 마.
공개 가입/로그인·계정 삭제 연결, guest 기록·로그아웃·계정교체 분리, RLS·원격 삭제·백업/로그 보유 확인 여부를 점검해. 임의 보유기간/삭제 완료/서버 region을 만들지 마. 운영 데이터 조회나 migration 실행 없이 확인 가능한 범위만 하고 원격 확인 필요를 분리해.
Live Activity 서버 표본·업로드 큐·개인화 적용이 실제로 꺼져 있는지, 원시 시각의 terminal 정리와 진단 상한을 확인해. 제3자 지도/검색/사진 사용 및 캐시 약관은 실제 사용 provider별 공식 기준과 대조할 필요 항목을 남겨. 비밀 env 값과 실제 사용자 데이터는 읽어 출력하지 마.
제품/DB/정책 변경·원격 쓰기·테스트 계정 생성·commit/push 없이 사실/미확인/사용자 결정으로 인계해. 개인정보 처리방침을 아직 최종본으로 선언하지 마.
```

## 사용자 결정·입력 필요

- 공개 운영자 표기와 지원 이메일, 개인정보/지원 페이지를 게시할 위치.
- 최종 앱 표시명(TimeFit 여부), iPhone 전용 여부(현재 iPad 지원 켜짐).
- 첫 출시 계정 기능 유지 범위는 감사 결과 뒤 결정. 계정 생성을 제공하면 앱 내 삭제 게이트를 확인한다.

## 공식 출처 — 2026-09-07 확인

- https://developer.apple.com/app-store/review/ : 개인정보 및 지원 링크, 심사 정보.
- https://developer.apple.com/app-store/review/guidelines/ : 실제 기능·개인정보·계정 정책.
- https://developer.apple.com/support/offering-account-deletion-in-your-app/ : 계정 생성 제공 시 앱 내 삭제.
- https://developer.apple.com/app-store/app-privacy-details/ : SDK 포함 App Privacy 공개.
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy : 개인정보 URL/Connect 관리.

최종 제출 직전에 공식 요건을 다시 확인한다. 앱 미완성 문구/비공개 URL/접근 불가 심사 계정은 준비 완료로 표시하지 않는다.
