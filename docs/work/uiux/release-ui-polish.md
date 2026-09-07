# 출시 UI 보완 — 2026-09-07 사용자 요청

상태: 탭 즉각 전환·기록 지도 구현, 문의 연락처 결정 및 사진 권리 확인 대기.

## 요구사항과 교체 이력

- 탭 native 기본 전환 → 페이지 이동처럼 보임 → Home/NearbyBrowse/ActivityRecord/Profile 목적지만 `animation: none` → 탭의 즉각 전환 요구 반영. 현행 구현. 상세·로그인 화면 전환은 유지한다.
- 완료한 장소 숫자만 표시 → 방문 위치를 다시 볼 수 없음 → 완료한 장소 탭 시 방문 마커 Modal → 기록의 contentId를 공개 카탈로그와 표시 시점에 연결한다. 현행 구현. 비로그인은 요약과 같은 이번 달, 로그인은 현재 계정 기록만 사용한다. 중복 장소는 한 마커, 누락/유효하지 않은 좌표는 제외 안내, 경로선은 생성하지 않는다.
- 문의하기 ‘문의 방법 준비 중’ → 배포용 실제 연락 수단 아님 → 지원 이메일 제공 후 mailto 등 간단한 연결 필요. 결정 대기이며 삭제하지 않았다. Apple 1.5는 앱과 지원 URL에서 연락 수단을 요구하므로 문의 전용 기능이 없다는 이유만으로 연락처까지 제거할 수 없다: https://developer.apple.com/app-store/review/guidelines/#developer-information
- 사진 원천 존재 → 현재 화면에 사진 없음 → 공개 카탈로그 369곳 중 imageUrl 0건 확인. 데이터 작업의 사진 이용허락 fail-closed에 따른 결과다. UI 오류로 단정하거나 원본 URL을 재노출하지 않는다. `docs/work/data-curation/release-personalization-data.md`의 권리 확인·허용목록 절차 인계, 현행 정책 유지.

## 완료 인수인계

### 1. 변경 파일과 목적

- `App.tsx`: 주 탭 네 곳만 즉각 전환.
- `src/ui/ActivityRecordScreen.tsx`: 비로그인 완료 장소와 지도 버튼 연결, 계정/로딩 전환 시 초기화.
- `src/ui/AccountRecordsPanel.tsx`: 계정별 방문 기록 지도 CTA 연결.
- `src/ui/CompletedPlacesMapButton.tsx`: 안전영역·닫기·위치 누락 안내를 갖춘 마커 지도.
- `src/ui/activity/completedPlaceMapModel.ts`: 월 필터, ID 중복 제거, 공개 위치 검증.
- `test/ui/release-record-map.test.ts`, `test/ui/completed-map-screen.test.ts`: 탭 옵션·월 경계·미방문/누락/잘못된 좌표 제외·실제 컴포넌트 열기/닫기 검증.

### 2. 유지한 계약

- DB 저장 payload·좌표 비저장·계정 소유권·비로그인 가져오기·삭제·추천/API·학습·Live Activity는 변경하지 않았다.
- 사진 이용허락 정책·원본/공개 데이터·중앙 문서·보드는 수정하지 않았다. 기존 세션 변경을 되돌리거나 stage/commit/push하지 않았다.

### 3. 검증 결과

- 선행 테스트: 새 지도 모델 부재로 실패 재현 후 구현. 테스트 실행 호스트의 TS 로딩 문제는 테스트 확장자를 `.ts`로 조정했다.
- 신규 집중 테스트 4/4 통과. 전체 UI 554건 중 553 통과·기존 skip 1, core 272/272 통과.
- 최종 `npm run test:typecheck` 및 `git diff --check` 통과.
- iOS Expo export 성공: `/private/tmp/timefit-release-polish-export`.
- 로그: `/private/tmp/timefit-release-polish-ui.log`, `/private/tmp/timefit-release-polish-core.log`, `/private/tmp/timefit-release-polish-export.log`.
- Simulator·실기기·운영 API는 실행하지 않았다.

### 4. 다음 결정·위험·실기기 확인

- 공개 지원 이메일을 사용자가 제공하면 문의 화면 제작 없이 연결 가능. 현재 placeholder는 배포 준비 완료로 간주하지 않는다.
- 사진은 데이터 담당이 사진별 허락 근거를 확인하고 허용목록/카탈로그를 재생성해야 한다. 확인 전 UI 우회 금지.
- 실기기: 4개 탭 즉각 전환, 비로그인 이번 달 기록과 계정 기록 마커, 모달 닫기, 작은 화면 safe area, 지도 SDK 실패 표시, 계정 전환/삭제 후 이전 기록 비노출 확인 필요. 실제 지도 렌더링은 자동 hook 테스트가 대체하지 않는다.
