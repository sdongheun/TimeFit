# QA-RELEASE-PERSONALIZATION-01 — 계정별 체류 개인화 출시 게이트

2026-09-07 실행 선행 보완: UI B 부분 인계의 표본 read→추천 테스트만으로 실행 준비 완료라 판단하지 않는다. DB의 최신 기기 소유권/eligibility 복원과 UI의 신규 완료→방문 ack→sample submit/outbox→다음 추천 연결 인계 후 최종 실행한다. source mock에 이미 넣어둔 표본3개가 아니라 실제 완료 consumer가 만든 신규3건으로 계산 결과를 검증한다. 기기 계정 namespace/import provenance/cold restore/off-reset-delete 재생성0을 필수로 포함한다.

상태: **준비 가능, 최종 실행은 Wave 구현 인계 완료 후**. 개발 제품 코드를 고쳐 PASS로 만들지 않는다.

1. Wave/최신 결정/각 역할 인계를 읽고 실제 변경 commit/dirty/artifact를 명시한다. 과거 preflight FAIL1과 개인정보/계정/사진/원격 미확인 사항을 checklist에 유지한다. 이번 개인화 추가로 과거 감사 facts가 바뀐 부분을 분리한다.
2. 동일 고정 입력으로 guest, anonymous, account 미동의, account A 동의, account B를 검증한다. guest도 Live Activity/도착/출발/길찾기를 사용할 수 있어야 하고 서버 학습 write는0이다.
3. 로그인 A 완료 기록→로그아웃 비노출/미적용→B 격리→A 재로그인 복구. guest import 승인/거절/실패/중복/응답 유실/다른 계정 전환을 확인한다. 방문 기록은 이동해도 과거 guest 학습0이며 서버 성공 전에 source를 지우지 않는다.
4. fixture로 신규 적격 완료 표본 1/2개는 기본, 3개는 해당 복합 카테고리만 반영, 6개는 최근5를 확인한다. 동일 카탈로그·경로에서 stay/time snapshot의 실제 차이와 UI 표시를 대조한다. 3개 완료 버튼만 눌렀거나 준비 문구만 바뀐 것은 합격 아님.
5. 동의 off/reset/delete·다른 계정 로그인·미완료·취소·만료·late response·offline pending 재전송에서 표본 오염/재생성0. 서버 처리 전 동의 취소/동시 submit은 DB fixture 결과로 확인한다. 원격 RLS를 실행하지 않았다면 미확인으로 남긴다.
6. begin/continue/pair frozen samples, public continuation 개인정보0, 개인화 추가 route attempt0, 후보 소실0, 약속 여유/영업 종료/min/max 안전성을 확인한다. 초기화/로그아웃 뒤 새로운 추천에는 기존 개인화가 적용되면 안 된다.
7. Live Activity 첫 handoff 성공 노출, 앱/LA 한 번 도착 동기화, LA 출발→잠금 해제→카카오 자동 전환 정상 흐름을 보존한다. 실패1 fixture의 updated/local revision 오류 및 stale rollback은 해결 증거가 있어야 한다.
8. 나이 입력/신규 전송0, 미허락 사진 runtime 요청0, 지도 logo/허락 출처 가림 여부, 개발 기능 Release 비노출, 계정 삭제 실제 동의/레거시 비승격을 점검한다.
9. typecheck/UI/core와 집중 fixture를 먼저 실행한다. Simulator 버튼을 하나씩 눌러 탐색하지 않는다. real API 반복 호출/사용자에게 실제 3번 방문 요구 금지. 실제 기기는 카카오·권한·LA·회원 전환 핵심 smoke만 사용자에게 요청한다.
10. disposable local DB 계정 정리, 같은 최종 Release의 build/입력/기대값/관찰값/로그 경로를 기록한다. 스토어 제출/운영 DB/사진 약관 확인까지 자동 fixture PASS로 대신하지 않는다. P0/P1/미확인과 다음 담당을 반환한다.

## 공통 검증·권한

[Wave 공통 실행 규칙](../integration-decision/release-personalization-wave.md)을 따른다. 코드 변경 전 실패 fixture, 변경 후 typecheck/UI/core/집중 테스트와 diff 검사. 운영 API·사용자 데이터·키 출력·원격 쓰기·commit/push 금지. 결과를 이 문서에 변경 파일/유지 계약/테스트/다음 결정 네 항목으로 인계한다. 문서의 구현 전 상태는 실제 증거 없이 완료로 올리지 않는다.
