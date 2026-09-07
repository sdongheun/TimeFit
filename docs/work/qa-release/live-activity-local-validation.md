# QA-LIVE-LOCAL-01 — 서버 없이 Live Activity 기기 기능 검증

상태: U-LIVE-ACTIVITY-01 로컬 A/B 인계 후 실행. 서버 migration·일반 로그인·개인화 동의는 전제 아님.

```text
QA-LIVE-LOCAL-01을 수행해. AGENTS.md, docs/README.md, docs/work/integration-decision/live-activity-local-first.md, docs/work/uiux/live-activity-dwell-progress.md 최신 A/B 인계와 이 문서를 읽어. 기존 QA-LIVE-ACTIVITY-01 전체 개인화 테스트와 혼동하지 마.
1. 고정 시각·1/2곳 snapshot·fake handoff/알림/Activity/저장으로 유예 3/6/10분, 출발 공식/자정/지연, snooze1회, 도착/출발 중복·역순·stale event, handoff 실패, 미래 구간 차단, 저장 실패, 교체/완료/취소/만료/손상 복구를 검증한다. 서버 표본·미동의 업로드 큐0, 명시 완료 기록 정확히1회를 확인한다.
2. UI/전체/타입 게이트 및 Swift native build·App Group/extension 서명·prebuild 재현 결과를 확인한다. 실제 코드 revision과 로그를 기록한다. 제품 코드 수정/skip 금지, 실패는 소유 세션에 반환한다.
3. UI에서 고정 snapshot과 짧은 주입 clock을 쓰는 internal 전용 launcher를 제공했는지 확인한다. production 시간 공식 변경이나 숨은 fast timer가 남지 않게 검사한다. Simulator 수동 순회 대신 사용자에게 아래 기기 절차를 한 번에 전달한다. 로컬 알림/잠금 Intent/외부 앱 전환은 JS mock으로 합격 처리하지 않는다.
4. 사용자 확인: 새 native build에서 (a) 한 곳 handoff→잠금화면 Activity→도착 action→명시 출발/완료 (b) 두 곳 순서대로 진행·중복 action·최종 약속 구간 (c) 미응답/snooze1회 (d) 알림 또는 Activity 거절 시 길찾기 계속 (e) 앱 종료 후 재실행 이어가기·종료 cleanup. 기존 진행 fixture로 실제 route API 반복 호출을 피하고 실제 Kakao handoff 횟수만 기록한다. OS 알림 실제 발화는 짧은 internal 입력으로 확인하되 테스트 시간 주입임을 기록한다.
5. 기기/iOS/빌드/날짜/각 항목 성공·실패·미확인/영상 또는 로그를 이 문서에 남긴다. Island 없는 기기는 Lock Screen 확인만 주장하고 모든 presentation 통과로 확대하지 않는다. 잠금 인증/OS 강제 종료 때문에 불가능한 보장은 제한으로 반환한다. 실기기 미응답은 미확인이다. 추천 데이터/DB/계정·서버 표본·원격 배포·commit/push0.
```

결과: 미실행. 변경 파일/보존 계약/자동 결과/사용자 확인·잔여 위험 네 항목으로 인계한다.
