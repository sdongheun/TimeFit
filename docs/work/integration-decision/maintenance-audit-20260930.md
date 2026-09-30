# 2026-09-30 작업별 복구 기준점과 유지보수 조사

## 범위와 검증

사용자 요청: 누적 변경을 작업별 한국어 커밋·푸시로 보존하고 잠재 문제와 미사용 코드를 조사한다. 이번 조사는 제품 수정·삭제·운영 배포 승인이 아니다. 현재 로컬 트리 기준이며 출시 IPA 동등성을 주장하지 않는다.

- 타입 검사 PASS.
- `npm run test:ui`: 867건 중 866 PASS, 기존 SKIP 1, FAIL 0.
- `npm test`: 602 PASS, FAIL 0.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-audit-export --no-bytecode`: PASS. 현재 로컬 환경의 번들 확인이며 공개 서명 Archive 검증은 아니다.
- 최초 UI 실행은 sandbox의 tsx IPC 생성 제한으로 시작 전 실패했고, 권한 승인 후 동일 npm 명령으로 성공했다.
- 로그: `/private/tmp/timefit-audit-{types,ui,core,export}.log`.
- 커밋 후보 155개 텍스트 파일에서 private key/JWT/service key 형태를 검사하여 일치 0. 이는 모든 비밀정보 부재를 보증하는 전수 보안 감사가 아니다.
- `output/` 약 309MB 및 루트 발표용 PPTX는 개인 산출물로 보존하고 커밋에서 제외한다. 환경 파일과 생성 `ios/`도 제외한다.

## 작업별 커밋

| 커밋 | 범위 |
| --- | --- |
| `6bf7452` | Expo 57·iOS 서명 설정 |
| `9f49eaa` | 데이터 매핑·운영시간 정제 |
| `3983f09` | DB 공급자 호출 예산 |
| `898279d` | 실시간 API·Edge·계약 테스트 |
| `99c839f` | 다중 원천 추천·경로 검증 보충 |
| `e500f31` | UI live 연결·사진·표시명 |
| `f548e3e` | 스크린샷 생성 도구 |
| `91ed1b4` | 통합 정책·역할별 검증 기록 |

검증한 복구 기준은 위 변경이 모두 합쳐진 트리다. 역할별 중간 커밋은 서로 참조하므로 각각 독립 실행 가능한 릴리스로 간주하지 않는다. 기존 신규 문서의 Markdown 강제 줄바꿈 공백과 기존 EOF 공백은 보존했다.

## 잠재 문제

### P1 — 시작 시 남은 시간이 코스를 수용하는지 재검사하지 않음

- 근거: `src/ui/timeSetup/datedSetupTime.ts:5`는 약속 시각 전인지만 검사한다. `CourseConfirmScreen.tsx:103`에서 코스 길이를 전달하지 않는다. `activeVerifiedCourseModel.ts:64`와 `AppFlowContext` 시작 경로는 기존 코스를 보존하며 시간을 재계산하지 않는다.
- 고정 입력 재현: 12시 조회·180분 입력, 14:55 시작 검사 결과 `true`. 이미 계산된 87분 코스가 있더라도 남은 5분과 비교하지 않는다.
- 영향: 추천 조회 후 오래 대기하면 도착 기한이나 영업시간을 지키지 못하는 코스를 시작할 수 있다. 단순히 기한이 지나지 않았다는 사실은 코스 유효성을 의미하지 않는다.
- 후속: 실제 시작 시각 기준 이동·체류·여유·운영시간 검증 계약부터 확정한다. 진행 중 코스 이어가기는 신규 시작과 분리한다. 이 조사에서 임의 차단이나 자동 API 재호출을 추가하지 않았다.

### P2 — 남은 시간 표시가 조회 당시 값으로 고정됨

- 근거: `src/ui/ResultsScreen.tsx:219`의 `session.remainingMin` 직접 표시.
- 두 장소 선택 전후 같은 값은 설정 예산 표시라는 현재 구현과 일치한다. 그러나 시간이 실제로 지나도 값이 같아 현재 남은 시간으로 오해할 수 있다.
- 후속: `설정한 시간`으로 명확히 표시할지 실제 카운트다운을 표시할지 결정하고, 코스 예상 소요·완료 후 여유와 혼용하지 않는다. P1 해결과 함께 검증한다.

### P2 — 주변 둘러보기 부분 성공 후 같은 화면에서 복구 조회 불가

- 근거: `src/ui/nearbyLiveSession.ts:93`의 partial도 phase를 ready로 변경한다. `load()`는 기존 Promise를 재사용하고 `retry()`는 failed일 때만 다시 요청한다.
- 한 공급자가 일시 장애여서 partial/시장만 표시된 뒤 복구되어도 같은 controller에서는 다시 조회할 수 없다. 화면을 새로 mount하면 조회 가능하다.
- 판정: 호출 절약을 위한 명시적인 현재 설계이나 장애 복구·최신성 UX 한계다. 자동 폴링은 추가하지 말고 partial에 한한 사용자 재시도 또는 수명 정책을 검토한다.

## 미사용 후보와 보존 대상

상대 import/from/require 및 동적 import의 로컬 경로를 조사하고 저장소 전체 참조를 재검색했다. 정적 분석의 한계가 있어 자동 삭제하지 않는다.

| 파일 | 제품/기타 참조 | 판정 |
| --- | --- | --- |
| `src/ui/CompletedPlacesMapButton.tsx` | 제품 import 없음. completed-map-screen/common-ui-consistency 테스트 및 과거 mock에만 참조 | 삭제 후보. 방문 지도 기능 자체는 현행 `BusanVisitVectorMap` 경로가 있으므로 함께 지우면 안 됨 |
| `src/ui/activity/busanSubdistrictPaths.ts` | 제품 import 없음. history-region-map 테스트에서만 자산 검사·mock 로딩 | 삭제 후보. 현재 사용하는 `busanDistrictPaths.ts`는 보존 |
| `src/engine/liveProgressiveOrchestrator.ts` | 제품 import 없음. 단일 Tour progressive 테스트에서 사용. 실제 다중 원천은 `liveMultiSourceOrchestrator.ts` | 통합 전 단계 구현 후보. 의도적인 참조 모델인지 엔진 역할 확인 후 관련 테스트와 함께 정리 |
| `src/engine/courseV1.testOnly.ts` | 통합 테스트 2개에서 의도적으로 사용 | 유지. 제품 미사용과 불필요한 파일을 혼동하지 않음 |
| `src/data/busan_poi_catalog.legacy.json` | 카탈로그/매핑 생성 스크립트에서 사용 | 유지. 제품 진입점에서 직접 읽지 않는다고 삭제하면 생성 경로 손상 |
| `src/data/busan_poi_catalog.json` | 사진 호환·기록 지역 해석·테스트 등 현재 소비자 존재 | 유지. 실시간 후보 전환만으로 제거 불가 |

테스트가 존재한다는 사실은 제품에서 사용한다는 증거가 아니다. 반대로 제품 번들에서 빠졌다는 사실만으로 빌드 입력/테스트 fixture까지 불필요하다고 판단하지 않는다. 전체 미사용 비율은 산출하지 않았다.

## 인수인계

1. 변경 목적: 기존 누적 구현을 작업별로 보존하고 본 조사 문서를 추가. 조사 과정의 제품 변경 없음.
2. 유지 경계: 최대180분·2곳·실시간 원천·사진 승인·GPS 미사용·개인화·DB 정책 변경 없음. 원격 DB/함수/스토어 배포 없음.
3. 테스트: 위 현재 전체 회귀 및 iOS 로컬 번들 결과. 운영 API 반복 호출 없음.
4. 다음 결정: P1 시작 유효성 우선. P2 표시/재시도 정책은 UIUX·엔진 계약 합의 후 진행. 미사용 후보 삭제는 별도 승인과 실패 우선 테스트 필요.
