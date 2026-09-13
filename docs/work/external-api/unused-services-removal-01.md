# API-UNUSED-SERVICES-REMOVE-01 — 미연결 서비스 5개 제거

2026-09-14. [기준 명령](../qa-release/unused-services-removal-01.md) §1 수행. **API 소유 제거·계약 검증 완료, DB→UIUX→QA 순서 인계.** 전체7개 제거·출시 빌드 검증 완료와 구분한다.

## 1. 변경 파일 / 목적

시작 HEAD `232a45d`. 기존 U-UNUSED-UI-REMOVE-03의 미커밋 UI 소스19개 삭제, UI 테스트 삭제/혼합 수정, `test/map-transport-ui-contract.test.mjs` 변경, 관련 작업 문서·`test/ui/unused-ui-removal-03.test.mjs`·`output/`를 확인하고 그대로 보존했다. 초기 작업 트리에 API 후보/계약 테스트 변경은 없었다. 사용자 변경 초기화·stage·commit/push 없음.

이전: 미연결 API prototype·정리 도구 소스를 호환/검증 목적으로 보존 → 현재 앱/서버/스크립트에서 삭제 집합 밖 호출 없음 재확인 → 사용자 승인된 파일5개와 전용 테스트만 제거 → 실제 사용하는 서비스와 테스트 목적을 일치 → API 소유 범위 현행 제거.

| 제거 소스 (`src/services/`) | 확인 및 테스트 대응 |
| --- | --- |
| `kakaoReverseGeocodeAdapter.ts` | `reverseGeocodeSelection` 제품 호출0. 전용 `test/kakao-reverse-geocode-adapter.test.ts` 4건 제거. 현행 label adapter의 주소/region/실패/cache runtime6건 보존·통과 |
| `placeSearchSuggestionAdapter.ts` | `searchPlaceSuggestions` 제품 호출0. 혼합 `test/place-search-adapter.test.ts`의 import와 폐기 suggestion fallback4건을 정리하고 실제 Kakao/TMAP category metadata 변환2건으로 이관. 기존 검색 성공/안전실패/keyword/의미 매칭5건 유지(총9→7) |
| `routeProxyAdapter.ts` | 유입은 테스트만. 내부 `routeProviderAdapter` 의존은 같은 삭제 집합. prototype cache/budget 전용 `test/route-proxy-adapter.test.ts` 6건 제거. 운영 handler와 무관 |
| `routeProviderAdapter.ts` | 외부 제품 유입0, 위 prototype 내부 유입만 존재. 전용 `test/route-provider-adapter.test.ts` 5건 제거. 현재 Kakao request/production receipt/실패 계약은 별도 파일로 유지 |
| `legacyRouteBaselineCleanup.ts` | `purgeLegacyRouteBaselineCache` 제품 호출0. `test/api-release-safety.test.ts`의 전용 import·SAFETY-05 1건만 제거. SAFETY-01/02/03/04/06/07 로그·cache 격리·재시작·실패·동시성6건 그대로 유지 |

추가: `test/api-unused-services-removal.test.mjs` 6건 — App/index/src/scripts/supabase/plugins의 삭제 집합 밖 파일명/주요 entry 식별자 참조0 검사1건, 파일 부재5건. import/reexport뿐 아니라 문자열 dynamic 참조도 텍스트 경계로 검사한다. 테스트 자체와 문서 이력은 제품 유입으로 계산하지 않는다.

서비스5개와 전용 테스트3개는 Git 관리 파일이므로 기존 HEAD 이력에서 복구 가능하다. 저장 데이터 삭제가 아니다. 공유 engine/helper/type·UI 호출자를 연쇄 삭제하지 않았다.

## 2. 보존 계약

- `PlacePicker`는 `kakaoLocationSearchAdapter`/`kakaoLocationLabelAdapter`, `MapPlacePicker`·수동 복원·주변·시간 설정은 현행 label adapter를 사용한다. 이 파일들과 `placeNameSemanticMatch`, engine Kakao/TMAP 함수는 변경하지 않았다.
- 운영 `supabase/functions/route-proxy/index.ts`는 `./handler.ts`의 `createRouteProxyHandler`를 사용한다. handler/deadline/kakaoRouteRequest 및 production ports, 앱의 `routeProxyClientAdapter`/activated adapter를 제거하거나 변경하지 않았다.
- API 키/환경변수/공급자/요청 경로/cache 정책 불변. baseline cleanup을 실행하지 않았고 AsyncStorage key 열거·삭제·알림 취소·DB 행 삭제 없음.
- GPS 미사용·180분/2곳·추천/학습/기록/복원/동의/권한 및 `courseV1.testOnly.ts` 유지. DB의 courseRepository와 UIUX의 courseNotifications는 이번 세션에서 손대지 않았다.

## 3. 실행 테스트 / 로그

- 삭제 전 새 제거 테스트: **1 PASS / 5 예상 FAIL**. 외부 유입0은 통과하고 파일 존재5건만 실패했다.
- 삭제 전 현재 기능: `node --import tsx --test`에 `kakao-location-search-adapter`, `kakao-location-label-adapter`, `route-proxy-production-ports`, `route-proxy-client-adapter`, `route-proxy-kakao-request`, `api-release-safety`의 `test/*.test.ts` 지정 → **45/45 PASS**.
- 삭제 후 위 목록 + `test/place-search-adapter.test.ts` + 신규 제거 `.test.mjs` → **57/57 PASS**. 동일 기능 목록은 SAFETY-05 폐기1건을 뺀44건이며 검색 혼합7건·제거6건이 더해진 수다.
- `npm run test:typecheck`: PASS(exit0).
- `npm test`: **561/561 PASS**, skip0. `/private/tmp/timefit-unused-api-core.log`. 기준555 대비 신규 제거 `.mjs`6건 증가. 삭제된 `.ts` 전용 계약은 기본 discovery에 포함되지 않으므로 core 숫자에서 차감되지 않는다. 삭제/혼합 계약 변화는 위 대응표와 별도 집중 실행으로 추적한다.
- `npm run test:ui`: **총796 / PASS795 / FAIL0 / 기존 skip1**, 기준과 동일. `/private/tmp/timefit-unused-api-ui.log`. 로컬 tsx IPC 제약 때문에 승인된 권한으로 실행했다. 테스트 실행으로 실제 provider·운영 DB를 호출하지 않았다. `git diff --check`: PASS.

## 4. 다음 결정·위험 / QA 인계

- 다음은 명령의 DB→UIUX→QA 순서다. API 후보5개 전부 제거 가능했으며 제품 호출 발견으로 제외한 파일0. API 소유 밖 실패를 숨기기 위한 loader/설정/skip 변경0.
- 남은 QA 참조는 `test/map-transport-ui-contract.test.mjs:83`의 `searchPlaceSuggestions` 금지 regex다. 제거된 모듈을 import/실행하지 않는 음성 assertion으로 타입/실행 실패는 없으며, 해당 파일의 기존 UI 세션 변경을 보존했다. QA는 이를 현행 검색 runtime 보존 증거와 혼동하지 말고 필요 시 현행 경계 중심으로 정리한다. 파일 전체 삭제를 요구하지 않는다.
- 과거 작업 기록의 삭제 모듈명/검증 이력은 보존했다. 다른 QA 제품 import 잔존0(재검색 결과는 신규 부재 테스트와 위 금지 regex뿐).
- release export 및 실제 수정 빌드 정상 확인은 세 역할 완료 뒤 QA/통합 소유. 이번 API 세션에서 export/Archive·스토어 업데이트·원격 배포·운영 데이터 정리 미실행. 이전 IPA/산출물은 보존하며 현재 제거본과 같다고 주장하지 않는다.
