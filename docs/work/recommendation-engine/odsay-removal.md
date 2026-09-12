# 2-ODSAY-REMOVE-01 — 엔진 신규 ODsay 요청 제거

부모 명령: [RELEASE-PROVIDER-MIN-01 §4 A](../integration-decision/release-overseas-minimum-and-odsay-removal.md). 2026-09-09. 엔진 구현·집중 검증 인계, 전체 완료 보류(UI 회귀 1건). API/빌드·UI·최종 QA 완료와 구분한다.

## 작업 순서와 결정 이력

1. AGENTS·문서 색인·보드·추천 엔진 README·부모 명령 전체와 현행 추천 계약을 확인했다. 보드/역할 README에는 작업 ID 링크가 아직 없었으므로 사용자 명시 작업 ID와 부모 상세 명령을 실행 근거로 삼았다. 보드는 수정하지 않았다.
2. 기존 방식: 출시 proxy는 Kakao를 사용하지만 legacy travel은 ODsay 키를 읽고 HTTP·사용량 저장·신규 ODsay cache를 만들었으며 짧은 구간은 walk_short 근사 성공을 만들었다.
3. 실패 fixture 먼저 실행: 2건 모두 실패. 근거는 근거리 fail=0(기대1), TMAP 실패 후 HTTP2회(기대 보행1회만)였다.
4. 교체: legacy transit entry를 모든 거리에서 무호출 no-route로 유지하고 키 읽기·요청 builder·응답 parser·사용량 저장·transit cache write를 제거했다. 이유: 필요 없는 신규 수신자를 제거하고 근사 transit 성공으로 우회하지 않기 위함. 상태: 엔진 현행 구현, 전체 출시 제거는 후속 B/C/D 대기.

## 1. 변경 파일

- `src/engine/travel.ts`: ODsay 환경값 읽기, URL/fetch, 사용량 counter/storage/log, 신규 transit cache·ODsay source write 제거. `precomputeTransit`은 `{ok:0, fail:pairs.length, skipped:0}`. transit의 `travelMin`은 Infinity, `travelSrc`는 기존 실패 표지 transit_fallback, geometry/meta는 undefined, 신규 transit baseline은 null. 유한 근사시간과 직선을 새 코스 성공으로 만들지 않는다. TMAP 보행/자동차와 내부 haversine 선별 함수 자체는 수정하지 않았다.
- 같은 파일의 `attemptLegacyRouteHttp('odsay', ...)`는 observer/request 실행 전 undefined 반환. `getOdsayTransitUsage`는 deprecated zero-only 반환으로 보존했다. `scripts/test_transit_engine.ts`, `scripts/audit_transit_recommendations.ts`와 index export의 호출 호환 때문에 삭제하지 않았다. 기존 영속 counter를 읽거나 지우지 않는다.
- `test/engine-odsay-removal.test.ts`: 실제 travel 모듈을 격리 실행하는 순수 VM fixture 3건. key-read Proxy, HTTP recorder, storage recorder, 과거 Leg snapshot을 사용한다.
- `test/course-v1-route-adapter.test.ts`: 실제 엔진 HTTP helper의 ODsay observer 호출 기대만 0으로 교체했다. 어댑터 제품 코드는 수정하지 않았다.
- `test/api-release-safety.test.ts`: 실제 엔진 transit HTTP 기대만 1→0으로 교체했다. 나머지 API safety 기대는 유지했다.
- 본 인계 문서. 다른 세션 변경·중앙 문서·UI·서비스·환경·빌드 파일은 수정하지 않았다.

## 2. 유지한 계약

- 최대180분/최대2곳, 체류·개인화·운영시간·도착 여유·출시 ledger/호출 예산 변경 없음.
- Kakao proxy exact transit과 geometry, TMAP 보행 계약 유지. 새 TMAP transit·자동차 대체·다른 공급자 추가 없음.
- `Leg.src: string` 및 저장 snapshot 타입 변경 없음. 과거 `src: ODsay`·분·geometry는 JSON 왕복에서 보존되며 신규 travel cache로 수입하지 않는다. DB 행의 변환·삭제·재계산 없음. 실제 UI 과거 기록 표시 검증은 C/D 소유다.
- legacy transit 실패는 무한 시간/실패 source/geometry 없음으로 반환한다. Infinity는 엔진 내부 no-route sentinel이지 저장·표시할 검증 시간 계약이 아니다. 후속 API/QA는 이를 유한 성공 시간으로 저장하지 않는 경계까지 확인해야 한다.

## 3. 테스트 결과

- 집중: `node --import tsx --test test/engine-odsay-removal.test.ts test/api-release-safety.test.ts test/course-v1-route-adapter.test.ts test/route-provider-adapter.test.ts test/course-v1-route-geometry.test.ts test/route-proxy-geometry.test.ts test/release-three-hour-engine.test.ts` → 45/45 통과.
- 신규 fixture: 키 두 개를 fixture 값으로 주입해도 ODsay key-read0·transit fetch0·storage write0. 동일/근거리/원거리/retry 모두 실패 반환. TMAP 실패1회 이후 신규 transit 호출0. ODsay helper request/observer 경계는 차단. 과거 snapshot은 그대로 파싱 가능하고 새 cache와 분리.
- `src/engine` 정적 검사: api.odsay.com, EXPO_PUBLIC_ODSAY_API_KEY, ODSAY_API_KEY, ODSAY_USAGE, markOdsay, odsayTransit, transitCache.set 모두0. 신규 ODsay cache write 경로를 제거했다.
- `npm run test:typecheck`: 통과(exit0).
- `npm test`: 441/441 통과(exit0).
- `npm run test:ui`: 750건 중748 통과·1 실패·1 skip(exit1), 재실행에서도 동일. 실패는 `test/ui/basket-planner.test.ts:67`의 `course.totalMin <= ctx.remainingMin` 기대다. 고정 출발35.1578/129.0594 → 장소35.1601/129.0602 → 약속35.1796/129.0756, remaining180에서 실경로 없는 자동 transit 구간이 이제 Infinity이므로 기존 근사 성공 기대를 만족하지 않는다. 엔진 변경과 직접 연관된 계약 전환 실패이며 무관 실패로 분류하지 않는다. UI 테스트/제품 파일은 수정하지 않았다.
- `git diff --check`: 통과.

## 4. 다음 담당·남은 위험

- API-ODSAY-REMOVE-01: 서비스 live provider/budget의 ODsay 성공 판정·attempt 제거와 release wrapper 입력 정리. 조사 시 `scripts/release-build.cjs`의 client 목록에 ODSAY_API_KEY가 남아 있다. 엔진 제거만으로 release artifact 정리를 완료했다고 주장하지 않는다.
- 로컬/CI 변수 존재 검사·해당 변수 제거 인계는 API 담당이다. 이번 세션은 환경파일·secret을 읽거나 출력·삭제하지 않았다.
- C/D: 과거 저장 코스 열기·geometry 누락·명시 재계산의 실제 UI/저장 경계, Kakao proxy exact source·cache/receipt/CAPTCHA와 최종 bundle을 검증한다. read-only/disabled 호환 문자열을 신규 provider 활성 경로와 구분한다.
- **U-ODSAY-REMOVE-01 활성 인계:** `basketPlanner`가 실패 시간을 가진 Course 객체를 반환하는 경계와 호출자의 저장/성공 표시 차단을 확인해야 한다. 위 UI fixture는 성공을 위한 정확 경로를 주입하는 회귀와 실경로 없음의 실패 회귀로 분리할 필요가 있다. Infinity를 저장 가능한 유한 시간으로 바꾸거나 근사 transit을 복원해 테스트만 통과시키지 않는다. 이 확인 전 전체 작업 완료/출시 제거 수락을 요청하지 않는다.
- 공개 수신자 문안 삭제는 QA 수락 후 출시 문서 담당만 수행한다. 외부 API·DB·Simulator·운영 배포·게시·stage/commit/push 모두0.
