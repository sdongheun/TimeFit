# U-INTERACTION-01 — 전역 상호작용 모션·시간 휠·화면 전환

상태: **수락 — 공용 눌림·시간 wheel/도착 여유 slider 햅틱·화면 전환 검증 완료**

## 작업 목적

TimeFit의 출시 화면에 다음 세 가지를 한 번에 적용한다.

1. 앱이 소유한 버튼·탭 가능한 카드·칩은 손가락을 누르고 떼는 감각이 보이도록 짧은 scale/opacity 애니메이션을 사용한다.
2. 도착 시각과 개발 테스트 시각은 iOS 시계 앱에 가까운 오전/오후·시·분 wheel picker로 통일하고, 빠른 스와이프의 관성 이동과 행 경계 selection haptic을 제공한다. `도착 전 남길 시간` slider도 사용자가 새 5분 값에 진입할 때만 같은 selection haptic을 제공한다.
3. 메인 화면 계층은 native iOS push/pop을 사용하고, 임시 선택 화면은 modal/sheet, Results 내부 선택 변화는 해당 영역만 짧게 전환한다.

이번 작업은 디자인 전면 개편이 아니다. 이미 수락된 추천 결과·최대 2곳 선택·호출 예산·카드 정보 구조를 유지한 채 **조작 반응과 화면 계층 인지**만 개선한다.

## 먼저 읽을 파일

다음 파일만 먼저 읽고 시작한다. 과거 UIUX archive와 추천/API 작업 기록 전체를 읽지 않는다.

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/작업조정_보드.md`의 `U-INTERACTION-01`, `U-TWO-STOP-04`, `QA-TWO-STOP-02`
4. `docs/03_product/UIUX_공통규칙.md`의 `2. 화면 전환과 뒤로가기`, `3. 주요 버튼`, `3-1. 위치·도착 시각 입력과 배포 경계`
5. `docs/03_product/UIUX_테스트명세.md`의 `UXV-48~50`
6. `docs/테스트.md`의 `UX-28~30`
7. `App.tsx`, `src/ui/TimeWheel.tsx`, `src/ui/TimeSetupScreen.tsx`, `src/ui/ResultsScreen.tsx`

## 현재 문제와 교체 이유

| 이전 방식 | 관찰된 문제 | 이번 교체 방식 | 상태 |
|---|---|---|---|
| `App.tsx`가 모든 Stack 화면에 `fade/250ms` 적용 | 진입과 복귀 방향이 같아 화면 계층이 약하고 iOS edge-swipe와 시각 방향이 맞지 않음 | native stack 기본 push/pop 복원 | 현행 (U-INTERACTION-01) |
| 각 화면이 raw `Pressable`의 반응을 제각각 구현하거나 반응이 없음 | 탭이 인식됐는지 불분명하고 카드·CTA의 촉감이 일관되지 않음 | UIUX 공용 animated pressable과 명시적 크기 variant | 현행 (U-INTERACTION-01) |
| 일반 버튼까지 햅틱 범위로 오해할 수 있음 | 지나친 진동은 피로하고 행동 중요도가 왜곡됨 | 일반 조작은 시각적 눌림만, selection haptic은 시간 wheel과 도착 여유 slider의 불연속 값 변경에만 opt-in | 확정 경계 |
| `TimeWheel`이 drag 종료에도 즉시 외부 값을 확정 | momentum 도중 prop 동기화와 `scrollTo`가 개입해 관성 이동을 끊을 수 있음 | 스크롤 중 내부 행만 갱신하고 momentum 종료에서 외부 값 확정 | 현행 (U-INTERACTION-01) |
| 오전/오후는 텍스트 버튼, 시·분만 wheel | 한 시간 입력 안에서 조작 방식이 혼재 | 오전/오후·시·분을 독립 wheel로 통일 | 현행 (U-INTERACTION-01) |

## 소유 경계와 금지 사항

- 수정 가능: `App.tsx`, `src/ui/`, UI 관련 테스트, `package.json`, lockfile. `expo-haptics` 설치로 필요한 최소 네이티브 의존 기록만 허용한다.
- 수정 금지: `src/engine/`, 추천 후보·순위·시간 계산, 외부 API/Route Proxy, Supabase, DB migration, 장소 데이터와 env.
- `REC-32/33`의 A/B 선택, 동일 session 역선택 0-call, initial 3·누적 6, 16/12/36 예산, B 추가시간 계산을 변경하지 않는다.
- 일반 CTA·뒤로가기·카드·칩·탭·더보기·tray 삭제에는 햅틱을 호출하지 않는다. 공용 pressable 내부에도 햅틱을 넣지 않는다. 햅틱 허용 범위는 시간 wheel과 도착 여유 slider의 사용자 단위 변경뿐이며, 세부 구현·수락 기준은 문서 마지막 2차 보완 명령이 앞선 범위를 교체한다.
- 실제 API, Simulator, 실기기, Metro, Xcode를 이번 자동 구현 확인에 사용하지 않는다. native 체감은 새 internal build를 만든 뒤 별도 출시 smoke에서 한 번만 확인한다.
- 사용자 요청 전 commit·push하지 않는다.

## 구현 순서

### 1. 실패 우선 테스트와 조작 인벤토리

코드 변경 전에 `UXV-48~50`을 관찰하는 실패 테스트를 먼저 추가한다.

- `rg`로 `src/ui/**/*.tsx`와 `App.tsx`의 앱 소유 `Pressable`을 목록화한다.
- 테스트는 특정 JSX 문자열만 검사하지 말고, 공용 pressable의 press-in/release/disabled/Reduce Motion 결정과 wheel의 drag/momentum/동기화 결정을 가능한 한 순수 상태 모듈 또는 주입 가능한 adapter 경계로 검증한다.
- 현재 `App.tsx`의 전역 fade, 일반 버튼의 haptic 0회, wheel의 고속 drag에서 조기 commit 문제를 각각 재현한다.
- 이미 수락된 두 곳 선택 fixture를 삭제·완화하거나 새 모션 테스트로 대체하지 않는다.

### 2. 공용 animated pressable

UIUX 소유 경로에 공용 컴포넌트를 만든다. 이름은 구현자가 정할 수 있지만 역할은 하나여야 한다.

- 기존 `Pressable`의 `onPress`, `onPressIn`, `onPressOut`, `disabled`, `hitSlop`, `testID`, accessibility props와 함수형 `style`을 보존한다.
- 일반/카드/CTA는 press-in `80ms` 이하에서 scale `0.97~0.98`, opacity `0.90~0.94`; 작은 아이콘 버튼은 scale `0.94~0.96`을 쓴다. release는 `140~200ms` easing 또는 과장되지 않은 spring이다.
- layout 크기·터치 영역은 애니메이션 중 바꾸지 않는다. transform과 opacity만 사용한다.
- disabled/busy 상태에서는 눌림 애니메이션을 시작하지 않고 기존 동기 중복 실행 lock을 보존한다.
- `AccessibilityInfo`의 Reduce Motion 상태에서는 scale을 제거하고 opacity 또는 즉시 상태만 사용한다.
- 공용 컴포넌트는 햅틱 모듈을 import하거나 호출하지 않는다. 테스트에서 일반 버튼 press 전후 haptic 호출 0을 확인한다.
- 앱 소유의 실제 버튼·카드·칩을 이 경계로 이관한다. 출시 핵심 흐름(`Home → TimeSetup → Results → CourseConfirm → VerifiedCourseProgress`, 위치 선택, CAPTCHA, 하단 탭, A/B tray·후보·CTA)을 먼저 바꾸고, 이어서 접근 가능한 `MyCourses/Profile/ActivityRecord/Feedback/Execution`을 처리한다.
- raw `Pressable`을 남기는 경우에는 WebView/지도 SDK 내부 제어, 제스처용 비버튼 등 제외 이유와 파일·행을 인수인계에 기록한다. 과거 철회 화면이라는 이유만으로 현재 navigator나 import graph에 연결된 화면을 누락하지 않는다.

### 3. iOS형 시간 wheel과 selection haptic

- `npx expo install expo-haptics`로 Expo SDK와 맞는 버전을 설치한다. 임의 버전 고정이나 별도 애니메이션 라이브러리는 추가하지 않는다.
- 오전/오후, 시, 분을 모두 독립 wheel로 만든다. 도착 시각과 개발 테스트 시각이 같은 컴포넌트·동작을 재사용한다.
- `snapToInterval`, 빠른 deceleration과 momentum을 유지하며 `disableIntervalMomentum`을 사용하지 않는다.
- 스크롤 중에는 wheel 내부의 active index만 갱신해 글자 강조가 손가락을 따라가게 한다. 외부 `onChange`는 momentum 종료 시 한 번 확정하고, momentum이 발생하지 않은 낮은 속도 drag만 drag 종료에서 확정한다.
- 고속 drag의 `onScrollEndDrag`가 먼저 호출돼도 외부 prop 변경과 programmatic `scrollTo`가 뒤의 momentum을 끊지 않게 한다. 사용자 조작 중에는 외부 index 동기화 scroll을 유예하고 종료 뒤 필요한 경우에만 맞춘다.
- selection haptic은 **사용자 스크롤로 실제 active row 경계를 처음 넘은 경우에만** 발생한다. mount, 외부 prop 동기화, programmatic scroll, 같은 index 반복, 최종 snap의 중복 callback에는 발생하지 않는다.
- haptic 호출은 주입 가능한 작은 adapter로 분리해 테스트에서 횟수를 셀 수 있게 한다. 일반 pressable과 공유하지 않는다.
- 빈 values, 범위를 벗어난 index, 값 배열 변경은 crash 없이 clamp 또는 안전 비표시하고 무한 `scrollTo ↔ onChange` 루프를 만들지 않는다.
- VoiceOver에는 현재 값과 adjustable 역할을 제공하고 증가/감소 동작으로 한 칸씩 조절할 수 있게 한다. 접근성 조절도 값은 바꾸되 일반 버튼 햅틱 정책으로 확대하지 않는다.

### 4. 화면 전환

- `App.tsx`의 전역 `animation: "fade"`와 `animationDuration`을 제거해 `createNativeStackNavigator`의 iOS 기본 push/pop과 edge-swipe를 복원한다.
- `시간 설정 → 추천 결과 → 코스 확인 → 진행`의 기존 navigation 방식과 params를 바꾸지 않는다. 화면 전환을 위해 새 route나 중복 화면을 만들지 않는다.
- 위치 검색·지도 선택은 현재 slide modal 동작을 유지한다. CAPTCHA는 임시 sheet라는 계층이 보이도록 아래에서 올라오고 닫힐 때 내려가게 하되, 투명 scrim·WebView 생명주기·취소/재시도 계약을 깨지 않는다.
- Results의 A 선택/B loading·후보/취소·더보기는 navigation하지 않는다. 기존 동일 ScrollView와 snapshot 복원을 유지하고, **바뀌는 카드 영역에만** opacity + 아래쪽 `8~12px` 전환을 `160~220ms`로 적용한다. 네트워크가 빨라도 느려도 완료를 기다리기 위한 인위적 delay를 넣지 않는다.
- 탭은 push 전환으로 바꾸지 않는다. 현행 즉시 전환을 유지하거나 이미 안정된 공통 경계가 있을 때만 150ms 이하 cross-fade를 사용한다.
- Reduce Motion에서는 큰 translate/scale을 제거하고 즉시 전환 또는 짧은 opacity만 남긴다.

## 필수 자동 검증

최소 다음을 고정 fixture로 확인한다.

1. 일반 CTA·카드·아이콘의 press-in/release 값과 disabled 무반응
2. 일반 조작의 haptic 호출 0
3. wheel 사용자 행 변경만 selection haptic 1회, mount/prop sync/중복 index는 0
4. 고속 drag는 drag end에서 조기 commit하지 않고 momentum end에서 최종 값 1회 commit
5. 저속 drag·접근성 increment/decrement·외부 값 변경의 안전 동기화
6. Reduce Motion에서 버튼 scale과 큰 화면 translate 제거
7. native stack 전역 fade 제거, modal/sheet와 Results region 전환의 역할 분리
8. 기존 testID·accessibility label/state·disabled/busy와 A/B 선택 snapshot 불변
9. `QA-TWO-STOP-02`의 역선택 0-call과 B 추가시간 회귀 불변

실행 명령:

```bash
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

관련 테스트가 실패하면 기존 테스트를 삭제·완화하지 않는다. 실패 원인과 최초 fixture를 기록하고 중단한다.

## 완료 기준과 인수인계

다음이 모두 충족돼야 완료다.

1. 전역 fade가 제거되고 화면 계층별 전환이 기준과 일치한다.
2. 앱 소유 버튼 인벤토리에서 공용 눌림 경계를 적용했거나 예외 이유가 전부 기록된다.
3. 일반 버튼 haptic 0과 시간 wheel·도착 여유 slider 전용 haptic이 자동 테스트로 분리 증명된다.
4. 고속 wheel momentum이 조기 controlled update로 끊기지 않고 최종 값이 한 번만 확정된다.
5. 추천 엔진/API/data/DB/추천 session·예산·Course snapshot 계약을 바꾸지 않는다.
6. 필수 자동 명령이 전부 통과한다.

완료 인수인계에는 반드시 다음을 남긴다.

- 변경 파일과 각 변경 목적
- raw `Pressable` 잔여 목록과 제외 이유
- 일반 버튼 haptic 0, wheel haptic 횟수, momentum commit 횟수의 fixture 수치
- 실행한 테스트와 통과/실패/기존 skip 수
- `expo-haptics` 추가로 새 internal iOS build가 필요한지 여부
- 실기기 smoke에서만 확인할 항목: 빠른 wheel 관성·촉각 세기, edge-swipe, modal 방향, 작은 iPhone의 Results 고정 CTA/카드 가림

## 완료 인수인계 — 2026-09-04

### 1. 변경 파일과 변경 목적

- `App.tsx`: 전역 `fade/250ms`를 제거해 native stack 기본 push/pop을 복원하고 Execution 헤더 아이콘을 공용 press 경계로 이관했다.
- `src/ui/AnimatedPressable.tsx`, `src/ui/pressInteractionModel.ts`: 일반/카드/CTA `scale 0.975`, 아이콘 `0.95`, opacity `0.92`, press-in `70ms`, release `170ms`의 transform/opacity 전용 경계를 추가했다. `disabled`, 명시 `busy`, `accessibilityState.busy`는 동작과 애니메이션을 함께 차단하며 Reduce Motion에서는 scale을 `1`로 유지한다. 햅틱 import·호출은 없다.
- 현재 `App.tsx` import graph에서 앱 소유 `Pressable`을 쓰는 `src/ui/` 화면·표시 컴포넌트 27곳: raw import를 공용 `AnimatedPressable` alias로 교체했다. 기존 `onPress/onPressIn/onPressOut`, 함수형 style, disabled, hitSlop, testID, accessibility props와 화면 문구·레이아웃은 유지했다. 뒤로가기·닫기·지도 아이콘·tray 삭제처럼 작은 아이콘 전용 컨트롤만 `icon` variant를 사용한다.
- `src/ui/TimeWheel.tsx`, `src/ui/timeWheelInteraction.ts`, `src/ui/TimeSetupScreen.tsx`: 오전/오후·시·분을 같은 독립 wheel로 통일했다. 사용자 drag 중 로컬 active row만 갱신하고 고속 drag는 momentum 종료에서 한 번, 저속 non-momentum drag는 drag 종료에서 한 번만 외부 값을 확정한다. selection haptic adapter, prop/programmatic 동기화 분리, 빈 값/clamp, VoiceOver adjustable 증가·감소를 추가했다.
- `src/ui/InPlaceTransition.tsx`, `src/ui/inPlaceTransitionModel.ts`, `src/ui/ResultsScreen.tsx`: 같은 Results/ScrollView의 A/B 카드 영역에만 opacity `0.82→1` + translateY `10→0`, `190ms` 전환을 적용했다. Reduce Motion에서는 translateY가 `0`이다.
- `src/ui/CaptchaVerificationSheet.tsx`: 투명 scrim·WebView 상태 계약을 유지하고 임시 sheet 방향만 `fade → slide`로 교체했다. 위치 검색/지도 선택의 기존 slide modal은 유지했다.
- `package.json`, `package-lock.json`: Expo SDK 호환 `expo-haptics ~56.0.3`을 `npx expo install expo-haptics`로 추가했다.
- `test/ui/global-interaction-motion.test.ts`, `test/map-transport-ui-contract.test.mjs`: 실패 우선 재현과 press/momentum/haptic/Reduce Motion/전환/source inventory 회귀를 추가하고 오전/오후 wheel 계약으로 기존 UI source 계약을 갱신했다. 최초 실패 우선 결과는 `0/3` 통과(전역 fade·drag-end 조기 commit·공용 press 경계 부재 재현), 구현 후 전용 fixture는 `7/7` 통과다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 추천 엔진, 외부 API/Route Proxy, 장소 데이터, Supabase/DB를 수정하지 않았다.
- `REC-32/33` A/B 선택, 동일 session 역선택 0-call, initial 3·누적 6, shared 12, 16/12/36 호출 예산, B 추가시간, Results snapshot/scroll 복원 계약을 변경하지 않았다.
- 일반 CTA·카드·칩·탭·뒤로가기·tray 삭제의 haptic 호출은 `0`이다. selection haptic은 `TimeWheel`만 import하며 도착 시각과 개발 테스트 시각의 사용자 wheel scroll에만 연결된다.
- raw `Pressable` 잔여는 `src/ui/AnimatedPressable.tsx`의 `Pressable as NativePressable` 1곳뿐이다. 이는 모든 앱 소유 press를 감싸는 구현 primitive이므로 제외한다. WebView·지도 SDK 내부 native control과 Slider 연속 제스처는 React `Pressable` 이관 대상이 아니며 수정하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 우선: `npx tsx --test test/ui/global-interaction-motion.test.ts` → 구현 전 `0/3` 통과, 의도한 세 계약 실패 확인. 구현 후 `7/7` 통과.
- 고속 wheel fixture: 사용자 active row `0→1→2→3`에서 selection haptic `3회`, 같은 index 반복·최종 중복 callback `0회 추가`, drag end commit `0회`, momentum end 최종 index `3` commit `1회`.
- 저속 wheel fixture: row 변경 haptic `1회`, drag end commit `1회`; mount/외부 prop/programmatic sync `0회`, 접근성 증감 haptic `0회`, 범위 끝·빈 배열은 commit `0회`로 안전 종료했다.
- 공용 press fixture: 일반/아이콘 press-in과 release, disabled, Reduce Motion을 검증했고 일반 버튼 haptic `0회`다.
- `npm run test:typecheck` → 통과.
- `npm run test:ui` → 총 `250`, 통과 `249`, 실패 `0`, 기존 skip `1`.
- `npm test` → 총 `117`, 통과 `117`, 실패 `0`, skip `0` (내부 TypeScript UI 발견 게이트도 통과).
- `git diff --check` → 통과.
- 실제 API·Metro·Simulator·실기기·Xcode는 실행하지 않았다.

### 4. 다음 결정·위험·재현 조건

- `expo-haptics`는 native module 추가이므로 기존 설치 앱의 JS 갱신만으로 검증하지 말고 **새 internal iOS build가 필요하다**. 이번 범위에서는 pod 동기화·Xcode build를 실행하지 않았다.
- 새 build의 실기기 smoke에서 빠른 wheel 관성과 row별 촉각 세기/중복 여부, native edge-swipe 방향, 위치/CAPTCHA modal의 진입·닫힘 방향, Reduce Motion, 작은 iPhone에서 Results 고정 CTA가 전환 카드 영역을 가리지 않는지 확인한다.
- 의존성 설치 시 npm이 기존 audit 위험 `24건(중간 17, 높음 7)`을 보고했다. 이번 UIUX 작업에서는 자동 `audit fix`나 범위 밖 의존성 변경을 하지 않았다.
- 사용자 요청 전 commit·push하지 않았다.

## 통합·결정 반려 및 수락 전 보완 명령 — 2026-09-04

### 반려 근거

Simulator의 홈·시간 설정·하단 탭에서 버튼 자체는 남아 있지만 배경·높이·정렬·flex가 사라지고 텍스트와 아이콘만 표시됐다. 이는 캐시나 native build 문제가 아니라 공용 press 경계의 런타임 style 전달 결함이다.

- 현재 `src/ui/AnimatedPressable.tsx`는 원래 style을 `resolveStyle(state)` 함수로 감싼 뒤 `Animated.createAnimatedComponent(Pressable)`에 `style={resolveStyle}`로 전달한다.
- 설치된 React Native의 `AnimatedProps`는 style 값이 객체 또는 배열일 때만 flatten하고 함수 style은 무시한다. 따라서 원래 style이 정적 객체여도 공용 컴포넌트가 항상 함수로 바꿔 전달하므로 `minHeight`, 배경, 테두리, flex, 정렬이 모두 유실된다.
- `as ComponentType<PressableProps>` 강제 단언이 실제 Animated style 계약 불일치를 typecheck에서 숨겼다.
- 기존 테스트는 공용 import 여부와 순수 scale 수치만 검사하고 최종 Animated surface에 style 객체/배열이 전달되는지 확인하지 않아 잘못 통과했다.

따라서 기존 완료 인수인계는 수락하지 않는다. 아래 보완을 **같은 `U-INTERACTION-01` 안에서 전부 수행**하며 새 작업 ID나 가지 작업을 만들지 않는다.

### 보완 범위

#### 1. 먼저 실패 fixture 추가

제품 코드를 고치기 전에 현재 구현에서 실패하는 회귀 fixture를 추가한다.

필수 입력과 기대 결과:

1. 정적 style 객체 `{ minHeight: 54, backgroundColor, alignItems }`가 최종 Animated surface style에 그대로 포함된다.
2. `StyleSheet.create()`가 반환한 numeric style ID도 유실하지 않는다.
3. `[baseStyle, selected && selectedStyle]` 배열의 순서와 falsy 항목 의미를 보존한다.
4. 함수형 style은 idle에서 `{ pressed: false }`, press-in에서 `{ pressed: true }`, press-out/cancel에서 다시 `{ pressed: false }`로 평가된다.
5. 기존 style 뒤에 motion style을 마지막으로 합성하되, 기존 layout/background/border를 제거하지 않는다.
6. disabled 또는 busy로 바뀌는 순간 pressed 상태와 animation progress가 idle로 복원된다.
7. 사용자 `onPressIn/onPressOut`, `testID`, `hitSlop`, accessibility state와 기존 중복 실행 lock을 보존한다.

소스 문자열 검사 하나만으로 통과시키지 않는다. style 합성 결정을 순수 함수로 분리해 정적 객체·numeric ID·배열·함수형 style의 반환값과 평가 상태를 직접 단언한다. 여기에 실제 컴포넌트 연결이 다시 `style={함수}`로 회귀하지 않았는지를 확인하는 좁은 source guard를 보조로 둘 수 있다.

#### 2. 공용 컴포넌트 한 곳 수정

27개 화면의 이관을 되돌리거나 각 화면 스타일을 복제하지 않는다. `src/ui/AnimatedPressable.tsx`의 전달 경계를 고친다.

- 공용 컴포넌트 내부에 실제 press 상태를 둔다.
- 원래 `style`이 함수면 내부 press 상태로 먼저 평가하고, 정적 객체·numeric ID·배열이면 그대로 보존한다.
- `AnimatedNativePressable`에 넘기는 최종 `style`은 **함수가 아니라 객체/배열**이어야 한다. 형태는 개념적으로 `[resolvedOriginalStyle, motionStyle]`이며 motion style은 transform/opacity만 포함한다.
- `Animated.createAnimatedComponent(Pressable)`의 public props를 `ComponentType<PressableProps>`로 가장하는 강제 단언을 제거하거나, 최소한 함수 style이 Animated 계층으로 넘어갈 수 없는 타입 경계를 명시적으로 만든다.
- 기존 `onPressIn`에서는 내부 pressed를 true로 만든 뒤 press-in animation과 사용자 callback을 실행하고, `onPressOut`/취소에서는 false로 복원한 뒤 release animation과 사용자 callback을 실행한다.
- disabled/busy 상태가 조작 도중 true가 되면 pressed와 progress를 즉시 idle로 복원한다. disabled 상태에서는 사용자 행동과 animation을 시작하지 않는다.
- Reduce Motion, standard/icon 수치, 일반 버튼 haptic 0 계약은 그대로 유지한다.
- `expo-haptics`, TimeWheel, native stack, Results in-place transition과 추천/API 코드는 이번 보완에서 다시 설계하거나 변경하지 않는다. 이들은 style 복구 뒤 기존 회귀만 재실행한다.

#### 3. 대표 화면 회귀

다음 대표 요소를 자동 fixture에 연결해 동일 원인의 재발을 막는다.

- `HomeScreen`의 `s.primary`: `minHeight: 54`, accent 배경, 중앙 정렬 유지
- `TimeSetupScreen`의 `s.primary`와 `s.row`: CTA 배경/높이와 행 layout 유지
- `FloatingTabBar`의 `s.item`: 각 항목 `flex: 1`, 최소 높이, 중앙 정렬 유지
- 함수형 style을 사용하는 `TwoStopSelectionPanel` 카드: selected style과 pressed style을 모두 보존

기존 화면 CSS 값을 테스트에 전부 복제하지 말고, 공용 style resolver가 위 스타일 참조를 제거하지 않으며 최종 Animated surface에 배열로 전달하는지를 검증한다.

#### 4. 최소 Simulator 시각 확인

이 결함은 자동 테스트가 놓친 런타임 표시 문제이므로 이번 보완에 한해 실제 API를 사용하지 않는 최소 Simulator 확인을 허용한다.

1. Metro reload 후 홈을 열어 파란 `자투리 시간 설정하기` CTA의 배경·높이·중앙 정렬을 확인한다.
2. 시간 설정으로 이동해 `경로 설정하기`, `도착 시각`, 개발 행, `이 시간에 할 일 찾기`의 배치와 배경을 확인한다.
3. 홈의 하단 탭 네 항목이 같은 폭으로 분배되고 아이콘 위·레이블 아래 정렬인지 확인한다.
4. CTA를 누르고 떼었을 때 layout은 움직이지 않고 scale/opacity만 복귀하는지 확인한다.

GPS·CAPTCHA·추천 실행·실제 API는 호출하지 않는다. 전체 시나리오를 버튼별로 반복하지 않고 위 두 화면만 확인한다. 캡처 경로 또는 관찰 결과를 완료 인수인계에 남긴다. JS 경계 수정이므로 layout 확인만을 위해 앱 삭제나 Xcode 재빌드를 요구하지 않는다. 단, wheel haptic 실기기 확인은 원래 계획대로 새 internal build 이후 별도 smoke에 남긴다.

### 필수 재검증

```bash
node --import tsx --test test/ui/global-interaction-motion.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

추가로 `QA-TWO-STOP-02`의 관련 집중 fixture를 재실행해 함수형 selected card style 보완이 A/B 선택·역선택 0-call·B 추가시간을 바꾸지 않았음을 확인한다. 기존 테스트를 삭제·완화하거나 타입 단언으로 실패를 숨기지 않는다.

### 보완 완료 기준

아래를 모두 충족해야 다시 수락 요청할 수 있다.

1. `AnimatedNativePressable`에 전달되는 style이 런타임에서 함수가 아님을 테스트로 증명한다.
2. 정적 객체·numeric ID·배열·함수형 style을 모두 보존한다.
3. 홈 CTA, 시간 설정, 하단 탭 Simulator 표시가 기존 레이아웃으로 복구된다.
4. 눌림 animation, Reduce Motion, 일반 버튼 haptic 0을 유지한다. 당시의 시간 wheel 전용 haptic 범위는 문서 마지막 2차 보완에서 wheel+도착 여유 slider로 교체한다.
5. 전체 typecheck/UI/core/diff check와 2곳 집중 회귀가 통과한다.
6. 수정 범위를 공용 press 경계와 그 테스트로 제한하고 27개 화면에 임시 스타일을 덧붙이지 않는다.

완료 기록에는 최초 실패 테스트, 수정 전후 최종 style 값의 종류(`function → array/object`), 대표 세 화면 관찰 결과, 전체 테스트 수치, 변경하지 않은 엔진/API/data/DB 경계를 남긴다. 사용자 요청 전 commit·push하지 않는다.

## 수락 전 보완 완료 인수인계 — 2026-09-04

상태: **보완 완료 · 통합/결정 재수락 대기**. 위의 기존 완료 인수인계는 Simulator에서 style 유실이 확인되어 반려된 기록이며, 이번 기록이 수락 전 보완의 현행 결과다.

### 1. 변경 파일과 변경 목적

- `test/ui/global-interaction-motion.test.ts`: 제품 코드 수정 전에 좁은 source guard를 추가했다. 최초 실행은 총 `8`개 중 `7` 통과, `1` 실패였고, `AnimatedNativePressable`에 `style={resolveStyle}` 함수가 그대로 전달되는 결함을 재현했다. 이후 순수 resolver fixture로 정적 객체, numeric `StyleSheet` 참조, falsy를 포함한 배열, 함수형 style의 `false → true → false` 평가, 기존 style 뒤 motion 합성, disabled/busy idle 복원과 사용자 callback/공개 props 보존을 검증했다. Home/TimeSetup/FloatingTabBar/TwoStop 대표 style 참조도 회귀 입력에 연결했다.
- `src/ui/pressInteractionModel.ts`: 원래 style을 Animated 계층 전에 평가하는 순수 `resolveAnimatedPressableStyle` 경계를 추가했다. 정적 객체·numeric ID·배열은 동일 참조와 순서를 보존하고 함수형 style만 내부 `{ pressed }` 상태로 평가한 뒤 `[resolvedOriginalStyle, motionStyle]`을 반환한다.
- `src/ui/AnimatedPressable.tsx`: 공용 컴포넌트가 내부 pressed 상태를 소유하도록 수정했다. 수정 전 최종 Animated surface style 종류는 항상 `function`이었고, 수정 후에는 원 style 종류와 관계없이 최종값이 `array/object`다. `motionStyle`은 마지막 항목이며 opacity/transform만 포함한다. `as ComponentType<PressableProps>` 강제 단언을 제거했고, disabled/busy 전환 시 pressed와 animation progress를 즉시 idle로 되돌린다. 사용자 `onPressIn/onPressOut`, `testID`, `hitSlop`, accessibility state와 기존 disabled/busy lock 전달은 유지했다.
- 27개 화면의 기존 공용 press 이관은 되돌리지 않았고 화면별 임시 style도 추가하지 않았다. 이번 보완에서 제품 코드는 위 공용 경계 두 파일만 수정했다.

교체 이력: `style callback을 Animated surface에 직접 전달` → `RN Animated가 함수 style을 flatten하지 않아 배경·높이·정렬·flex 유실` → `공용 경계가 원 style을 먼저 평가하고 객체/배열로 합성` → `모든 이관 화면을 한 경계에서 복구하고 같은 결함의 재발을 막기 위함` → **현행, 통합/결정 재수락 대기**.

### 2. 변경하지 않은 공개 계약·정책 경계

- 일반 CTA·카드·칩·탭의 haptic은 계속 `0회`다. 공용 press 경계는 `expo-haptics`를 import하지 않으며 selection haptic은 도착 시각/개발 테스트 시각의 `TimeWheel` 사용자 행 변경에만 남겼다.
- native stack 전환, CAPTCHA/위치 sheet 방향, Results in-place 전환, Reduce Motion과 standard/icon motion 수치는 다시 설계하거나 변경하지 않았다.
- 추천 엔진, 외부 API/Route Proxy, 장소 원본/data, Supabase/DB를 수정하지 않았다. 작업 시작 전부터 존재한 범위 밖 변경도 되돌리거나 편집하지 않았다.
- A/B 선택, 동일 session 역선택 0-call, initial 3·누적 6, shared 12와 16/12/36 호출 예산, B 추가시간, snapshot/scroll 복원 계약을 유지했다.
- raw `Pressable` 잔여는 공용 구현 primitive인 `src/ui/AnimatedPressable.tsx`의 `Pressable as NativePressable`뿐이다. 화면 단위 raw press를 되돌려 해결하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 우선: `node --import tsx --test test/ui/global-interaction-motion.test.ts` → 수정 전 `7/8` 통과, 의도한 최종 함수 style guard `1`건 실패. 수정 후 `12/12` 통과.
- style fixture 결과: 정적 객체·numeric ID·배열의 동일 값/참조와 falsy 항목 순서 보존, 함수형 style 평가 상태 `false → true → false`, motion 마지막 합성, 최종 Animated surface 함수 전달 `0건`을 확인했다.
- `node --import tsx --test test/ui/two-stop-production-session.test.ts test/ui/two-stop-selection.test.ts` → `37/37` 통과.
- `node --import tsx --test test/release-two-stop-selection.test.ts test/ui/release-one-stop-more-results.test.ts` → `43/43` 통과.
- `node --import tsx --test test/qa-two-stop-integration.test.ts` → QA-TWO-STOP 영수증 포함 `17/17` 통과. 역선택/session reuse·B 추가시간·호출 예산 회귀 변화 없음.
- `npm run test:typecheck` → 통과.
- `npm run test:ui` → 총 `255`, 통과 `254`, 실패 `0`, 기존 skip `1`.
- `npm test` → 총 `117`, 통과 `117`, 실패 `0`, skip `0`.
- `git diff --check` → 통과(문서 기록 후 최종 재실행).

실제 API를 호출하지 않는 최소 Simulator smoke도 완료했다. 기존 설치 앱과 현재 프로젝트 Metro reload를 사용했으며 앱 삭제·제품 Xcode 재빌드는 하지 않았다. 임시 XCUITest runner만 빌드했고 최종 실행은 `1/1` 통과, 실패 `0`, `9.182초`였다.

- 홈 CTA: frame `(22.0, 288.67, 358.0, 54.0)`, 파란 배경·높이·텍스트 중앙 정렬을 확인했다. press 후 drag-cancel/release 전후 frame이 같아 layout 이동 없이 시각 눌림만 복귀했다. 캡처: `/private/tmp/u-interaction-01-home.png`.
- 시간 설정: 경로 행 `(22.0, 188.0, 358.0, 70.0)`, 개발 행 `(22.0, 336.0, 358.0, 44.0)`, 하단 CTA `(22.0, 603.0, 358.0, 52.0)`로 배경·높이·행 정렬을 확인했다. 캡처: `/private/tmp/u-interaction-01-time-setup.png`.
- 하단 탭: 홈 캡처에서 네 항목이 같은 폭의 4열로 분배되고 각 열의 아이콘 위·레이블 아래 중앙 정렬을 확인했다.
- 최종 XCUITest 결과 bundle: `/private/tmp/UInteraction01Smoke3.xcresult`. GPS·CAPTCHA·추천 실행·실제 API 경로는 진입하지 않았다. 앞선 두 번의 임시 harness 실행은 제품 실패가 아니라 탭 accessibility selector 가정 실패였고, selector를 시각 캡처/화면 계층 관찰로 한정한 최종 smoke가 통과했다.

### 4. 다음 결정·위험·재현 조건

- 통합/결정 역할은 이번 `function → array/object` 경계와 Simulator 캡처를 기준으로 재수락 여부를 판단해야 한다. 기존 반려 인수인계를 현행 완료 근거로 사용하면 안 된다.
- 이번 JS style 복구 자체는 Xcode 재빌드가 필요 없다. 다만 앞 작업에서 추가된 `expo-haptics`의 실제 촉각 세기와 빠른 wheel 관성은 새 internal iOS build 이후 실기기 smoke가 여전히 필요하다.
- Simulator의 탭 항목은 접근성 tree에서 개별 button으로 노출되지 않아 이번 smoke는 4열 균등 배치를 캡처로 확인했다. 향후 자동 좌표 단언이 필요하면 화면 문구나 디자인을 바꾸지 않고 탭 item testID/accessibility 노출을 별도 결정해야 한다.
- 사용자 요청 전 commit·push하지 않았다.

## 통합·결정 2차 반려 및 수락 전 보완 명령 — 2026-09-04

### 1. 반려 근거와 요구사항 관계

사용자 확인에서 도착/개발 테스트 시각 wheel과 `도착 전 남길 시간` slider의 촉각 피드백이 모두 느껴지지 않았다. 이 관찰은 `UX-29/UXV-49`의 **보완**이며 일반 버튼까지 햅틱을 넓히는 요구가 아니다.

- `src/ui/TimeWheel.tsx`에는 `Haptics.selectionAsync()` 호출이 있지만 rejection을 전부 조용히 삼킨다. 기존 자동 테스트는 순수 controller의 `decision.haptic` 횟수만 세었으므로 실제 Expo adapter 연결이나 설치 앱의 native module 포함을 증명하지 못했다.
- iOS Simulator에는 물리적인 Taptic Engine이 없다. Simulator에서 촉각이 없다는 관찰만으로 wheel 로직 실패를 확정할 수 없고, Simulator 테스트 통과도 실제 촉각 성공 근거가 아니다.
- `src/ui/TimeSetupScreen.tsx`의 slider는 현재 `onValueChange`에서 상태만 바꾸며 haptic 호출이 없다. 이 부분은 명백한 미구현이다.
- 저장소 재감사에서 `package.json/package-lock.json`과 `node_modules/expo-haptics/ios/ExpoHaptics.podspec`은 확인됐지만 `ios/Podfile.lock`과 현재 Pods manifest에는 `ExpoHaptics`가 없다. 즉 JS 의존성 설치만 기록되고 현재 iOS native build에는 module이 연결되지 않았을 가능성이 높다.
- `expo-haptics` 설치 전 internal build나 pod가 반영되지 않은 설치 앱은 Metro reload만으로 native module을 추가할 수 없다. 보완 완료에는 pod 동기화와 새 iOS internal build의 실기기 확인이 필요하다.

기존 `시간 wheel만 햅틱` 규칙은 `시간 wheel + 도착 여유 slider의 불연속 5분 값만 햅틱`으로 교체한다. CTA·카드·칩·뒤로가기·더보기·tray 삭제와 공용 `AnimatedPressable`의 햅틱 0회는 유지한다.

### 2. 코드 변경 전 실패 fixture

source 문자열 검사만으로 통과시키지 말고 순수 controller와 주입 가능한 adapter로 먼저 실패를 재현한다.

1. wheel 사용자 drag가 새 행 `0→1→2`를 통과하면 adapter 호출은 2회다.
2. wheel mount, prop sync, programmatic `scrollTo`, 같은 행 반복, momentum final snap은 0회다.
3. slider `onSlidingStart` 뒤 `5→10→10→15`가 보고되면 haptic은 10과 15 진입의 2회다.
4. slider mount/외부 값 변경, drag 시작 전 event, 같은 값 반복, `onSlidingComplete` 재보고는 0회다.
5. slider event가 `5→20`으로 건너뛰면 누락 step을 합성하지 않고 20에 한 번만 호출한다.
6. adapter reject/native unavailable이어도 값·momentum·추천 실행은 계속되고 일반 pressable/다른 slider/지도 gesture는 0회다.

### 3. 공용 selection haptic 경계

- `expo-haptics` import와 실패 처리를 작은 UIUX 소유 adapter 하나로 모은다. wheel과 도착 여유 slider만 주입받고 공용 pressable은 import하지 않는다.
- 제품은 `selectionAsync()`를 fire-and-forget으로 호출하고 테스트는 성공·reject·unavailable과 횟수를 주입한다.
- `__DEV__`에서는 동일 실패 원인의 최초 1회만 진단 가능하게 한다. 위치·사용자 데이터는 로그에 넣지 않고 프로덕션 UX는 조용히 계속한다.
- haptic Promise를 기다리거나 queue로 직렬화하여 스크롤·slider를 늦추지 않는다.

### 4. 시간 wheel 보완

- 현재 사용자 행 변경·momentum 최종 commit 계약은 유지한다. 촉각이 없다는 이유로 drag end/final snap마다 강제 진동하지 않는다.
- `decision.haptic === true`가 실제 공용 adapter 호출로 이어지는 integration fixture를 추가한다. 순수 decision 수치만으로 완료 처리하지 않는다.
- 사용자 drag 중 새 active index만 촉각을 낸다. VoiceOver adjustable, prop sync와 programmatic scroll은 값을 바꾸되 촉각을 합성하지 않는다.

### 5. 도착 여유 slider 보완

- 기존 5·10·15·20·25·30분 범위와 추천 입력 계약은 바꾸지 않는다.
- slider controller/ref가 `dragging`과 마지막 촉각 값을 소유한다. `onSlidingStart`에서 현재 값을 기록하고 `onValueChange`에서 정규화한 새 5분 값일 때만 상태 변경과 haptic 1회를 수행한다. `onSlidingComplete`는 확정·종료만 하고 반복 진동하지 않는다.
- 빠른 drag가 여러 step을 건너뛰어도 중간 step 수만큼 진동을 몰아서 내지 않는다. 실제 보고된 새 값마다 최대 1회다.
- haptic 실패로 `arrivalBufferMin`을 되돌리지 않는다. 접근성 label/value와 5분 단위를 명시하며 VoiceOver 조절에는 별도 연속 햅틱을 합성하지 않는다.

### 6. 빌드와 수락 검증

`npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 모두 실행한다. 그 뒤 `npx pod-install` 또는 프로젝트의 동일한 iOS pod 동기화 절차를 실행하고 `ios/Podfile.lock`에 `ExpoHaptics`가 실제 반영됐는지 확인한다. Metro reload가 아니라 이 pod가 포함된 새 internal iOS build를 실기기에 설치한다. pod install이나 build 실패를 JS fallback으로 숨기고 완료 처리하지 않는다.

- wheel: 천천히 한 칸, 빠르게 여러 칸 이동 시 새 행마다 촉각을 확인한다.
- slider: 5→10→15분과 15→10분에서 새 5분 값마다 촉각을 확인한다.
- 일반 CTA·뒤로가기·카드는 진동이 없어야 한다.

Simulator는 값·호출 횟수·momentum만 확인한다. Simulator 무진동은 실패가 아니며 JS adapter 호출도 실기기 촉각 합격을 대신하지 않는다.

### 7. 완료 인수인계

기존 완료 기록만 인용하지 말고 변경 파일과 목적, adapter 성공/reject/unavailable, wheel/slider 정확한 호출 횟수, 전체 테스트 수치, 새 internal build 식별 정보와 실기기 결과, 변경하지 않은 추천/API/data/DB/navigation 계약을 새로 기록한다.

사용자 요청 전 commit·push하지 않는다. 새 가지 작업 ID를 만들지 말고 이 `U-INTERACTION-01` 안에서 닫는다.

## 2차 수락 전 보완 진행 기록 — 2026-09-04 (실기기 연결 대기)

상태: **코드·Pod·새 internal device build·자동 검증 완료, 실제 iPhone 촉각 확인 미완료**. 등록된 실제 iPhone 두 대가 모두 Xcode에서 `Offline`이므로 아직 수락 완료로 기록하지 않는다. 아래 기록은 기존 완료 인수인계의 인용이 아니라 2차 명령을 처음부터 다시 수행한 현재 결과다.

### 1. 변경 파일과 변경 목적

- `src/ui/selectionHaptic.ts`: native driver와 UI decision 사이의 공용 fire-and-forget 경계를 추가했다. 성공은 즉시 반환하고, generic reject는 `request_rejected`, Expo native module 부재는 `native_unavailable`의 비밀 없는 enum으로만 분류한다. `__DEV__` 진단은 같은 requester·같은 원인별 최초 1회이며 원 오류 문자열을 출력하지 않는다.
- `src/ui/expoSelectionHaptic.ts`: `expo-haptics` import를 이 한 파일로 모으고 `selectionAsync()`를 공용 requester에 연결했다. Promise를 await하거나 queue로 직렬화하지 않는다.
- `src/ui/TimeWheel.tsx`: 기존 controller의 `decision.haptic`이 실제 공용 selection requester 호출로 이어지게 연결했다. 사용자 drag 중 새 행에만 호출하며 mount, prop sync, programmatic scroll, 같은 행, momentum final commit, VoiceOver adjust의 0회 계약은 유지했다.
- `src/ui/arrivalBufferInteraction.ts`: 5~30분·5분 step을 보존하는 slider 수명 단위 controller를 추가했다. drag 시작 값을 기억하고 실제 보고된 새 5분 값마다 최대 1회만 haptic을 결정하며 건너뛴 중간 step은 합성하지 않는다.
- `src/ui/TimeSetupScreen.tsx`: `도착 전 남길 시간` slider를 controller와 공용 requester에 연결하고 `onSlidingStart/onValueChange/onSlidingComplete`, 접근성 label/value의 5분 단위를 명시했다. haptic 실패와 무관하게 `arrivalBufferMin` 값과 추천 입력은 계속 갱신된다.
- `test/ui/global-interaction-motion.test.ts`: 코드 변경 전 새 controller/adapter가 없어 `ERR_MODULE_NOT_FOUND`로 실패하는 fixture를 먼저 확인했다. 이후 wheel `0→1→2`, slider `5→10→10→15`, `5→20`, adapter 성공/reject/unavailable, 단일 Expo import 및 wheel/slider 전용 consumer를 행동·source fixture로 고정했다.
- 로컬 ignored native 산출물 `ios/Podfile.lock`, `ios/Pods/Manifest.lock`: `pod install`로 `ExpoHaptics 56.0.3`을 반영했다. 저장소의 `/ios` ignore 정책은 바꾸지 않았다.

교체 이력: `TimeWheel이 Expo를 직접 호출하고 slider는 haptic 없음` → `순수 decision 수치만 통과하고 실제 native 연결·slider 촉각을 보장하지 못함` → `단일 Expo adapter + wheel/slider 전용 controller·requester` → `일반 버튼으로 범위를 넓히지 않으면서 실제 사용자 불연속 선택만 촉각으로 전달하기 위함` → **현행 구현, 실기기 수락 대기**.

### 2. 변경하지 않은 공개 계약·정책 경계

- 일반 CTA·카드·칩·뒤로가기·더보기·tray 삭제·공용 `AnimatedPressable`, 다른 slider와 지도 gesture의 haptic은 `0회`다. `requestExpoSelectionHaptic` consumer는 `TimeWheel.tsx`와 도착 여유 slider가 있는 `TimeSetupScreen.tsx` 두 곳뿐이다.
- 도착/개발 테스트 시각 wheel의 momentum 종료 1회 commit, VoiceOver adjustable, Reduce Motion, native stack과 sheet/Results 전환은 변경하지 않았다.
- slider 범위 `5·10·15·20·25·30분`, `arrivalBufferMin` 추천 session 입력과 검증 규칙을 변경하지 않았다.
- 추천 엔진, 외부 API/Route Proxy, 장소 data, Supabase/DB, navigation을 수정하지 않았다. A/B 동일 session 역선택 0-call, initial 3·누적 6, 16/12/36 예산, B 추가시간과 snapshot 계약도 그대로다.

### 3. 실행한 테스트·Pod·build 결과

- 실패 우선: `node --import tsx --test test/ui/global-interaction-motion.test.ts` → 구현 전 신규 순수 module 부재로 `1/1` 실패(`ERR_MODULE_NOT_FOUND`), 현재 slider/공용 adapter 미구현을 확인했다.
- 구현 후 전용 fixture `16/16` 통과. wheel `0→1→2` adapter `2회`, mount/sync/동일 행/momentum final/VoiceOver `0회`; slider `5→10→10→15`은 `2회`, complete 재보고 `0회`, `5→20` 건너뛰기는 `1회`다. 성공 driver `1회`, 반복 generic reject 진단 `1회`, 반복 native unavailable 진단 `1회`이며 값·commit은 차단하지 않는다.
- `npm run test:typecheck` → 통과.
- 2곳 선택 집중 fixture → 총 `97/97` 통과.
- `npm run test:ui` → 총 `259`, 통과 `258`, 실패 `0`, 기존 skip `1`.
- `npm test` → 총 `117`, 통과 `117`, 실패 `0`, skip `0`.
- `git diff --check` → 통과.
- `npx pod-install`은 sandbox DNS의 `ENOTFOUND registry.npmjs.org`로 실패했다. 동일 native 동기화 절차인 로컬 `pod install`은 성공했고 `ios/Podfile.lock`과 `ios/Pods/Manifest.lock` 양쪽에서 `ExpoHaptics (56.0.3)` 및 checksum `89364cf3c3ca2cfd54cafed42f3be3169bab6d42`를 확인했다.
- 새 device build: `xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Debug -destination generic/platform=iOS ... build` → `BUILD SUCCEEDED`. dependency graph·link·Swift module path에서 `ExpoHaptics` 포함을 확인했다. 산출물 `/private/tmp/timefit-u-interaction-device-build/Build/Products/Debug-iphoneos/mobile.app`, bundle `com.dongheun.mobile`, version/build `1.0.0 (1)`, arm64 UUID `7A2DBFA4-D759-38B1-9A8D-3CDDE144F565`, Team ID `642X5R37S7`, 최소 iOS `16.4`다.

### 4. 다음 결정·위험·재현 조건

- 실제 iPhone 두 대가 2026-09-04 build 직후와 재확인 모두 `Offline`이라 새 앱 설치 및 물리 촉각 판정을 수행하지 못했다. 기기를 Mac에 USB 또는 신뢰된 wireless debugging으로 연결하고 잠금 해제한 뒤 같은 signed `.app`을 설치해야 한다.
- 연결 후 남은 동일 작업 smoke: wheel을 천천히 한 칸·빠르게 여러 칸 이동해 새 행마다 촉각, slider `5→10→15`와 `15→10`의 새 5분 값마다 촉각, 일반 CTA·뒤로가기·카드의 진동 `0회`를 사용자가 직접 확인한다. Simulator나 adapter 호출 로그로 이 물리 판정을 대체하지 않는다.
- 이 실기기 결과 전에는 `U-INTERACTION-01`을 완료/수락으로 승격하지 않는다. 사용자 요청 전 commit·push하지 않았다.

## 통합·결정 최종 수락 — 2026-09-04

- 사용자가 새 internal iOS build의 실기기에서 시간 wheel과 도착 여유 slider의 햅틱 동작을 확인하고 `U-INTERACTION-01` 완료를 보고했다.
- 앞선 자동 검증은 wheel 새 행, slider 새 5분 값, 중복/programmatic 0회와 일반 버튼 햅틱 0회 계약을 통과했고, 실제 기기 확인으로 Simulator가 대신할 수 없던 물리 촉각 게이트도 닫혔다.
- 공용 press style 복구, native stack 전환, Results in-place 전환과 추천/API/data/DB/2곳 예산 불변 조건을 함께 수락한다.
- 후속 UI/네이티브 작업은 이 공용 interaction 경계를 재구현하지 말고 소비해야 한다.

상태: **최종 수락**.
