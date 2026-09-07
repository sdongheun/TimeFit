# DEC-LIVE-LOCAL-FIRST-01 — Live Activity 단계별 실행

2026-09-06 사용자 요청에 따른 실행 순서. 상위 기능 정책은 DEC-LIVE-DWELL-01을 유지한다. 관계: 구현 순서 보완, 수집 동의 완화 아님.

이전 DB·엔진·native를 한 번에 연결 → DB 미구현으로 기기 기능까지 대기하고 OS 제약 검증이 늦음 → 기기 기술 검증/로컬 진행/제한 QA 후 서버 개인화 연결 → 빠른 체감 검증과 개인정보 경계 분리 → **현행 실행 계획**.

## 순서

1. **U-LIVE-ACTIVITY-01 A: 기술 경계 검증.** iOS17 target/Extension/App Group/bridge를 재생성 가능하게 구성하고 fake 1곳 snapshot으로 foreground와 실제 Kakao handoff 후 Activity 시작 가능성을 확인한다. React 중단 중 Intent/알림 action 처리도 검증한다.
2. **같은 작업 B: 로컬 진행 구현.** A의 시작 경계가 검증된 후 기존 run/controller와 native durable state를 연결한다. 서버 체류 표본 전송0·동의 토글/개인화 적용0이다.
3. **QA-LIVE-LOCAL-01:** 고정 fixture 자동 게이트 후 사용자가 잠금화면·handoff·재실행·1/2곳 순서를 제한 확인한다. 별도 DB migration/로그인 계정 없이 가능하다.
4. **서버 개인화 후속:** DB-DWELL-01 동의/저장/삭제/보유 계약 승인·구현 → U-LIVE-ACTIVITY-01 서버 연결 → 기존 QA-LIVE-ACTIVITY-01 전체 검증. `2-AB`는 구현됨·provider/DB 연결 전이며 새로 구현하지 않는다.
5. **출시 준비:** 실제 구현을 기준으로 약관/개인정보/문의 페이지·가입 동의·계정 삭제 등 보류 항목 마감과 출시 최종 QA. 기기 기능 수락은 공개 배포 승인과 다르다.

## 로컬 단계 불변

- 일반 로그인·guest·anonymous 모두 기기 진행 사용 가능. 개인화를 위한 신규 서버 전송·표본 큐·미동의 기록 나중 업로드 금지.
- 기존 로컬 완료 이력은 유지하되 신규 exact 도착/출발 시각은 활성 진행 복구에만 사용한다. 종료 뒤 식별 가능한 시각을 별도 분석 이력으로 축적하지 않는다. 완료 controller에 실제 분을 연결하는 경우 기존 공개 input 범위만 쓰고 중복 저장하지 않는다.
- 최신 1/2곳 최적 방문 snapshot과 단일 코스 review/active 화면, handoff 성공 기준, 명시 완료·교체 확인은 불변이다. API 재호출·GPS·원격 push 없음.
- 게시용 문서는 뒤로 미루지만 실제 수집 정책은 미루지 않는다. 로컬 데이터 schema/삭제/만료 경계도 구현 전에 명시한다.

## OS 제약·정책 변경 중지 조건

Apple ActivityKit 문서상 일반 시작은 foreground에서 가능하며 LiveActivityIntent 예외가 있다. 기존 'handoff 성공 후 시작'을 JS Promise 뒤 request만으로 보장하지 않는다. 외부 handoff 후 성공 신호와 native 실행 기회의 조합을 실제 증명한다. 안 되면 **handoff 전 준비 Activity + 실패 시 정리** 등의 대안과 사용자 영향/장단점을 통합에 반환하고 승인 전 도입하지 않는다. 외부 앱 실제 도착을 관측했다고 표현하지 않는다.

로컬 알림이 발화한다고 JS가 반드시 실행되거나 Live Activity 상태가 자동 변경되는 것은 아니다. 시각 표시/알림 예약, 사용자 action에 따른 상태 갱신, 다음 실행 시 reconciliation을 구분한다. 강제 종료/재부팅 후 즉시 Activity 재등장은 보장하지 않고 앱 재실행 시 진행 복구를 검증한다. 시간 경과만으로 exact 시각 삭제/Activity 종료를 반드시 수행한다고 약속하지 않는다. OS가 실행 기회를 주지 않는 종료 지연과 다음 접근 cleanup을 명시한다.

근거: [Activity](https://developer.apple.com/documentation/activitykit/activity), [Displaying live data](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities). iOS17 최소 지원에 실제 있는 API만 사용한다.

## 병렬 경계

- 이번에는 **UI/native 한 세션 단일 작성자**로 A→B 진행. App/nav/Profile/app.json/ios/plugin 동시 편집 금지.
- DB 계약 조사·설계는 UI와 병렬 가능하지만 이번 계획은 DB-DWELL 원격 적용/서버 개인화 구현을 자동 승인하지 않는다. 보유 정책 미확정을 임의 영구 저장으로 채우지 않는다.
- QA 테스트 문서 준비는 병렬 가능, 코드 게이트와 기기 검증은 UI 인계 후 실행한다.
