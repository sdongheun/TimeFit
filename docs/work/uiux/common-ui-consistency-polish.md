# 공통 UI 일관성 보완

작업일: 2026-09-16  
상태: 구현 및 자동 검증 완료, 실기기 시각 확인 대기

## 현행 결정

- 이전 방식: 화면별로 행동 텍스트의 파란색 사용, 38~50px 터치 높이, 13~14px CTA 글자와 서로 다른 카드 모서리가 혼재했다.
- 관찰한 문제: 같은 종류의 행동인데도 중요도와 터치 규격이 달라 보였고, 지도 위 닫기 버튼은 밝은 지도에서 경계가 약했으며 코스 확인에는 구현 방식을 설명하는 문구가 노출됐다.
- 교체한 방식: 어두운 화면의 텍스트 행동은 흰색, 일반 터치 영역은 최소 44px, 주요 CTA는 52px·모서리 12px·16px 글자, 기록 화면 좌우 여백은 22px로 맞췄다. 지도 위 닫기 버튼만 패널 배경과 1px 외곽선을 유지하고 일반 페이지의 투명 헤더는 보존했다.
- 교체 이유: 색상은 선택 배경·아이콘·상태 강조에 집중하고, 텍스트 행동과 터치 규격은 화면 사이에서 같은 의미로 읽히게 하기 위함이다.
- 상태: 현행 구현. 일반 페이지 뒤로가기 배경 규칙은 중앙 공통 문서와 충돌하므로 통합·결정 확인이 필요하다.

## 완료 인수인계

### 1. 변경 파일과 변경 목적

- `src/ui/ResultsScreen.tsx`, `src/ui/recommendation/TwoStopSelectionPanel.tsx`: 결과의 추가 추천 행동 텍스트를 흰색으로 통일.
- `src/ui/AccountRecordsPanel.tsx`, `src/ui/CompletedPlacesMapButton.tsx`, `src/ui/GuestImportPanel.tsx`: 기록·지도·가져오기 텍스트 행동의 대비를 통일.
- `src/ui/LoginScreen.tsx`, `src/ui/PlacePhoto.tsx`: 문서·재시도·사진 이용조건 링크를 흰색으로 통일하고 사진 링크에 밑줄을 추가.
- `src/ui/NearbyBrowseScreen.tsx`: 전체 보기 터치 높이를 44px로, 길찾기 CTA를 52px·12px·16px로 통일하고 오류색을 공용 토큰으로 교체.
- `src/ui/MapPlacePicker.tsx`: 보조 행동을 44px로 확대하고 밝은 지도 위 닫기 버튼에 패널 배경과 1px 외곽선을 적용, 오류색을 공용 토큰으로 교체.
- `src/ui/ProfileScreen.tsx`, `src/ui/RecordEmptyState.tsx`, `src/ui/ActivityRecordScreen.tsx`: 주요 CTA와 기록 화면 여백을 공통 규격으로 통일.
- `src/ui/CourseConfirmScreen.tsx`: 사용자 판단에 불필요한 `선택한 구간만 방향 표시` 구현 설명을 제거.
- `src/ui/ProfileManagementScreen.tsx`, `src/ui/ProfileScreen.tsx`, `src/ui/GuestImportPanel.tsx`: `다시 시도해 주세요` 띄어쓰기를 정리.
- `test/ui/common-ui-consistency.test.mjs`: 색상, 터치 크기, CTA, 화면 여백, 지도 오버레이의 회귀 계약 추가.

### 2. 유지한 계약·정책 경계

- 추천 순서·시간·경로 계산, 코스 진행 상태, 저장·삭제 서비스, 인증·개인화, DB·외부 API·데이터·Live Activity 계약은 변경하지 않았다.
- 파란색은 선택 배경, 아이콘, 상태 강조에 계속 사용하며 모든 파란색을 제거하지 않았다.
- 일반 페이지의 투명 뒤로가기는 유지하고, 밝은 지도 위 오버레이 컨트롤만 배경과 경계를 사용했다.
- 중앙 단일 작성자 문서인 `docs/03_product/UIUX_공통규칙.md`는 수정하지 않았다.

### 3. 테스트 결과

- 실패 선행 `node --test test/ui/common-ui-consistency.test.mjs`: 구현 전 3건 실패 확인, 구현 후 3/3 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 816개 중 815 통과, 1개 skip, 실패 0.
- `npm test`: 571/571 통과.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-common-ui-consistency-ios --clear`: iOS 번들 생성 통과.
- `git diff --check`: 통과.
- Simulator·실기기 검증은 실행하지 않았다.

### 4. 다음 결정·위험·재현 조건

- 중앙 공통 규칙의 `상단 뒤로가기/닫기는 어두운 박스` 규칙은 현재 일반 페이지의 투명 헤더 관행과 충돌한다. 통합·결정 세션에서 `일반 페이지는 투명, 지도 위 오버레이는 박스`로 문서화할지 결정해야 한다.
- 실기기에서는 결과의 추가 추천, 기록의 장소 열기·지도 닫기, 로그인 문서 링크, 주변 길찾기, 지도 선택 닫기 버튼을 한 번씩 확인한다.
- 큰 글자 설정에서 44px 보조 행동과 52px 주요 CTA 글자가 잘리거나 두 줄로 밀리지 않는지 확인한다.
- 기존 작업이 많은 수정 상태를 보존했으며 commit·push하지 않았다.
