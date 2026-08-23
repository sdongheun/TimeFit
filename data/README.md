# TimeFit 데이터 안내

> 앱 런타임은 `data/`를 직접 읽지 않는다. 앱 번들에서 읽는 JSON은 `src/data/`의 두 파일뿐이다.

## 1. 런타임 데이터

| 파일 | 역할 | 생성/근거 |
| --- | --- | --- |
| `src/data/busan_poi_catalog.json` | 활성 장소·활동 범위·좌표·출처·운영시간을 담은 앱 카탈로그 | `scripts/build_runtime_poi_catalog.mjs` |
| `src/data/area_availability_policy.json` | 시간 근거가 검증된 시장·거리·골목의 권역 시간 정책 | `src/engine/areaAvailability.ts` |

`src/data/busan_poi_catalog.legacy.json`은 앱이 import하지 않는 **카탈로그 재생성 호환 입력**이다. 현재 `build_runtime_poi_catalog.mjs`가 일부 과거 메타데이터를 보존하기 위해 읽는다. 런타임 데이터로 오해하지 않는다.

## 2. 현재 카탈로그 재생성 입력

- `processed/review/부산_자투리장소_카탈로그_초안.json`: 활성 후보를 판정한 원천 카탈로그
- `processed/review/부산_자투리장소_보류및제외.json`: 보류·하드 제외 근거
- `processed/부산_최종매칭장소.json`, `processed/부산_최종미매칭장소.json`: 자투리 카탈로그 생성 입력
- `processed/부산시_명소정보.json`, `processed/부산시_쇼핑정보.json`, `processed/부산시_맛집정보.json`: 부산시 관광 원천 스냅샷
- `processed/카테고리별_체류시간.json`과 `전국전통시장표준데이터.json`: AI-Hub 체류 분포·전통시장 후보 생성 입력

## 3. 현재 감사·검토 결과

- `processed/review/사용중_장소_운영시간_원천감사.json`: 활성 356개 장소의 TourAPI 상세 재조회·부산시 원천 대조
- `processed/review/현재사용_운영시간미확인장소.json`: 운영시간 미기재 후보 추출 결과. 위 원천 감사가 더 넓은 결과를 제공하므로 보조 자료다.
- `processed/review/현재사용_중복장소후보.json`: 런타임 중복 점검 결과

나머지 `processed/review/` 파일은 생성 스크립트와 상태를 [review 안내](processed/review/README.md)에서 확인한다.

## 4. 참고·보관 데이터

- `processed/archive/`: 현재 런타임·재생성에서 쓰지 않는 과거 정제·검증 결과
- 루트의 `전국공공시설개방정보표준데이터.json`, `전국도시공원정보표준데이터.json`: 공공시설·도시공원 확장 가능성을 조사한 원본. 현재 추천 후보에는 사용하지 않는다.
- `aihub_donbu/`: AI-Hub 원본 및 프로파일. 체류 분포 재집계 근거다.

## 5. 정리 원칙

1. 런타임 JSON은 `src/data`에만 둔다.
2. 재생성에 필요한 입력은 삭제하지 않는다. 스크립트가 참조하는 경로를 바꾸려면 같은 변경에서 스크립트·테스트·이 문서를 함께 갱신한다.
3. 한 번의 조사로 끝난 결과나 현행 파이프라인에서 참조되지 않는 결과는 `processed/archive/historical-reviews`로 옮긴다.
4. 원천 데이터는 파일명·수집일·제공기관을 보존한다. 단지 앱에서 쓰지 않는다는 이유로 원본을 삭제하지 않는다.
