# QA-NEARBY-SHEET-DRAG-01 — 드래그 연속성 검증

## 최신 결정 — 2026-09-05

사용자가 UI 수정 후 실기기의 매끄러운 드래그를 확인했고 별도 QA 세션 반복을 생략하기로 했다. 상태: **별도 실행 생략·사용자 드래그 확인으로 제한 수락**. 아래 실행 대기 및 N1~N6는 작성 당시 계획이며 개별 통과로 승격하지 않는다. UI 인계 자동 회귀 결과는 nearby-browse.md에 보관한다. 작은 화면·큰 글씨·접근성 미확인은 출시 최종 점검으로 유지한다.

상태: **명령 작성·U-NEARBY-SHEET-DRAG-01 구현 인계 후 실행**.
관련 요구: UX-34 보완. 정책 변경 없음. 제품 수정 없이 자동 증거와 사용자 native 확인을 구분한다.
선행 문서: `../uiux/nearby-browse.md`의 최신 실행 명령·최신 완료 인계. 과거 진단 snapshot 통과는 수정 합격이 아니다.

## QA 세션 복사 명령

```text
QA-NEARBY-SHEET-DRAG-01을 수행해. AGENTS.md, docs/README.md와 docs/work/qa-release/nearby-sheet-drag-validation.md, docs/work/uiux/nearby-browse.md의 최신 수정 인계를 읽어. U-NEARBY-SHEET-DRAG-01이 미완료면 자동 합격 처리하지 말고 선행 미완료로 반환한다.

1. 자동 게이트: 실제 production handler 테스트가 버그 값이 아닌 정상 기대값을 검사하는지 검토한다. spring 중 재잡기, 연속·역방향 move, 양방향 정착, drag 중 측정 변경/동일값/범위 clamp, release/terminate, stale callback/unmount를 확인한다. fixture는 실제 터치 전달/프레임 성능을 증명하지 않는다고 명시한다.
2. npx tsx --test test/ui/nearby-browse-screen.test.mjs, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check를 실행한다. UI 인계의 iOS export 성공과 해당 코드 revision을 확인하고 근거가 없거나 이후 관련 변경이면 export도 실행한다. 실패는 해당 소유 세션에 반환한다. 기능 코드 수정/skip/테스트 삭제는 금지한다.
3. 아래 N1~N6 체크리스트를 사용자에게 한 번에 전달한다. Simulator를 직접 반복 조작하지 않는다. 최신 JS 반영 경로를 확인해 실행 빌드/커밋 또는 dirty 상태/테스트 날짜/기기/iOS를 기록한다. embedded release bundle이면 새 빌드가 필요하고 dev-client이면 현재 Metro 연결·reload를 확인한다. 앱 삭제·env 변경·Metro clear를 기본 해결책으로 요구하지 마.
4. 사용자가 확인한 항목만 native 통과로 기록한다. 미응답은 미확인이다. N1~N3은 가능하면 한 짧은 화면 녹화로 받되 정지 캡처만으로 프레임 부드러움을 판정하지 않는다. 기본 기기 통과를 모든 기기 성능 보장으로 확대하지 마.
5. 끊김이 남으면 재현 동작/빈도/버튼 대비 차이를 먼저 기록한다. UI 세션에 개발 전용·제한 수량 이벤트 ring buffer 계측을 요청한다: timestamp, gesture/run ID, grant/move/release/terminate, current/baseline/target height, dy/vy, geometry 변경, animation start/cancel/finish. 좌표/장소/사용자/키는 기록하지 않는다. 매 프레임 console 출력으로 성능을 악화시키지 않는다. native 이벤트 증거 없이 JS layout·WebView·responder 취소를 확정하지 마. QA가 임의로 제품 로그/새 의존성을 넣지 않는다.
6. 이 문서에 변경 파일/보존 계약/명령·결과·로그/남은 재현과 다음 조치를 인계한다. 결론은 자동 합격, 사용자 native 합격, 미확인/실패를 분리한다. 외부 추천·route/API 반복 호출0, 운영 데이터 변경0, commit/push0. 기존 지도 로딩 외 검증 목적의 새 외부 호출을 만들지 않는다.
```

## 사용자 실기기 체크리스트

공통 입력: 같은 기준 위치에서 주변 둘러보기 목록이 로드된 상태. 드래그 시작은 목록 카드가 아닌 **시트 상단 손잡이 영역**. 일반 목록 스크롤은 N4에서 별도 확인한다.

| ID | 동작 | 합격 기준 |
| --- | --- | --- |
| N1 | 접힘에서 손잡이를 천천히 위로, 펼침에서 아래로 각각 3회 이동 | 손가락에 따라 연속 이동하고 갑자기 끝점으로 점프하거나 원위치로 튕기지 않는다. 놓으면 한 끝점에 정착한다. |
| N2 | 손을 떼지 않고 위→아래→위로 방향 반전; 이어 빠르게 위/아래 스와이프 | 반전 때 위치가 이어지고 빠른 스와이프 후 중간 높이에 멈추지 않는다. |
| N3 | 펼치기/접기 버튼 직후 움직이는 시트를 다시 잡아 반대로 드래그, 양방향 3회 | 잡은 높이에서 이어지며 완전 펼침/접힘으로 순간 이동하지 않는다. 버튼만 눌렀을 때와 체감 차이도 기록한다. |
| N4 | 펼친 목록을 끝까지 스크롤하고 상세 열기/닫기, 손잡이로 다시 접기 | 목록 스크롤이 유지되고 마지막 행·상세 CTA 접근 가능, 시트 동작 정상. |
| N5 | 접힘/펼침/상세에서 다른 탭으로 이동 후 복귀 | 탭바 터치 정상, 시트 하단 틈 없음, 지도 정상, 중간 높이 고착/예기치 않은 뒤늦은 이동 없음. |
| N6 | 가능한 경우 큰 글씨 또는 작은 화면에서 N1/N4 반복 | 레이아웃 변화에도 높이 점프·필수 행동 가림 없음. 불가능하면 미확인으로 남긴다. |

Native responder terminate/중간 측정 이벤트를 사용자가 강제로 재현했다고 간주하지 않는다. 해당 경계는 자동 테스트와 필요 시 계측으로 판단한다.

## 결과 기록

- 코드/빌드·기기·iOS·날짜: 미기록
- 자동 게이트: 미실행
- N1/N2/N3/N4/N5/N6: 미확인
- 녹화/로그 위치: 없음
- 최종 판단: 대기
