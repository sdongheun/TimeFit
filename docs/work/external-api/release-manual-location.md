# API-RELEASE-MANUAL-LOCATION-01 — 수동 선택 좌표 API 계약

2026-09-09 · [현행 결정·명령](../integration-decision/release-manual-location.md).

**API 소유 구현 변경0으로 확인 완료. UI의 GPS 공급 제거와 기존 활성 snapshot 처리 결정은 별도 미완료 경계다.** GPS 제거를 신고 면제·위치정보 미처리·전체 앱 전송0으로 표현하지 않는다.

## 1. 현재 전송과 유지할 계약

| 기능 | 입력과 외부 전송 | API 판단 |
| --- | --- | --- |
| 수동 검색 | PlacePicker→`kakaoLocationSearchAdapter`→`src/engine/kakao.ts`; 검색어를 Kakao Local에 전송. keyword 요청에 GPS 중심좌표를 자동 추가하지 않음 | 그대로 유지. 검색어가 개인 주소일 수 있음. 정상 빈 결과의 제한 fallback은 검색 종류 전환이지 자동 측위 아님 |
| 지도 핀 라벨 | `kakaoLocationLabelAdapter.resolve(point, 'pin_confirm')`→주소 조회, 정상 빈 결과에서만 행정구역 조회 | 핀 좌표→주소 변환은 유지해야 한다. 주소 빈 결과를 GPS/IP 추정으로 대체하지 않음 |
| 임의 수동 출발·약속 경로 | activated route adapter→authenticated Edge invoker. JWT·mode·allowance·private scope·양 끝 좌표 전송. Edge→Kakao REST에 양 끝 좌표·좌표계·서버 인증 | 수동 선택이라고 public cache 승격하지 않음. 공급자에 사용자 JWT/계정ID·약속 날짜/시각 추가하지 않음 |
| 공개 대표 장소 간 경로 | 두 ID와 좌표가 현재 snapshot과 모두 정확히 일치할 때만 public_segment; 앱→Edge에는 ID/version, Edge가 공개 좌표 해석 | `routeProxyActivatedCourseAdapter.ts:49` scope resolver 유지. ID만 같거나 수동 좌표라는 이유로 공개화하지 않음 |
| 상세 도보 보충 | `privateWalkConnector`가 호출자가 준 두 점을 기존 session으로 Edge에 전송 | private walk-only, 메모리 재사용·기존 상한·실패 정책 유지. 독립 GPS/권한/새 CAPTCHA 요청 없음 |
| 주변 길찾기 | `nearbyDirections.ts`는 목적지 이름·좌표만 `map.kakao.com/link/to`에 전달 | 둘러보기 기준점을 출발지로 주입하지 않음. 외부 카카오맵이 자체 권한으로 위치를 얻는 동작은 TimeFit 자동 측위와 구분 |
| 코스 구간 길찾기 | `execution/schedule.ts`는 전달받은 구간의 양 끝 좌표·수단, HTTPS fallback에는 이름도 사용 | 명시 클릭과 기존 앱/LA 이동 시작 계약 유지. 주변 목적지-only와 통합하지 않음 |

이전 GPS/수동 공용 좌표 입력 → GPS 없는 UI 결정 → **API는 좌표의 실제 출처를 추론하지 않는 기존 입력 계약 유지** → 새 origin type·스키마·공통 추상화 불필요 → API 현행 유지, UI 전환/QA 전.

## 2. GPS 유입 차단 책임

- `src/services` 및 사용 중인 `src/engine/kakao.ts`, `travel.ts`에서 expo-location/navigator.geolocation/getCurrentPosition/watchPosition 및 확인 대상 IP 위치 서비스 참조를 찾지 못했다. 검색 결과만으로 앱 전체 자동 측위0을 주장하지 않고, 실제 adapter는 호출자가 전달한 point/query와 주입 port를 소비한다는 코드 경계를 대조했다.
- 라벨 adapter의 `LocationLabelPurpose = 'gps_auto' | 'pin_confirm'`는 호환 목적 인자다. 구현은 purpose를 요청/cache/provider 선택에 사용하지 않고 위치를 취득하지도 않는다. UI의 gps_auto caller 제거로 해결 가능하므로 타입 삭제·GPS 이름 존재만으로 불필요한 계약 변경을 하지 않는다.
- 점검 당시 `TimeSetupScreen.tsx` 초기 허용 GPS 조회 및 deviceLocationSnapshot 공급, `ExecutionScreen.tsx` 재추천 GPS 조회는 아직 있었다. 이는 UI 소유의 현재 병렬 작업 대상이다. 해당 파일을 수정하거나 UI 완료를 추정하지 않았다. PlacePicker/MapPlacePicker/Nearby의 자동 측위·위치 권한/버튼·기본 중심 확정 방지도 UI/QA 범위다.
- UI는 출발지 미선택 시 호출0, 지도 기본 부산 중심은 미선택 상태 유지, 확정 핀에만 pin_confirm 호출을 보장해야 한다. API는 유효 좌표가 GPS인지 수동인지 구분할 근거가 없으므로 UI에서 유입을 차단한다. IP/Wi-Fi 등 대체 측위 추가0.

## 3. 과거 활성·저장 좌표 복원 위험 — 통합/UI/DB 인계

현재 읽은 코드에서 다음 경계가 남는다. 실제 저장 내용을 읽지 않았고 모든 과거 좌표를 GPS로 분류하지 않았다.

1. `activeVerifiedCourseStorage.ts`는 기존 serialized session/origin을 decode해 반환하고, `AppFlowContext.tsx:147`은 read→reconcile→active 복원을 수행한다. 현재 decode만으로 수동 선택 출처 또는 사용자 재확정을 증명하지 않는다.
2. 복원된 active를 Home/LA pending 경로로 CourseConfirm에서 열면, `CourseConfirmScreen.tsx:115`의 connector request 생성 및 effect→`loadCourseV1WalkConnectors`→private connector가 **경로 gap 조건에서** 과거 origin/destination을 자동 재전송할 수 있다. GPS 신규 조회를 제거해도 이 경로가 자동으로 없어지지 않는다. 세션 없거나 cache hit/보충 불필요면 provider0일 수 있다.
3. 같은 snapshot의 코스 길찾기는 명시 클릭 뒤 과거 구간 좌표를 외부 앱/웹으로 전달할 수 있다. 자동 전송과 클릭 전송을 구분하되 ‘과거 GPS 재전송0’의 최종 검증 범위에는 둘 다 고려해야 한다.
4. legacy MyCourses→Execution은 해당 화면에 도달하고 기존 일반 회원 저장 코스가 있을 때 geometry hydration→`precompute`/`precomputeTransit`, 재추천→baseline 등으로 전달될 수 있다. 최신 정상 공개 entry가 닫힌 근거와 이 내부 경로 존재를 구분한다. DB는 repository/저장 코스 복원 의미를 별도 확인한다.

**최소 처리안 제안(미구현·결정 필요):** 출처가 불명확한 기존 진행 데이터는 표시/일반 기록을 보존하면서 네트워크 geometry 보충과 과거 출발점을 사용하는 handoff·재계산 전에 수동 장소 재확정을 요구하거나 해당 전송 entry를 차단하는 UI 처리안을 통합이 선택한다. 코스 강제 종료·기록 삭제·좌표 전체 변경·새 서버 provenance 필드 추가는 승인 없이 하지 않는다. API에서 좌표 숫자·ID만 보고 GPS로 추정해 거절하면 정상 수동 경로까지 손상하므로 그런 차단은 넣지 않는다.

## 4. 검증

다음 기존 격리 fixture를 실행했다. 좌표는 고정 합성 입력이고 GPS/실제 네트워크/운영 DB를 쓰지 않는다.

```sh
node --import tsx --test test/kakao-location-search-adapter.test.ts test/kakao-location-label-adapter.test.ts test/route-proxy-client-adapter.test.ts test/activated-route-proxy-adapter.test.ts test/private-walk-connector.test.ts test/api-two-stop-route-budget.test.ts test/ui/nearby-directions.test.ts test/ui/execution-schedule.test.ts
```

**58/58 PASS, 실패0, skip0.** 핀 주소/빈 응답/실패, private/public scope, 기존 JWT와 CAPTCHA 실패, cache-only miss/provider0·attempt 보존, connector 메모리·실패, 목적지-only 및 코스 앱/웹 링크 계약을 확인했다. 일부 기존 라벨 fixture의 gps_auto 인자도 합성 좌표 입력일 뿐 실제 GPS 호출은 아니다.

새 기능 결함이 없어 실패 테스트·구현 변경을 추가하지 않았다. 이 결과는 **수동 좌표를 기존 port에 공급해도 계약을 유지함**의 근거이며, UI 미선택·기존 snapshot·권한별 GPS0의 실제 화면 검증이나 새 후보 빌드 PASS는 아니다. 전체 게이트·동일 iOS 후보 검증은 명령에 따라 QA 단일 실행자에게 남긴다.

## 5. 네 항목 인수인계

1. **변경 파일:** 이 문서만 신규 작성. API 코드·fixture·UI/네이티브·DB·보드·중앙 문서 변경0.
2. **유지 계약:** 수동 검색/핀·공개 경로, JWT/private cache·메모리 TTL·호출 예산·typed failure,180분/2곳, 목적지-only 주변 및 코스 클릭 기반 진행 유지. 운영 호출·배포·데이터 삭제·설정 변경·commit/push0.
3. **검증 결과:** source/요청 경계 확인과 고정 fixture58 PASS. 문서 whitespace 검사. 앱 전체 테스트·새 빌드 미실행, 실사용자 좌표/키/저장 snapshot 열람·출력0.
4. **잔여 위험·다음 담당:** UI가 신규 GPS 공급/권한 entry를 제거하고, 통합/UI/DB가 §3의 기존 활성 데이터 전송 처리안을 합의해야 한다. API 자체 변경0 완료와 제품 전체 GPS 파생 전송 차단 완료는 별개다. DOCS는 수동 좌표도 외부 전송될 수 있음을 유지하고 법적 신고 제외를 확정하지 않는다.
