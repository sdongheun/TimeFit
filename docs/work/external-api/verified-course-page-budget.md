# API-PAGE-01 — 검증 코스 페이지 호출·cache 계약

## 상태

수락. 2-Q의 continuation 공개 타입·페이지 예산 entry를 소비하는 receipt/cache 계약을 고정했다.

## 읽을 범위

`AGENTS.md` → `docs/README.md` → `docs/작업조정_보드.md` → `docs/03_product/추천로직.md` 1.5.1·1.10 → `docs/테스트.md` REC-25·26·28 → 2-Q 완료 인계 → 이 문서.

## 목표

Kakao Route Proxy의 single-provider/cache/privacy 경계를 유지하면서, 엔진의 첫 8→조건부 16회와 이어보기 페이지당 8회 계수를 receipt로 관찰 가능하게 한다. 서버는 사용자별 추천 세션이나 후보 큐를 저장하지 않는다.

## 구현 명령

1. 2-Q의 `continueLimitedRepresentativeCourseV1({ ...originalInput, continuation })`에서 나온 **route 구간 요청·opaque receipt key·receipt 결과만** 소비해 첫 stage와 이어보기의 새 provider attempt·cache hit·in-flight reuse·typed provider stop을 구별한 receipt를 반환한다. continuation·원래 추천 입력·후보 큐는 API 서버에 전달·저장하지 않는다. API adapter는 candidate ID/cursor/signature를 해석하거나 재수화하지 않는다. `page`는 UI paging이 아니라 엔진이 명시한 검증 행동 단위다.
2. route request는 cache miss인 공개 장소 구간·수단만 Kakao로 보낸다. 동일 구간/수단 cache hit와 같은 in-flight request 합치기는 새 provider attempt 0으로 기록한다. route cache key에는 정밀 GPS·사용자 ID·IP·CAPTCHA token을 넣지 않는다.
3. 엔진이 후보 소진/전역 한도/typed provider failure로 route를 요구하지 않으면 proxy도 호출하지 않는다. API 쪽에서 부족한 코스를 채우기 위해 후보를 만들거나 재시도하지 않는다.
4. 한도·timeout·응답 오류는 현재 typed failure와 일일 budget 계수를 유지한다. ODsay/TMAP·근사 fallback, secret/env/quota tier/CAPTCHA 변경, 실제 provider 반복 호출은 범위 밖이다.

## 필수 계약 테스트

- 첫 8회/조건부 16회/이어보기 페이지 8회에서 miss·hit·in-flight가 receipt에 정확히 분리되는 fixture.
- 동일 공개 구간 cache 재사용, rejected course 재요청 0, cursor exhausted/global limit/provider fail에서 adapter 호출 0 또는 즉시 typed stop.
- 페이지 반복 클릭이 같은 cursor를 이중 소비하지 않고, 서버에 사용자 session state가 남지 않는 fixture.
- Kakao-only endpoint·비밀 비노출·기존 route proxy 활성화 회귀를 고정 mock으로 확인한다.

## 수정 범위와 금지

API client/cache/adapter/proxy 계약 테스트와 이 문서만 수정한다. 엔진 후보 순위, UI, 카탈로그, Supabase schema, CAPTCHA/secret, 보드는 수정하지 않는다.

## 완료 인계

receipt 예시와 호출 계수, cache/privacy 불변 경계, 테스트 결과, UI가 표시 가능한 typed 종료 사유를 이 문서에 남긴다.

---

## 2026-08-31 완료 인계 — API-PAGE-01 페이지 receipt·cache 계약

### 변경 파일

- `test/route-proxy-page-budget.test.ts`: Route Proxy mobile adapter를 고정 invoker로 조립해 첫 stage 8 miss, 조건부 stage 8 miss(첫 결과 누적 16), 이어보기 페이지의 cache hit 8건, in-flight receipt, typed unavailable을 검증했다.
- `docs/work/external-api/verified-course-page-budget.md`: 완료 계약·계수·경계와 다음 UI 인계를 기록했다.

### 유지한 계약

- continuation·원래 추천 입력·후보 큐·cursor·candidate ID/signature는 API adapter가 해석·전달·저장하지 않는다. 엔진은 route 구간 요청과 opaque receipt key/결과만 사용한다.
- 공개 segment cache는 방향·mode·catalog version·공개 POI ID 경계를 유지하며, 정밀 GPS·사용자 ID·IP·CAPTCHA token을 cache key에 넣지 않는다. private 좌표는 request 수명 body에만 존재한다.
- adapter는 서버의 `server_cache_hit`/`in_flight_reuse` receipt를 attempt 0으로 소비할 뿐, 페이지마다 로컬 cache를 별도로 만들거나 typed unavailable을 성공으로 cache하지 않는다. ODsay/TMAP·근사 fallback, secret/CAPTCHA/quota 설정, Edge/Supabase schema·UI·엔진은 수정하지 않았다.

### 테스트 결과

- `test/route-proxy-page-budget.test.ts`:
  - 첫 8 miss = 새 provider attempt 8회, 조건부 다음 8 miss = 누적 16회, 이어보기 8 cache hit = 새 attempt 0회·Edge adapter invoke 8회.
  - 동시 동일 public segment의 Edge `in_flight_reuse` receipt는 첫 요청 attempt 1, 둘째 attempt 0/reused true로 구분했다.
  - `limited` typed unavailable은 cache하지 않아 두 요청 모두 unavailable이며 Edge invoke 2회임을 확인했다.
- `npx tsx --test test/route-proxy-page-budget.test.ts test/route-proxy-client-adapter.test.ts test/activated-route-proxy-adapter.test.ts test/course-v1-pagination.test.ts` — 25/25 통과.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — 140 통과, 기존 skip 1.
- `npm test` — 109/109 통과.
- `git diff --check` — 통과. 실제 Kakao/Supabase/Cloudflare 호출은 0회다.

### 다음 결정·위험

- UIUX `U-RESULTS-03`은 같은 클라이언트 메모리의 original input·route ports와 2-Q continuation을 다시 조립해, `more_available`에서만 다음 페이지를 요청해야 한다. continuation을 독립 API 요청이나 DB 상태로 보내면 안 된다.
- UI가 표시 가능한 종료는 engine의 `more_available`, `exhausted`, `provider_unavailable`, `continuation_unavailable`이다. 로컬 페이지 예산 소진은 `more_available`이며 provider 장애 문구로 바꾸면 안 된다.
- 실제 공개 segment cache hit/in-flight는 Edge receipt가 source of truth다. UI 반복 클릭 방지는 UIUX의 요청 직렬화 책임이고, API adapter는 중복 cursor를 재수화하거나 후보를 보충하지 않는다.

### 통합 수락 판단

- API adapter가 `cursor`·continuation·추천 세션을 받지 않는 것은 의도된 개인정보·무상태 경계다. 따라서 같은 cursor의 반복 클릭을 막기 위해 서버 상태를 만들지 않는다.
- 반복 클릭의 단일 실행은 다음 `U-RESULTS-03`에서 버튼의 in-flight 잠금과 동일 continuation의 한 번 소비로 검증한다. API-PAGE-01은 요청마다 receipt의 `newProviderAttemptCount`와 `reused`만 사실대로 전달하는 책임으로 수락한다.
