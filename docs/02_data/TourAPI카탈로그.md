# 한국관광공사 TourAPI 서비스·오퍼레이션 카탈로그

> 작성: 2026-06 / 출처: data.go.kr(기관코드 **B551011**) 임베드 Swagger·활용가이드 + 라이브 게이트웨이 프로빙 + 공개 GitHub/블로그 교차검증
> 목적: TimeFit에서 어떤 TourAPI 서비스의 어떤 오퍼레이션을 호출할지 한눈에 보기 위한 레퍼런스.
> 표기: **미확인(추정)** = serviceKey 라이브 호출 또는 Swagger/가이드 PDF(JS 렌더) 직접 확인 필요.

---

## 0. 공통 사항

- **호스트**: `https://apis.data.go.kr/B551011/{ServiceCode}/{operation}`
- **인증**: data.go.kr 계정당 `serviceKey` 1개를 공유하되, **데이터셋(서비스)별 "활용신청" 승인은 개별 필요**. (즉 국문 키로 무장애·반려동물·고캠핑을 바로 호출하면 403 → 각각 신청)
- **공통 요청 파라미터**: `serviceKey`(필수), `MobileOS`(IOS/AND/WIN/ETC), `MobileApp`(앱명), `_type`(json/xml), `numOfRows`, `pageNo`
- **정렬 `arrange`**: A=제목순, C=수정일순, D=생성일순, O/Q/R=각각 +대표이미지 필수
- **지역코드 주의**: TourAPI 지역코드 **부산 = `areaCode=6`** / 빅데이터(데이터랩) 법정동코드 **부산 = `26`** — 체계가 다름.
- **버전 주의**: 오퍼레이션명 끝 숫자가 버전. **국문·다국어·무장애·반려동물은 `2`(현행)**, **관광사진은 `1`**, **연관관광지는 `1`**. 무접미사/구버전 경로는 레거시거나 404.

---

## 1. 국문 관광정보 서비스 — `KorService2` (마스터)

> **제공** · 전국(부산 포함)의 관광지·문화시설·축제·여행코스·숙박·음식·쇼핑·레포츠 기본정보(이름·주소·좌표·이미지·운영시간·주차 등)를 한국어로 제공하는 핵심 서비스.

- data.go.kr **15101578** · `https://apis.data.go.kr/B551011/KorService2/`
- 전국 약 26만 건, 15종. **다국어 8종이 이 오퍼레이션 세트를 동일하게 공유**.

### 오퍼레이션 (15종)

| 오퍼레이션 | 한글기능 | 반환내용 | 핵심 파라미터 |
|---|---|---|---|
| `areaCode2` | 지역코드 조회 | 시도/시군구 코드 목록(code,name) | `areaCode`(생략=시도) |
| `categoryCode2` | 서비스분류코드 조회 | 대/중/소분류 트리 | `contentTypeId, cat1, cat2, cat3` |
| `ldongCode2` | 법정동코드 조회 | 법정동 시도·시군구 코드 | `lDongRegnCd, lDongListYn` |
| `lclsSystmCode2` | 신분류체계코드 조회 | 신(新) 대/중/소분류 코드 | `lclsSystm1/2, lclsSystmListYn` |
| `areaBasedList2` | 지역기반 관광정보 조회 | 지역·분류 기준 목록 | `contentTypeId, areaCode, sigunguCode, cat1/2/3, arrange, lDongRegnCd, lDongSignguCd, lclsSystm1/2/3` |
| `locationBasedList2` | 위치기반 관광정보 조회 | 좌표 반경 내 목록(+`dist`) | **`mapX, mapY, radius`**(필수, 최대 20000m), `contentTypeId, arrange` |
| `searchKeyword2` | 키워드 검색 조회 | 키워드 일치 목록 | **`keyword`**(필수), `contentTypeId, areaCode, …` |
| `searchFestival2` | 행사정보 조회 | 기간 내 축제·행사(+`eventstartdate/enddate`) | **`eventStartDate`**(YYYYMMDD,필수), `eventEndDate, areaCode` |
| `searchStay2` | 숙박정보 조회 | 숙박 목록(+`hanok/benikia/goodstay`) | `areaCode, sigunguCode`(type 32 묵시) |
| `detailCommon2` | 공통정보 조회 | 제목·주소·좌표·개요(overview) 등 | **`contentId`**(필수) |
| `detailIntro2` | 소개정보 조회 | 타입별 상세(운영시간·휴무·주차 등, ↓표) | **`contentId, contentTypeId`** |
| `detailInfo2` | 반복정보 조회 | 반복 항목(객실/코스 등 다건) | `contentId, contentTypeId` |
| `detailImage2` | 이미지정보 조회 | 추가 이미지 목록 | `contentId, imageYN, subImageYN` |
| `areaBasedSyncList2` | 동기화 목록 조회 | 등록/수정/삭제(`showflag`) 포함 | + `showflag, modifiedtime` |
| `detailPetTour2` | 반려동물 동반 정보 조회 | 반려동물 동반 가능 여부 등 | `contentId, contentTypeId` |

### contentTypeId 값

| ID | 종류 | detailIntro2 필드 접미사 |
|---|---|---|
| 12 | 관광지 | (없음) |
| 14 | 문화시설 | …culture |
| 15 | 축제공연행사 | …festival |
| 25 | 여행코스 | …tourcourse |
| 28 | 레포츠 | …leports |
| 32 | 숙박 | …lodging |
| 38 | 쇼핑 | …shopping |
| 39 | 음식점 | …food |

### `detailIntro2` 핵심 반환 필드 (타입별)

- **관광지(12)**: `usetime`(이용시간) · `restdate`(쉬는날) · `parking`(주차) · `chkbabycarriage`(유모차) · `chkpet`(애완동물) · `chkcreditcard` · `infocenter` · `expguide`(체험안내) · `accomcount`(수용인원)
- **문화시설(14)**: `usefee, usetimeculture, restdateculture, parkingculture, parkingfee, chkbabycarriageculture, scale, spendtime, discountinfo`
- **축제행사(15)**: `eventstartdate, eventenddate, playtime, eventplace, usetimefestival, agelimit, sponsor1, program, subevent, bookingplace`
- **여행코스(25)**: `infocentertourcourse, distance(총거리), schedule(일정), taketime(소요시간), theme` *(라벨 일부 미확인)*
- **레포츠(28)**: `openperiod, reservation, usetimeleports, usefeeleports, parkingleports, chkbabycarriageleports, accomcountleports`
- **숙박(32)**: `checkintime, checkouttime, roomcount, reservationurl, parkinglodging, subfacility, foodplace, refundregulation, chkcooking, pickup`
- **쇼핑(38)**: `saleitem, opentime, restdateshopping, parkingshopping, chkbabycarriageshopping, restroom, fairday, culturecenter`
- **음식점(39)**: `firstmenu(대표메뉴), treatmenu(취급메뉴), opentimefood, restdatefood, packing, parkingfood, reservationfood, seat, smoking, kidsfacility`

### `areaBasedList2` vs `areaBasedSyncList2`

| | areaBasedList2 | areaBasedSyncList2 |
|---|---|---|
| 목적 | 표출 중 콘텐츠 일반 조회 | 외부 DB **동기화(증분)** |
| `showflag` | 없음(표출만) | 있음(1=표출, 0=삭제/비표출) |
| 삭제 추적 | 불가(그냥 사라짐) | 가능(`showflag=0`) |
| 활용 | 사용자 표시 목록 | `arrange=C`+`modifiedtime`으로 변경분 upsert |

---

## 2. 다국어 관광정보 서비스 (8종)

> **제공** · 국문(1번)과 동일한 관광정보를 영·일·중(간체/번체)·독·불·서·러 8개 언어로 제공 (외국인 대상 기능용).

**KorService2와 동일한 15종 오퍼레이션 세트를 그대로 공유**(콘텐츠 언어만 다름).

| 서비스코드 | 언어 | data.go.kr ID |
|---|---|---|
| `EngService2` | 영문 | 15101753 |
| `JpnService2` | 일문 | 15101760 |
| `ChsService2` | 중문 간체 | 15101764 |
| `ChtService2` | 중문 번체 | 15101769 |
| `GerService2` | 독어 | 15101805 |
| `FreService2` | 불어 | 15101808 |
| `SpnService2` | 서어(스페인어) | 15101811 |
| `RusService2` | 노어(러시아어) | 15101831 |

> 한국어 앱이면 `KorService2` 하나로 충분. 외국인 기능 추가 시 해당 언어 서비스 별도 신청.

---

## 3. 무장애 여행 정보 — `KorWithService2`

> **제공** · 장애인·고령자·영유아 동반자를 위한 무장애 편의시설(휠체어·점자블록·수유실·경사로 등) 정보를 제공.

- data.go.kr **15101897** · `https://apis.data.go.kr/B551011/KorWithService2/` · 전국 약 6만 건 · (사용자가 본 `#/useObstacle` 페이지)
- 오퍼레이션: `areaBasedList2, locationBasedList2, searchKeyword2, detailCommon2, detailIntro2, detailInfo2, detailImage2, areaBasedSyncList2`, **`detailWithTour2`**(무장애 특화), `areaCode2`/`categoryCode2`(또는 v4 `ldongCode2`/`lclsSystmCode2`)

### `detailWithTour2` 무장애 편의 필드 (5유형, 원문 확인)

- **지체장애**: `parking, route(접근로), ticketoffice(매표소), wheelchair(휠체어), exit(출입통로), elevator, restroom(장애인화장실), auditorium(관람석), room(객실)`
- **시각장애**: `braileblock(점자블록), helpdog(보조견), guidehuman(안내요원), audioguide(음성안내), bigprint(큰활자), brailepromotion(점자홍보물), guidesystem(유도설비)`
- **청각장애**: `signguide(수어안내), videoguide(자막/영상), hearingroom(객실경보)`
- **영유아가족**: `stroller(유모차), lactationroom(수유실), babysparechair(유아보조의자), publictransport(접근로)`

---

## 4. 반려동물 동반여행 — `KorPetTourService2`

> **제공** · 반려동물 동반 가능한 관광지·숙소·음식점과 동반 조건·구비/대여 품목 정보를 제공.

- data.go.kr **15135102** · `https://apis.data.go.kr/B551011/KorPetTourService2/`
- 오퍼레이션: `areaBasedList2, locationBasedList2, searchKeyword2, areaCode2, categoryCode2, detailCommon2, detailIntro2, detailInfo2, detailImage2`, **`detailPetTour2`**(펫 특화), `petTourSyncList2`(동기화), `ldongCode2, lclsSystmCode2`

### `detailPetTour2` 반려동물 필드 (Swagger 원문)

| 필드 | 의미 |
|---|---|
| `acmpyTypeCd` | 동반유형코드 |
| `acmpyPsblCpam` | 동반 가능 동물 |
| `acmpyNeedMtr` | 동반 시 필요사항 |
| `relaAcdntRiskMtr` | 사고대비 사항 |
| `relaPosesFclty` | 구비시설 |
| `relaFrnshPrdlst` | 비치품목 |
| `relaPurcPrdlst` | 구매품목 |
| `relaRntlPrdlst` | 렌탈품목 |
| `etcAcmpyInfo` | 기타 동반정보 |

> "추가요금"·"에티켓" 전용 필드는 공식 spec에 없음 → 텍스트 필드에 포함 추정(미확인).

---

## 5. 고캠핑 정보 — `GoCamping`

> **제공** · 전국 야영장·캠핑장의 위치·유형(글램핑/카라반/자동차)·부대시설·예약 정보를 제공.

- data.go.kr **15101933** · `https://apis.data.go.kr/B551011/GoCamping/` · 전국(부산 포함)

| 오퍼레이션 | 한글기능 | 반환 | 파라미터 |
|---|---|---|---|
| `basedList` | 기본 목록 | 전체 캠핑장 목록 | 공통 |
| `locationBasedList` | 위치기반 목록 | 좌표 반경 내(거리순) | `mapX, mapY, radius` |
| `searchList` | 키워드 검색 | 키워드 검색 목록 | `keyword` |
| `imageList` | 이미지 목록 | 특정 캠핑장 다중 이미지 | `contentId` |

특화 필드: `induty`(야영장유형) · `lctCl`(입지: 해변/산/숲/계곡/도심) · `sbrsCl`(부대: 전기·온수·와이파이 등) · `animalCmgCl`(반려동물 가능여부) · `operPdCl`/`operDeCl`(운영기간/운영일) · `resveCl`/`resveUrl`(예약) · 사이트수·위생/안전 개수(`toiletCo` 등)

---

## 6. 두루누비 정보 — `Durunubi`

> **제공** · 전국 걷기여행길·자전거길·코리아둘레길 코스와 GPX 경로 정보를 제공.

- data.go.kr **15101974** · `https://apis.data.go.kr/B551011/Durunubi/` · 걷기길/자전거길/코리아둘레길 284개 코스 · **부산 오륙도 기점(남파랑·해파랑길) 다수 포함**

| 오퍼레이션 | 한글기능 | 반환 | 파라미터 |
|---|---|---|---|
| `courseList` | 코스 목록 | 코스명·거리·난이도·소요시간·GPX경로 | `brdDiv, crsIdx` 등 |
| `routeList` | 길 목록 | 상위 경로(여러 코스 묶음) | `brdDiv, routeIdx` |

- **GPX 전용 오퍼레이션 없음** → 응답 필드 `gpxpath`(.gpx URL)를 별도 다운로드·파싱.
- `brdDiv`: **`DNWW`=걷기길, `DNBW`=자전거길**. 필드: `crsKorNm`(코스명), `crsDstnc`(거리), `crsLevel`(난이도).

---

## 7. 생태 관광 정보 — (추정 `EcoTourInfoService`)

> **제공** · 전국 지정 생태관광지(약 40개소)의 위치·개요 정보를 제공.

- data.go.kr **15101908** · 소형 서비스(전국 지정 생태관광지 ~40개소)
- 오퍼레이션(추정): `areaBasedList, areaCodeList, locationBasedList, searchKeyword, detailCommon, detailIntro/Info/Image` — **소수만 제공 추정(미확인)**. `searchFestival/Stay` 불포함 추정.
- 응답: TourAPI 표준 스키마(`title, addr1, mapx, mapy, firstimage, overview` 등). 부산 레코드 실재 여부 미확인.

---

## 8. 관광사진(포토갤러리) — `PhotoGalleryService1`

> **제공** · PhotoKorea의 고품질 관광 사진(약 10만 장, 제목·촬영장소·작가·이미지URL)을 제공.

- data.go.kr **15101914** · `https://apis.data.go.kr/B551011/PhotoGalleryService1/` · PhotoKorea 약 10만 장, 공공누리 1유형 · **경로·오퍼레이션 끝 `1` 필수**

| 오퍼레이션 | 한글기능 | 반환 | 파라미터 |
|---|---|---|---|
| `galleryList1` | 사진 목록 | 제목·촬영장소·작가·키워드·이미지URL·촬영월 | `arrange` |
| `galleryDetailList1` | 상세 목록 | 동일(제목 그룹 단위) | `title`(필수) |
| `gallerySearchList1` | 키워드 검색 | 동일 | `keyword`(필수) |
| `gallerySyncDetailList1` | 동기화 목록 | + `galUseFlag` | `showflag, modifiedtime` |

- 입도: **사진(콘텐츠) 단위**, 지역코드 없음 → 부산은 `keyword=부산` 텍스트 검색.

---

## 9. 빅데이터 지역별 방문자수 — `DataLabService`

> **제공** · 통신사 기반 지역(시도/시군구)별·일자별 방문자수 통계를 제공 (POI 단위 아님).

- data.go.kr **15101972**(관광빅데이터 정보서비스_GW) · `https://apis.data.go.kr/B551011/DataLabService/`
- **실재 오퍼레이션 2개만**(카드·내비 데이터는 별도 데이터셋)

| 오퍼레이션 | 한글기능 | 반환 | 입도 |
|---|---|---|---|
| `metcoRegnVisitrDDList` | 광역지자체 방문자수(일별) | 시도별 일자별 방문자수(KT 내국인/SKT 외국인) | 광역·일별 |
| `locgoRegnVisitrDDList` | 기초지자체 방문자수(일별) | 시군구별 일자별 방문자수 | 기초·일별 |

- 파라미터(추정): `startYmd, endYmd, areaDvCd/signguCode` (케이싱 미확인). 데이터 2020-01~. **POI 단위 아님.**

---

## 10. 관광지별 연관 관광지 — `TarRlteTarService1`

> **제공** · 티맵 내비 기반 "이 관광지와 함께 가는 연관 관광지" 랭킹을 제공 (동선·추천에 유용).

- data.go.kr **15128560** · `https://apis.data.go.kr/B551011/TarRlteTarService1/` · **티맵 내비 데이터 기반**(2024-05~2025-04), 중심 관광지별 연관 관광지 랭킹(최대 50)

| 오퍼레이션 | 한글기능 | 반환 | 파라미터 |
|---|---|---|---|
| `areaBasedList1` | 지역기반 연관관광지 | 중심–연관관광지·연관순위(rlteRank)·대중소분류 | `baseYm`(YYYYMM), `areaCd, signguCd` |
| `searchKeyword1` | 키워드 연관관광지 | 동일(키워드 필터) | `baseYm, keyword` |
| `destinationLookup`(영문명세) | 특정 관광지별 연관 | 동일 | 미확인(추정) |

- 입도: **POI 단위·월별(`baseYm`)**. "이 관광지 다음에 뭐 갈지" 추천에 유용.

---

## 11. 관광지 방문자 집중률(혼잡 예측) — data.go.kr **15128555**

> **제공** · KT 이동통신+머신러닝 기반 관광지별 향후 30일 혼잡(집중률) 예측을 제공.

- 정식명: **한국관광공사_관광지 집중률 방문자 추이 예측 정보** (15128560 연관관광지와 **별개**)
- 방법: **KT 이동통신 + 머신러닝**, 2018~ 방문패턴·평일/휴일·계절성, **조회일 기준 향후 30일 집중률 예측**. 최종수정 2026-05(활발 유지).
- 오퍼레이션/파라미터/필드 **미확인(추정)** — Swagger(JS 렌더)만 노출. 입도: POI·일별 30일 예측(추정). 부산 POI 커버리지 미확인.
- 참고: **2025 공모전 수상작 "혼잡도" 주제가 이 데이터 계열** → 신규 주제로는 회피 권장.

---

## 부산(areaCode=6) 커버리지 요약

| 서비스 | 부산 포함 | 비고 |
|---|---|---|
| 국문·다국어(1~9) | ✅ | `areaCode=6` 또는 위치기반 |
| 무장애(KorWithService2) | ✅ | |
| 반려동물(KorPetTourService2) | ✅ | |
| 고캠핑(GoCamping) | ✅ | `doNm=부산광역시` |
| 두루누비(Durunubi) | ✅ | 남파랑·해파랑 오륙도 기점 |
| 생태관광(15101908) | ⚠️ 미확인 | |
| 관광사진(PhotoGallery1) | ✅ | `keyword=부산` |
| 빅데이터 방문자수(DataLab) | ✅ | 지역 단위 |
| 연관관광지(TarRlteTar1) | ✅ | |
| 집중률(15128555) | ⚠️ 미확인 | |

---

## 미확인 / 라이브 검증 필요 항목

1. `ldongCode2`/`lclsSystmCode2`, v2 신규 파라미터(`lDongRegnCd` 등)의 정확한 응답 필드 철자
2. `detailIntro2` 여행코스(25) 필드 라벨
3. `detailPetTour2`의 "추가요금/에티켓" 전용 필드 유무
4. 생태관광(15101908) 정확한 오퍼레이션 경로·개수, 부산 레코드 실재
5. DataLabService 파라미터명/케이싱
6. 연관관광지 3번째 오퍼레이션(`destinationLookup`) 정확 코드
7. 집중률(15128555) 오퍼레이션 코드·파라미터·응답필드 전체

> 위 항목은 각 data.go.kr 데이터셋의 **Swagger UI / 활용매뉴얼(국문).zip / 명세 PDF**를 브라우저에서 열거나, 유효 `serviceKey`로 `_type=xml` 1회 호출 시 응답에 실제 필드명이 그대로 나와 즉시 확정 가능.

---

## 주요 출처

- 국문 15101578 / 무장애 15101897 / 반려동물 15135102 / 고캠핑 15101933 / 두루누비 15101974 / 생태 15101908 / 관광사진 15101914 / 빅데이터 15101972 / 연관관광지 15128560 / 집중률 15128555 (각 `data.go.kr/data/{ID}/openapi.do`)
- 교차검증: github.com/harimkang/mcp-korea-tourism-api, github.com/JoMingyu/TourAPI, api.visitkorea.or.kr 콘텐츠랩
