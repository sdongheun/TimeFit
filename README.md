# TimeFit — 짬-시간 AI 플래너

> **"붕 뜬 시간(예: 2시간)에, 이동·체류·혼잡·운영시간까지 따져 *진짜 가능한* 미니 코스를 짜주는 앱."**
> 2026 관광데이터 활용 공모전(KTO+카카오) 웹·앱 부문 · **부산 전용** · React Native · 1인 · 마감 **2026-09-21**
> 플로우(v2): 입력 → 추천 → 수락 → 실행(경로+로컬알림) → 완료 피드백. 개인화는 피드백에서만. (`docs/03_product/MVP시나리오.md`)

---

## 📁 폴더 구조

> 구조: Expo 앱 + 데이터 파이프라인(scripts)·문서(docs)가 **한 프로젝트 루트**에 통합.

```
TimeFit/                            ← Expo 앱 = 프로젝트 루트 (단일 프로젝트)
├── App.tsx                         입력·결과 화면 + 테스트 시각
├── src/
│   ├── engine/                     ⭐ 순수 TS 시간-적합 엔진 (planTimeFit)
│   └── data/*.json                 앱 번들 파라미터(체류·혼잡·POI)
├── app.json · package.json · tsconfig.json   Expo 설정
├── README.md                       ← 전체 인덱스(지금 이 문서)
├── docs/
│   ├── 01_concept/                 앱 컨셉·여정
│   │   ├── 앱컨셉.md                  무엇을 만드나(기능·로직·차별점)
│   │   └── 프로젝트여정.md            왜 이 방향인가(공모전·AR포기·전환)
│   ├── 02_data/                    데이터 전략(핵심)
│   │   ├── 데이터아키텍처.md          ⭐ 시간-적합 엔진 + 최종 데이터소스 결정
│   │   ├── AI허브_데이터셋_전수카탈로그.md ⭐ 데이터 14테이블 전수·수식검증 실현성(Phase A)
│   │   ├── AI허브_체류시간데이터.md   ⭐ 체류시간 추출·검증·라이선스·대안·매칭
│   │   └── TourAPI카탈로그.md         TourAPI 서비스·오퍼레이션 카탈로그
│   ├── 03_product/                 제품 시나리오·스택
│   │   ├── MVP시나리오.md             ⭐ 라이프사이클·필터·예시(v2)
│   │   └── 기술스택.md               ⭐ RN/지도/키/백엔드 결정
│   └── reports/                    HTML 시각화(브라우저로 열기)
│       ├── AI허브_전수카탈로그.html      ⭐ 데이터셋 전수·검증 실현성
│       ├── AI허브_컬럼사전.html
│       ├── 데이터통합보고서.html
│       ├── 부산매칭보고서.html
│       └── TourAPI카탈로그.html
├── scripts/                        검증·분석·엔진 (Node, 키는 env 주입)
│   ├── verify_tourapi.mjs              TourAPI 필드 채움률 검증
│   ├── match_busan.mjs                 부산 TourAPI↔AI-Hub 매칭
│   ├── profile_aihub.mjs               ⭐ AI-Hub 14테이블 전수 프로파일(Phase A)
│   ├── probe_chain.mjs                 타임라인 재구성 실현성 프로브
│   ├── build_dwell.mjs                 ⭐ AI-Hub CSV → 체류/혼잡 JSON 집계(+검증)
│   └── engine_spike.mjs                ⭐ 결정적 시간-적합 엔진 스파이크
└── data/
    ├── processed/                  ⭐ 앱 번들용 산출 JSON
    ├── aihub_donbu/                AI-Hub 동부권 추출 CSV + busan_match.json
    └── raw/                        원본 다운로드(.part0)
```

---

## ⭐ 핵심: 시간-적합 계산

```
가능한 후보? = (이동 + 유효체류 + 복귀/경유 이동) + 운영시간게이트  ≤  남은시간 − 안전버퍼(10~15%)
```
TourAPI는 후보·운영시간만 줌 → **체류·이동·혼잡은 자체 데이터/휴리스틱으로** 채운다(차별점). 신뢰의 핵심은 **결정적 엔진**, LLM은 설명·큐레이션의 선택적 폴리시.

## ⭐ 최종 데이터 소스 결정

| 신호 | 메인 | 보완 | 호출 |
|---|---|---|---|
| POI 후보·운영시간 | **TourAPI** | — | 🔴 런타임 |
| 이동(보행/자차/대중교통) | **TMAP** | haversine 폴백 + AI-Hub 계수보정 | 🔴 런타임 + 🔵 빌드 |
| **체류시간** | **AI-Hub 여행로그** | 상가정보·데이터랩·입장객·앱로그 | 🔵 빌드 내장 |
| 혼잡도 | **AI-Hub 요일×시간대 배수** | (가능시)집중률 override | 🔵 빌드 + 🔴 선택 |
| 실시간 대기시간 | **제외**(무료 API 부재) | — | — |

체류시간 결론: 무료 per-POI 분단위 체류는 **AI-Hub가 유일·최선**(실데이터 검증). 단독 아닌 보완재 결합.

## ⭐ 기술 스택 (확정)

RN **Expo** · **iOS 우선** · 지도 **MVP Apple Maps → 추후 카카오(래퍼)** · 언어 TypeScript(엔진 Node↔RN 공용)
키 **MVP `.env`(TourAPI/TMAP) → Claude는 프록시** · 백엔드 **MVP 0 → Phase2 Supabase(Auth+DB+프록시)**

---

## ✅ 진행 상태 (2026-06-16)

| 항목 | 상태 |
|---|---|
| 컨셉 확정 (AR→AI 짬플래너) | ✅ |
| TourAPI 라이브 검증 (운영시간 90~100%, 체류시간 부재) | ✅ |
| 시간-적합 엔진 아키텍처 + 최종 데이터소스 결정 | ✅ |
| AI-Hub 체류시간 실데이터 검증 (동부권 32,930건, 채움률 91%) | ✅ |
| 부산 매칭 (TourAPI 후보의 58.6%에 직접 체류시간) | ✅ |
| 최신성·라이선스·대안·측정방식 검증 | ✅ |
| **체류/혼잡 집계** (`build_dwell.mjs`, 검증 11/11) | ✅ `data/processed/` |
| **MVP 시나리오·기술스택 확정** (인터뷰) | ✅ |
| **엔진 스파이크 + TMAP 라이브** (`engine_spike.mjs`, TMAP 54/54, 검증 5/5) | ✅ |
| **Expo RN 셋업 + 엔진 TS 이식 + 입력·결과 화면** (루트 통합, 타입체크·번들 통과) | ✅ |
| **화면 분리(입력→결과→상세) + Apple Maps 지도 + 점진 필터칩** | ✅ |
| **기획 재정리 v2** (부산 전용·라이프사이클·개인화=피드백) | ✅ 문서 |
| **AI-Hub 데이터셋 전수 확인** (Phase A, 14테이블·30분 양자화 발견) | ✅ |
| 시간-적합 수식 검증(Phase B) | ⏭️ **스킵**(근거 아래) |
| 약속 입력(시각+장소) + 경유 경로 + 실행 화면 + 로컬 알림 | ⬜ **다음** |

## 📱 앱 실행 (루트에서) — Expo SDK 55
```bash
npx expo start          # 개발 서버(Metro). Xcode dev build 또는 Expo Go에서 접속
npx expo run:ios --device <UDID>   # 실기기 dev build (또는 ios/mobile.xcworkspace를 Xcode로 열어 ▶)
```
- 엔진(`src/engine/`): 순수 TS, 스파이크 로직 이식. `planTimeFit(input)` → 코스 후보.
- 데이터: `src/data/*.json`(빌드 번들). 키: `.env`(EXPO_PUBLIC_ + 스크립트용 평문).
- ℹ️ 실기 테스트는 **Xcode dev build** 사용(Expo Go 버전종속 회피). `ios/`는 prebuild로 재생성(gitignore).

## 수식 검증(Phase B) 스킵 — 근거
- 공식 `Σ(이동+체류)+버퍼`는 **덧셈이라 틀릴 게 없음**. 검증 대상은 입력값뿐.
- **이동** = TMAP(라이브·권위) → 저해상도 AI-Hub로 검증하는 건 앞뒤 바뀜.
- **체류** = 이 데이터에서 뽑은 중앙값 → 같은 데이터로 되검증은 순환.
- **버퍼**(유일 미검증값) → 30분 양자화라 정밀 검증 불가. **앱 자체 로그가 쌓이면 그때 보정**이 정석.
- Phase A(전수 카탈로그)에서 "데이터가 무엇을 주고 못 주는지"를 실측 확인 → **"데이터가 공식을 지탱하는가"의 답은 이미 확보.**

## 다음 액션
1. **약속 입력(시각+장소)** + 엔진 `destination` 경유 경로 연결 + 실행 화면 + 로컬 알림
2. 수락→피드백 루프 · 완료 후 시간 남으면 재추천
3. (Phase2) Supabase 로그인 + Claude 코스 설명 · cat3 체류 세분화(정확도 개선)

## 산출 데이터
- `src/data/busan_poi_catalog.json` — 앱 번들용 부산 POI 단일 카탈로그
- `data/processed/부산_매칭장소.json` — TourAPI 부산 장소와 AI-Hub 부산 방문지가 직접 매칭된 작업용 산출물
- `data/processed/부산_미매칭_TourAPI장소.json` — 직접 매칭은 없지만 카테고리 체류시간으로 폴백하는 작업용 TourAPI 후보
- `data/processed/카테고리별_체류시간.json` — 카테고리별 체류시간 폴백(median/p25/p75)

## 기술 메모
- 스크립트: `TOURAPI_KEY=... node scripts/<name>.mjs` (키는 env로만, 하드코딩 금지)
- AI-Hub: CC-BY-SA-4.0 → **집계 파라미터만 앱 내장·원본 미탑재·출처표시**(상세: `docs/02_data/AI허브_체류시간데이터.md §8`)
- 측정성격: `RESIDENCE_TIME_MIN`은 여행자가 30분 단위로 기록한 추정 체류(타임스탬프 계산값 아님)
