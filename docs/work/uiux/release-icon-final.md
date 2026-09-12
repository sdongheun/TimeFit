# U-RELEASE-ICON-01 — 승인 아이콘 적용 인수인계

2026-09-09. 로컬 적용·자동 검증 완료. 실기기 홈/Store 표시 미확인.

## 1. 변경 파일 / 목적·이력

이전 `assets/icon.png` 참조 → 승인된 파란 시계 시안이 앱에 연결되지 않음 → 원본을 보존한 별도1024 PNG로 변환 후 Expo icon 연결 → 승인 디자인을 최종 빌드 입력에 반영 → 현행.

- 입력 `output/imagegen/jjaturi-icon-blue-v1.png`: 직접 시각 확인,1254×1254 PNG/RGB/alpha 없음/프로필 없음. SHA256 `5ad1ed70dde7c6016c8ec88d90e2a350912019c43a127cd0fb4d977fdf73417e`, 변환 후 원본 hash 동일.
- 신규 `assets/jjaturi-icon-blue.png`:1024×1024 PNG/RGB/불투명, sRGB IEC61966-2.1. SHA256 `edab386a6107dc37d9ddca6eed5cbba919ba9bcede6591016e94d1d7215a4593`. 기존 파일 부재 확인 후 생성. 원본 JPEG·시안·기존 icon.png 보존.
- `app.json`: expo.icon만 `./assets/jjaturi-icon-blue.png`로 변경. 별도 ios.icon override 없음.
- 비clean public prebuild 생성 `ios/mobile/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`:1024 정사각/불투명, Contents.json의 universal iOS1024 소비 경로. SHA256 `4afe82d0ee52e4c45784fb0aab7803bb9fc7a08e72a3d92d03da8bd79679b4a0`. Expo가 프로필 메타데이터를 제거하여 파일 hash는 다르지만 sharp RGB decode 비교에서 입력과 픽셀100% 동일(최대/평균 채널차0). 생성 asset에 프로필이 있다고 허위 기록하지 않는다.
- `test/ui/release-icon.test.mjs`: 경로/PNG/크기/불투명/sRGB 및 identity 보존, 잘못된 크기·alpha·포맷·프로필 fixture.

재현 변환(신규 출력이 없는 경우에만 실행):

```sh
sips -z 1024 1024 -s format png --embedProfile '/System/Library/ColorSync/Profiles/sRGB Profile.icc' output/imagegen/jjaturi-icon-blue-v1.png --out assets/jjaturi-icon-blue.png
```

시안에 ICC가 없으므로 sRGB로 명시 정규화했다. 승인된 전체 사각 이미지 비율 유지, 크롭·둥근 모서리 마스크·그림자·텍스트·재디자인·새 이미지 생성0. 변환 결과도 직접 시각 확인했다.

## 2. 유지 계약

name/slug/scheme/Bundle ID/Team/App Group/version1.0.0/build1/iPhone/iOS17/권한/테마/LA 불변. App.tsx/nav/추천/DB/원본 데이터·기존 asset 정리0. AGE-01 완료 유지. app.json의 기존 다른 변경은 보존했다.

public wrapper의 production/internal 비노출/proxy 환경을 그대로 사용했다. package.json prebuild 결과 no changes. 생성 project SHA256 `012b8e60585e1b6521dadbcd92a45f7d8e12559b7da2c38a09b6f0ab07859113`은 NATIVE-02와 동일. Expo/RN 권장 버전 경고로 의존성을 올리지 않았다.

## 3. 실행 검증

- 변경 전 테스트: 기존 icon 경로에서 기대 신규 경로와 불일치하여 실패(`/private/tmp/timefit-icon-red.log`). 잘못된1254/직사각/alpha/JPEG/P3 fixture를 별도 거절. 변경 후 집중2/2 PASS.
- `npm run test:typecheck` PASS(`/private/tmp/timefit-icon-type.log`).
- `npm run test:ui`:713건 중712 PASS·기존1 skip·실패0(`/private/tmp/timefit-icon-ui.log`).
- `npm test`:401/401 PASS(`/private/tmp/timefit-icon-core.log`).
- `node scripts/release-build.cjs prebuild`: 비clean1회 PASS(`/private/tmp/timefit-icon-prebuild.log`), 생성 아이콘 실제 규격/픽셀 동일성 확인.
- `node scripts/release-build.cjs export`: iOS PASS(`/private/tmp/timefit-icon-export.log`). audit 37파일, 알려진 서버 전용 값0·개인키 패턴0·기존 공개 alias2 별도 분류, Supabase/CAPTCHA 입력 포함(원문 비출력). bundle SHA256 `aadf0a6802364eaf79fc405f3e780588cc3603bc111e5505720f910fdb654605`.
- diff check PASS. 새 Archive/Distribution 자격 생성/Simulator/실기기 설치/API·DB 쓰기/업로드/commit/push0.

## 4. 다음 결정 / QA 인계

아이콘은 위 최종 asset을 다음 공개 후보 빌드 입력으로 사용한다. JS export만으로 설치된 홈 아이콘이 교체되지 않는다. 다음 승인된 native 후보 설치 시 홈 화면과 설정/Store 표시를 확인하며, 실제 Store 검증 완료로 올리지 않는다. 이전 Development Archive에는 새 아이콘이 없으므로 최종 후보로 혼동하지 않는다. 공개 문서/registry 연결·서명·최종 후보 QA·업로드 승인 경계는 별도 유지한다.
