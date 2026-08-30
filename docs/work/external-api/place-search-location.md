# 외부 API 장소 검색·위치 확인

## 범위

`API-S-1`~`S-7`: Kakao 장소/주소 검색, 교통 표기 변형, 지도 핀 역지오코딩, GPS 주소 라벨의 계약을 정립했다.

## 유지 계약

- 검색은 Kakao 단일 provider, 10분 memory TTL·in-flight 합치기, 실패 비cache를 사용한다.
- 장소·주소 fallback은 0건일 때만 한 번 수행하며, HTTP/설정 오류에는 다른 provider 우회를 만들지 않는다.
- GPS/핀 주소는 1회 확인하고 좌표·원문 응답을 장기 저장하지 않는다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
