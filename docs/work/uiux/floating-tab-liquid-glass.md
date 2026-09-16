# 하단 탭바 Liquid Glass 전환

기준일: 2026-09-15  
역할: UIUX  
상태: 구현·자동/네이티브 검증 완료, 사용자 시각 확인 대기

## 결정과 교체 이력

- 이전 방식: 하단 탭바 전체를 `rgba(21,27,35,0.96)` 불투명 패널로 직접 그렸다.
- 발생한 문제/관찰: `도착 전 남길 시간`의 iOS 네이티브 slider와 비교해 탭바가 무겁고 평면적으로 보였다. 탭바는 네이티브 slider의 재질을 공유하지 않는 커스텀 React Native View다.
- 교체한 방식: iOS 26에서 시스템과 컴파일 환경이 모두 지원하면 `GlassView`의 실제 Liquid Glass를 사용한다. iOS 17~25에서는 어두운 `BlurView`, 투명도 감소 접근성 설정에서는 불투명 surface를 사용한다.
- 교체 이유: 프로젝트의 iOS 17 최소 지원을 유지하면서 최신 iPhone에서는 시스템 glass를 사용하고, 구형 OS·접근성 설정에서도 대비와 탭 조작을 잃지 않기 위해서다.
- 상태: **현행 구현**. 네 탭의 즉시 전환·균등 폭·최소 52pt 높이·일반 탭 haptic 0과 주변 시트의 실측 `onFrame` 계약은 유지한다.

## 충돌 검토

- `docs/README.md`의 2026-09-14 안내에는 추가 UI 수정은 별도 범위 확정 뒤 진행한다고 되어 있다. 2026-09-15 사용자가 전체 구조 다듬기를 명시적으로 재개하고 본 탭바 변경안을 승인했으므로 작업 범위 충돌은 해소됐다.
- Liquid Glass는 iOS 26 이상에서만 실제 재질로 동작하지만 앱의 최소 지원은 iOS 17이다. iOS 최소 버전을 올리지 않고 Blur fallback으로 해소했다.
- 앱은 `UIUserInterfaceStyle=Light`로 빌드되지만 제품 화면은 어두운 테마다. 시스템 전체 외형 정책은 바꾸지 않고 탭바 `GlassView`만 `colorScheme="dark"`로 제한해 기존 화면 대비를 유지했다.
- 주변 화면은 탭바의 실측 frame으로 시트·목록 하단 여백을 계산한다. 외곽 wrapper와 `onLayout`을 유지했고 관련 실행형 fixture로 회귀를 확인했다.
- 추천·저장·개인화·DB·외부 API·Live Activity 상태에는 변경이 없다.

## 완료 인수인계

### 1. 변경 파일과 변경 목적

- `src/ui/FloatingTabBar.tsx`: Liquid Glass/Blur/불투명 접근성 fallback surface와 어두운 글래스용 대비·캡슐 외형을 적용했다.
- `src/ui/floatingTabGlassModel.ts`: OS·네이티브 API·투명도 감소 조건에 따른 재질 선택을 순수 경계로 분리했다.
- `package.json`, `package-lock.json`: Expo SDK 56 호환 `expo-glass-effect ~56.0.4`, `expo-blur ~56.0.4`를 추가했다.
- `test/ui/floating-tab-glass.test.ts`: 재질 선택, 네이티브 표면 연결, 접근성 fallback, 무햅틱·frame 계약을 고정했다.
- `test/ui/nearby-browse-screen.test.mjs`: 실제 FloatingTabBar 실행 fixture에 새 네이티브 표면만 주입했다. 파일의 기존 수동 장소 UI 변경은 되돌리지 않았다.

### 2. 유지한 공개 계약·정책 경계

- 메인·주변 둘러보기·기록·내정보의 네 행동과 탭 즉시 전환을 유지했다. 선택 indicator의 좌우 이동이나 페이지 전환 animation은 추가하지 않았다.
- 네 항목 균등 폭, 최소 52pt 터치 높이, safe area 하단 여백과 `onFrame` 측정을 유지했다.
- 일반 버튼·탭 haptic은 0이다. TimeWheel과 도착 여유 slider 전용 selection haptic 계약을 변경하지 않았다.
- 추천·저장·개인화·DB·API·지도 목적지·진행·Live Activity 정책을 변경하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 선행: 새 재질 모델이 없는 상태에서 `floating-tab-glass` fixture가 `ERR_MODULE_NOT_FOUND`로 실패하는 것을 확인했다.
- 집중 회귀: FloatingTabBar glass + 주변 시트 frame + 공용 interaction `44/44` 통과.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: `787`개 중 `786` 통과, 실패 `0`, 기존 제외 `1`.
- `npm test`: `547/547` 통과. 최초 실행의 새 `.mjs` 테스트가 전체 Node 발견 경계에서 TypeScript 모듈을 직접 읽어 1건 실패했으며, UI 테스트 규칙에 맞게 `.test.ts`로 옮긴 뒤 전체 통과했다. 제품 결함은 아니었다.
- `pod install`: `ExpoGlassEffect 56.0.4`, `ExpoBlur 56.0.4` 설치 확인.
- iPhoneOS generic device Debug build, 서명 제외: 성공. 앱과 Live Activity 확장 포함, iOS 17 deployment 유지. Simulator는 실행하지 않았다.
- iOS Expo bundle export: 성공, `/private/tmp/timefit-glass-export.ArNR5r`.
- `git diff --check`: 통과.

### 4. 다음 결정·위험·재현 조건

- 새 네이티브 모듈이므로 기존 설치 앱의 Metro/OTA 갱신만으로는 확인할 수 없다. 새 iOS 빌드를 설치해야 한다.
- 사용자 시각 확인: iOS 26 기기에서 메인·주변 지도·기록·내정보를 각각 열어 실제 Liquid Glass, 밝은 지도 위 대비, 네 탭 균등 배치, 주변 시트와 마지막 행 비가림을 확인한다. 가능하면 `설정 > 손쉬운 사용 > 디스플레이 및 텍스트 크기 > 투명도 줄이기` ON에서 불투명 fallback도 확인한다.
- iOS 17~25에서는 Liquid Glass가 아니라 Blur fallback이 정상 기대값이다. 두 재질의 미세한 색 차이는 허용하되 텍스트 대비와 터치 크기는 동일해야 한다.
- 자동 테스트와 generic device build는 실제 광학 효과를 판정하지 못한다. 사용자가 시각 확인하기 전 최종 tint·blur 강도 수락으로 기록하지 않는다.

## 사용자 반환 보완 — 2026-09-15

### 교체 이력

- 이전 방식: `GlassView`를 탭 버튼과 분리된 absolute 배경으로 두고 기본값인 비상호작용 상태로 사용했다. 짙은 `rgba(17, 28, 43, 0.46)` tint와 파란 선택 배경을 그 위에 겹쳤다.
- 발생한 문제/관찰: 새 네이티브 빌드에도 탭바가 기존 어두운 blur 패널처럼 보여 Liquid Glass 적용 여부를 시각적으로 구별하기 어려웠다. 초기 테스트는 패키지·분기 존재만 확인해 Glass가 실제 탭 내용을 소유하는지 검증하지 못했다.
- 교체한 방식: iOS 26 liquid 분기에서 `GlassView`가 네 탭 내용을 직접 감싸며 `isInteractive`를 사용하도록 했다. tint alpha를 `0.16`으로 낮추고 선택 표면을 얇은 흰색 투명층으로 바꿔 배경 굴절과 밝기 반응을 가리지 않게 했다.
- 교체 이유: 네이티브 유리 표면과 조작 영역을 같은 계층에 두어 실제 상호작용 재질을 사용하면서도, 탭 전환·균등 폭·공용 press animation 계약을 유지하기 위해서다.
- 상태: **보완 구현·자동/네이티브 검증 완료, 사용자 시각 재확인 대기**. iOS 17~25 blur와 투명도 줄이기 solid fallback은 유지한다.

### 완료 인수인계

1. 변경 파일과 변경 목적
   - `src/ui/FloatingTabBar.tsx`: liquid 분기의 Glass 표면이 탭 내용을 직접 감싸도록 계층을 수정하고 상호작용형 재질·낮은 tint·투명 선택 표시를 적용했다.
   - `test/ui/floating-tab-glass.test.ts`: 정적 배경 구현이 다시 들어오지 않도록 Glass content ownership, `isInteractive`, 과도한 기존 tint 제거를 실패 선행 계약으로 추가했다.
   - `docs/work/uiux/floating-tab-liquid-glass.md`: 사용자 반환 원인, 교체 방식, 검증과 남은 시각 확인을 기록했다.

2. 유지한 공개 계약·정책 경계
   - 네 탭의 즉시 전환, 균등 폭, 최소 52pt 조작 높이, safe area와 주변 시트 `onFrame` 계약을 유지했다.
   - 일반 탭 haptic 0과 공용 `AnimatedPressable` 눌림 animation을 유지했다.
   - iOS 26 미지원/API 미지원 시 blur, 투명도 줄이기 시 solid fallback을 유지했다.
   - 추천·저장·개인화·지도·진행·Live Activity·DB/API 정책은 변경하지 않았다.

3. 실행한 테스트와 결과
   - 실패 선행: `GlassView`가 self-closing 배경이고 `isInteractive`가 없어 새 ownership 계약 1건이 실패하는 것을 확인했다.
   - 집중 회귀: Liquid Glass + 공용 interaction `20/20` 통과.
   - `npm run test:typecheck`: 통과.
   - `npm run test:ui`: `788`개 중 `787` 통과, 실패 `0`, 기존 제외 `1`. 최초 실행에서 공용 interaction fixture가 기존 `style={[s.item, isActive && s.itemOn]}` 계약 변경을 잡아냈고, 임시 분기 스타일을 두지 않고 공통 선택 스타일 하나로 정리한 뒤 전체 통과했다.
   - `npm test`: `547/547` 통과.
   - 서명 제외 generic iPhoneOS Debug build: 성공. 앱과 Live Activity extension을 함께 빌드했으며 Simulator는 실행하지 않았다.
   - iOS Expo bundle export: 성공, `/private/tmp/timefit-glass-interactive-export`.
   - `git diff --check`: 통과.

4. 다음 결정·위험·재현 조건
   - 실제 광학 효과는 자동 테스트와 generic device build로 판정할 수 없다. 새 네이티브 빌드를 iOS 26 기기에 설치해 메인 단색 배경과 주변 지도 배경에서 모두 확인해야 한다.
   - 확인 항목은 배경이 비치는 유리 표면, 탭 접촉 시 시스템 반응, 선택 표시의 가독성, 네 탭 균등 폭, 주변 시트와 마지막 항목 비가림이다.
   - 투명도 줄이기가 켜져 있거나 iOS 26 미만이면 Liquid Glass가 보이지 않는 것이 정상이다. 이 경우 설정/OS 조건과 구현 실패를 구분한다.

## Instagram형 동적 선택 렌즈 보완 — 2026-09-15

### 결정과 교체 이력

- 이전 방식: 네 개 탭은 각각 `onPress`만 처리했고, 활성 탭 배경은 해당 항목에 고정돼 있었다. `GlassView.isInteractive`는 광학 반응만 제공하므로 누른 채 탭 사이를 이동하는 선택 동작은 없었다.
- 발생한 문제/관찰: Liquid Glass 재질은 적용됐지만 Instagram형 하단 탭처럼 선택 캡슐이 눌림에 반응하고 손가락을 따라 이동하지 않아 일반 반투명 탭바로 느껴졌다.
- 교체한 방식: 탭바 전체의 가로 drag responder와 독립적인 selection lens를 추가했다. 짧은 탭은 기존 화면 전환을 즉시 실행하면서 렌즈만 spring으로 이동한다. 누른 채 가로 이동하면 렌즈가 연속 좌표를 따라가고, 손을 놓은 위치의 탭을 한 번만 확정한다. 세로 이동은 가로 drag로 점유하지 않고, 취소되면 현재 탭으로 돌아온다.
- 교체 이유: 화면 페이지 전환 animation을 다시 도입하지 않으면서 탭바 자체에만 동적인 Liquid Glass 인상을 주기 위해서다.
- 상태: **구현·자동/네이티브 검증 완료, 사용자 실기기 시각·제스처 확인 대기**.

### 충돌 처리

- 기존 결정인 “탭 화면은 페이지 넘김 animation 없이 즉시 전환”을 유지했다. 선택 렌즈의 이동은 화면 전환 animation이 아니라 탭바 내부 피드백이다.
- drag 도중 지나가는 화면을 계속 교체하면 현재의 화면별 stack reset과 충돌하고 불필요한 다중 navigation을 발생시키므로 적용하지 않았다. drag는 놓을 때 선택한 화면으로 한 번만 전환한다.
- 일반 버튼 haptic 0 계약을 유지했으며 탭 drag에도 새 haptic을 추가하지 않았다.

### 완료 인수인계

1. 변경 파일과 변경 목적
   - `src/ui/FloatingTabBar.tsx`: 동적 selection lens, 눌림 lift/stretch, 가로 drag 추적, release 단일 navigation, terminate 복귀와 Reduce Motion 처리를 추가했다.
   - `src/ui/floatingTabGlassModel.ts`: 가로 좌표를 네 개 균등 탭으로 안전하게 clamp하는 순수 계산을 추가했다.
   - `test/ui/floating-tab-glass.test.ts`: 위치 경계와 production gesture/lens 연결을 실패 선행으로 고정했다.
   - `test/ui/nearby-browse-screen.test.mjs`: 실제 FloatingTabBar 실행 fixture에서 layout, 가로/세로 판정, drag 중 무전환, release 1회 전환, 취소 무전환을 검증했다.
   - `docs/work/uiux/floating-tab-liquid-glass.md`: 현행 동작과 기존 즉시 전환 결정의 양립 범위를 기록했다.

2. 유지한 공개 계약·정책 경계
   - 짧은 탭의 즉시 화면 전환, 네 항목 균등 폭, safe area, 주변 시트의 탭 frame 측정을 유지했다.
   - iOS 26 Liquid Glass, iOS 17~25 blur, 투명도 줄이기 solid fallback을 유지했다. 동적 렌즈는 fallback에서도 선택 위치 피드백을 유지한다.
   - Reduce Motion에서는 spring 이동과 lift를 즉시 값 반영으로 낮춘다.
   - 탭 haptic, 추천·저장·개인화·지도·진행·Live Activity·DB/API 정책은 변경하지 않았다.

3. 실행한 테스트와 결과
   - 실패 선행: 탭 위치 resolver와 `PanResponder`/selection lens가 없어 집중 계약 2건이 실패하는 것을 확인했다.
   - 집중 실행형 회귀: glass/model + 실제 주변 탭 연결 + 공용 interaction `47/47` 통과.
   - `npm run test:typecheck`: 통과.
   - `npm run test:ui`: `790`개 중 `789` 통과, 실패 `0`, 기존 제외 `1`.
   - `npm test`: `547/547` 통과.
   - iOS Expo bundle export: 성공, `/private/tmp/timefit-glass-dynamic-export`.
   - 서명 제외 generic iPhoneOS Debug build: 성공, `/private/tmp/timefit-glass-dynamic-derived`. Simulator는 실행하지 않았다.
   - `git diff --check`: 통과.

4. 다음 결정·위험·재현 조건
   - 새 빌드를 iOS 26 실기기에 설치해 ① 짧은 탭 시 화면 즉시 전환과 렌즈 이동, ② 한 탭을 누른 채 좌우 이동 시 연속 추적, ③ 손을 놓을 때 선택 화면 1회 전환, ④ 세로 이동/바깥 취소 시 현재 탭 유지, ⑤ 주변 시트 drag와의 경쟁이 없는지 확인한다.
   - 화면별 stack은 유지했기 때문에 drag 중 콘텐츠 미리보기는 제공하지 않는다. 이는 현행 즉시 전환·단일 navigation 계약을 지키기 위한 의도된 범위다.
   - 자동 fixture는 좌표·호출 횟수·접근성 감소 동작을 검증하지만 실제 손가락 추적의 탄성 체감과 유리 광학 효과는 판정하지 못한다.

## 연속 드래그 메인 복귀 버그 보완 — 2026-09-15

### 원인과 교체 이력

- 이전 방식: drag 이동·종료 시 responder event의 `nativeEvent.locationX`를 탭바 전체 좌표로 간주해 대상 탭을 계산했다.
- 발생한 문제/관찰: 첫 drag로 다른 화면에 이동한 뒤 두 번째 drag를 시작하면 `locationX`가 눌린 자식 탭 기준으로 전달될 수 있었다. 이 값은 다시 첫 번째 슬롯 범위로 해석되어 의도와 관계없이 메인으로 이동했다.
- 교체한 방식: `locationX` 의존을 제거하고 `누르기 시작한 탭 index + gesture.dx / 슬롯 폭`으로 연속 렌즈 위치와 release 대상 탭을 계산한다. 시작 탭은 각 `onPressIn`에서 기록하고 화면의 활성 탭 변경·취소 시 동기화한다.
- 교체 이유: 자식 view와 responder 소유권에 따라 좌표 원점이 바뀌어도 연속 drag의 기준점이 흔들리지 않도록 하기 위해서다.
- 상태: **수정·자동/네이티브 검증 완료, 사용자 실기기 재확인 대기**.

### 완료 인수인계

1. 변경 파일과 변경 목적
   - `src/ui/FloatingTabBar.tsx`: drag 기준을 시작 탭과 누적 `gesture.dx`로 변경하고 release·terminate 시 기준 탭을 동기화했다.
   - `src/ui/floatingTabGlassModel.ts`: 연속 drag progress와 최종 index 계산을 순수 함수로 분리했다.
   - `test/ui/floating-tab-glass.test.ts`, `test/ui/nearby-browse-screen.test.mjs`: 마지막 탭에서 두 번째 drag, 양 끝 clamp, 연속 두 번 release와 취소 반례를 추가했다.

2. 유지한 공개 계약·정책 경계
   - 짧은 탭 즉시 전환, drag release 단일 전환, 세로 gesture 비점유, 취소 시 현재 탭 유지와 무햅틱을 유지했다.
   - Liquid Glass/blur/solid 재질 fallback, 주변 시트 frame, 추천·저장·개인화·진행·DB/API 계약은 변경하지 않았다.

3. 실행한 테스트와 결과
   - 실패 선행: 두 번째 drag를 현재 탭이 아니라 child-local x로 첫 탭에 귀속시키는 경계를 새 순수 fixture 부재 실패로 재현했다.
   - 집중 실행형 회귀: `48/48` 통과.
   - `npm run test:typecheck`: 통과.
   - `npm run test:ui`: `791`개 중 `790` 통과, 실패 `0`, 기존 제외 `1`.
   - `npm test`: `547/547` 통과.
   - iOS Expo bundle export: 성공, `/private/tmp/timefit-glass-redrag-fix-export`.
   - 서명 제외 generic iPhoneOS Debug build: 성공, `/private/tmp/timefit-glass-dynamic-derived`. Simulator는 실행하지 않았다.
   - `git diff --check`: 통과.

4. 다음 결정·위험·재현 조건
   - 새 빌드에서 `메인 → 내정보` drag 후 `내정보 → 기록`, 이어서 `기록 → 주변 둘러보기`를 반복해 메인으로 튀지 않는지 확인한다.
   - 탭 중앙에서 시작하지 않고 아이콘·텍스트 가장자리에서 시작하는 경우와 좌우 끝을 벗어나는 drag도 확인한다. 끝을 벗어난 경우 첫/마지막 탭에 고정되는 것이 현행 기대값이다.

## 일반 탭 중복 선택 효과 보완 — 2026-09-15

### 원인과 교체 이력

- 이전 방식: 일반 탭의 `onPressIn`에서 대상 위치로 lens spring을 시작하고, navigation reset으로 새 화면의 탭바가 마운트되면 active effect가 같은 대상 위치로 spring을 다시 시작했다.
- 발생한 문제/관찰: 사용자는 한 번 탭했지만 이전 화면과 새 화면에서 선택 이동이 각각 실행되어 두 번 선택되거나 튀는 것처럼 보였다. 기존 실행형 fixture는 `onPress`만 호출해 `onPressIn → onPressOut → onPress → unmount/remount` 전체 순서를 검증하지 않았다.
- 교체한 방식: 일반 `onPressIn`은 눌린 탭 index 기록과 lens lift만 수행한다. 위치 spring은 즉시 화면 전환 후 새 탭바가 active를 반영할 때 한 번만 실행한다. drag responder가 실제로 시작된 경우에만 시작 탭 위치를 직접 고정한 뒤 기존 연속 추적을 수행한다.
- 교체 이유: 화면 전환은 즉시 유지하면서 선택 위치 animation의 소유자를 새 탭바 한 곳으로 제한하기 위해서다.
- 상태: **수정·자동/네이티브 검증 완료, 사용자 실기기 재확인 대기**.

### 완료 인수인계

1. 변경 파일과 변경 목적
   - `src/ui/FloatingTabBar.tsx`: 일반 press-in의 중복 위치 spring을 제거하고 drag grant에서만 시작 위치를 고정했다.
   - `test/ui/floating-tab-glass.test.ts`: 일반 press-in이 위치를 움직이지 않는 소유권 계약을 추가했다.
   - `test/ui/nearby-browse-screen.test.mjs`: 실제 탭 이벤트 전체 순서와 화면 unmount/remount를 실행해 대상 위치 spring이 1회인지 검증했다.

2. 유지한 공개 계약·정책 경계
   - 짧은 탭의 즉시 화면 전환, 눌림 lift, 새 화면에서의 1회 lens 이동을 유지했다.
   - 길게 누른 drag의 시작 위치·연속 추적·release 단일 전환과 이전 연속 drag 보완을 유지했다.
   - 무햅틱, Reduce Motion, Liquid Glass/blur/solid fallback, 주변 시트와 제품 정책은 변경하지 않았다.

3. 실행한 테스트와 결과
   - 실패 선행: 일반 `onPressIn`에 `settleLens(tabIndex)`가 남아 있어 위치 animation 소유권 계약이 실패하는 것을 확인했다.
   - 집중 실행형 회귀: `50/50` 통과. 실제 `press-in → press-out → press → unmount → target remount`에서 대상 위치 spring 1회를 확인했다.
   - `npm run test:typecheck`: 통과.
   - `npm run test:ui`: `793`개 중 `792` 통과, 실패 `0`, 기존 제외 `1`.
   - `npm test`: `548/548` 통과.
   - iOS Expo bundle export: 성공, `/private/tmp/timefit-glass-single-tap-fix-export`.
   - 서명 제외 generic iPhoneOS Debug build: 성공, `/private/tmp/timefit-glass-dynamic-derived`. Simulator는 실행하지 않았다.
   - `git diff --check`: 통과.

4. 다음 결정·위험·재현 조건
   - 새 빌드에서 각 비활성 탭을 한 번씩 짧게 눌러 화면은 즉시 전환되고 lens 위치 이동은 한 번만 보이는지 확인한다.
   - 같은 활성 탭 재탭, 빠른 연속 탭, 짧은 탭 직후 길게 눌러 drag를 시작하는 경우도 중복 이동·메인 복귀 없이 동작하는지 확인한다.
