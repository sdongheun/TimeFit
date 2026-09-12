# U-ODSAY-REMOVE-01 — legacy 장바구니 실경로 실패 경계

2026-09-09. 기준: [제거 결정 §4 C](../integration-decision/release-overseas-minimum-and-odsay-removal.md), [엔진 인계](../recommendation-engine/odsay-removal.md), [API 인계](../external-api/odsay-removal.md), 사용자의 UI 잔여 실패 보완 명령. **UI 구현·자동 회귀 완료, 최종 QA 인계**. 공개 빌드 입력 검사 통과는 사용자 인계를 기준으로 하며 본 세션이 새 artifact를 생성했다는 의미는 아니다.

## 1. 변경 파일·원인·목적

이전 → 문제 → 교체 → 이유 → 상태:

- 기존 basket 성공 fixture는 실제 경로 없이 자동 대중교통 시간을 성공으로 기대했다. ODsay 제거 뒤 transit이 Infinity를 반환하여 `course.totalMin <= ctx.remainingMin`이 실패했다. 동일 입력을 실행하여 **3건 중 1건 실패**를 먼저 재현했다.
- `buildBasketCourse`는 Infinity/근사 source를 검사하지 않고 Course를 반환했다. 호출자인 `OneStopResultsScreen.startCourse`는 운영시간만 확인한 뒤 save/replace와 활성화로 진행할 수 있었다. 신규 실패 fixture에서도 미확인 경로를 거절하지 않는 결함을 확인했다.
- 또한 LegacyResults는 선택한 한 수단으로 approach/onward를 exact 검증하지만 builder에는 장소 도착 구간 수단만 전달해 마지막 구간이 다시 자동 transit으로 바뀔 수 있었다. 검증한 수단과 저장할 마지막 구간의 불일치였다.
- 교체: legacy builder가 모든 구간의 캐시 분/source/geometry를 한 번 읽고, 유한·비음수 시간과 현재 legacy exact source인 TMAP을 확인한 뒤 Course를 조립한다. 실패는 안전한 `basket_route_unavailable`로 거절한다. 한 장소 화면은 검증한 `active.mode`를 마지막 구간에도 전달한다. 오류는 기존 실제 경로 실패 문구와 명시 `다시 확인`으로 안내하며 저장/교체/활성화/Execution 이동 전 중단한다. **현행 구현**. 근사값을 성공으로 복구하지 않고 검증 경로를 저장하기 위한 최소 보완이다.

변경 파일:

- `src/ui/recommendation/basketPlanner.ts`: 읽기 주입 경계, 마지막 수단 전달, 실경로 source/시간 차단 및 같은 읽기 결과로 legs/합계 조립. 네트워크 추가 없음.
- `src/ui/OneStopResultsScreen.tsx`: 마지막 검증 수단 전달, 경로 오류의 안전 안내·명시 재확인. 기존 날짜 오류 처리/저장 순서는 유지.
- `test/ui/basket-planner.test.ts`: 정확 TMAP 분/geometry 성공 fixture와 실제 엔진 no-route, 마지막 구간 누락, 유한 haversine 실패 fixture 분리.
- `test/ui/odsay-removal-screen.test.mjs`: 실제 화면→실제 builder→주입 저장 port의 신규/교체 각각 exact·initial no-route·저장 직전 경로 소실 6건. 날짜·장소·응답은 고정이며 실제 DB 호출 없음.
- `test/mixed-travel-contract.test.mjs`: 화면 호출 정적 assertion에 검증한 finalMode 전달을 명시. 엔진 정책 assertion은 변경하지 않음.
- 본 문서. 기존 dirty 변경은 보존했고 보드/중앙 문서는 수정하지 않았다.

## 2. 유지한 공개 계약

- Infinity를 유한 시간으로 치환하지 않음. 근사 대중교통·TMAP transit·새 공급자 없음. builder의 exact source 검사는 legacy TMAP 캐시 한정이며 별도 Kakao proxy V1 경로를 제한/교체하지 않음.
- 기존 저장 ODsay source/min/geometry를 읽는 화면·repository/스키마와 과거 기록은 수정/삭제하지 않았다. 새 builder로 과거 기록을 재계산하거나 source를 바꾸지 않는다.
- 최대180분/2곳·체류·운영시간·개인화·동의·날짜 보존 정책 변경 없음. 엔진/API 파일 변경0. Kakao 앱/웹 클릭 이동 시작·Live Activity 공유 진행·알림, GPS 미사용 및 과거 좌표 차단 유지.
- 운영 DB/계정/환경변수/공개 문안/빌드 설정 변경0, 외부 API/Simulator/실기기/배포/commit/push0.

## 3. 자동 검증 결과

- 실패 선행: 기존 basket **2 pass/1 fail** 재현. 새 경로 실패 fixture 추가 후 **2 pass/3 fail**, `/private/tmp/odsay-ui-red.log`. 제품 수정 후 basket **5/5 PASS**.
- 집중: basket·실제 화면·course-v1-route-adapter·route-provider-adapter **29/29 PASS**, `/private/tmp/odsay-ui-focus.log`.
- 화면 성공은 두 legs가 검증한 walk/TMAP/유한 시간/geometry를 보존하고 save 또는 replace 1회, 활성화·Execution 이동 1회를 확인한다. 초기 no-route는 추천 대표를 표시하지 않고, 저장 직전 final leg 실패는 save/replace/활성화/화면 이동 모두0 및 재확인 안내를 검증한다.
- 엔진/API 제거·기존 course-route-start·live-activity-final·manual-location-restore 집중 **27/27 PASS**, `/private/tmp/odsay-preserved.log`. 엔진/API fixture의 ODsay key-read/request/new-write0, TMAP 실패 후 transit0 및 과거 snapshot 호환 근거를 재사용·재실행했다. 화면 fixture의 실패 저장 호출0과 별개 계층의 증거다.
- `npm run test:typecheck`: **PASS**, `/private/tmp/odsay-ui-types.log`.
- `npm run test:ui`: **758건 중757 PASS/0 fail/1 skip**, `/private/tmp/odsay-ui-all.log`. skip은 기존 철회된 순차 추천 이력이다. 첫 실행은 sandbox tsx IPC EPERM으로 시작하지 못했으며 승인된 외부 실행으로 완료했다.
- `npm test`: **447/447 PASS**, `/private/tmp/odsay-core.log`. 첫 실행에서 화면 호출의 옛 정적 인자 기대가 실패(동일 테스트가 discovery 내부에도 집계되어 실패2)했고, 위 화면 assertion 수정 후 재실행하여 통과했다. 기대 완화가 아니라 finalMode 보존 조건을 추가했다.
- `git diff --check`: **PASS**. `src/ui`의 ODsay URL/public key/key 이름 검색0.
- iOS bundle/Archive를 새로 만들지 않았다. 네이티브·의존성·레이아웃 변경 없으며 실제 화면 실행형 fixture로 연결을 검증했다. 전체 release artifact 검사는 최종 QA/빌드 담당의 별도 근거다.

## 4. QA 인계·잔여 위험

- `QA-ODSAY-REMOVE-01`에서 공개 추천·과거 저장 코스 read-only 표시·Execution geometry 누락·명시 재계산을 통합 확인한다. 본 UI 실패1건은 해소됐으나 최종 ODsay 제거/출시 전체 수락이나 공개 문안 게시로 확대하지 않는다.
- 기존 API 문서의 환경변수 제거 대기와 사용자 최신 공개 빌드 입력 검사 통과 인계가 다르다. UI 세션은 환경을 재조회/수정하지 않았다. API/빌드 담당이 최신 검사 근거와 최종 artifact 부재 검사를 자기 문서에 정리한다. 공개 수신자 문안 변경은 QA 이후 출시 문서 담당 소유다.
- 최소 실기기 확인(본 세션 미실행): 실제 정확 경로가 있는 기존 한 장소 흐름의 저장/변경, 실패 시 재확인 안내와 기존 코스 보존, 기존 Kakao 길찾기·LA 정상 흐름. 실경로 실패 반례를 위해 운영 데이터를 변조하거나 실제 공급자 호출을 반복하지 않는다.
