# 추천 엔진 v1·receipt runtime

## 범위

`2-E`~`2-J`: 1~3곳 검증 코스, 분 단위 시간 예산, 운영시간·실제 경로 gate, Route Proxy receipt 연결을 정립한 워크스트림이다.

## 유지 계약

- 자동 대표는 `representative_core/standard`와 구조화 운영시간·실제 도보/대중교통 경로를 모두 통과해야 한다.
- 결과는 최대 9개, 사전선정은 장소 18개·순서 코스 5,220개 이하다.
- receipt는 `no_route`·`unavailable`을 fail-closed로 전달하며, 새 provider attempt 8회·adapter call 24회가 기본 A8의 상한이다.
- UI가 근사 경로나 차량 fallback을 성공 결과로 바꾸지 않는다.

## 현재 관계

이 기본은 수락됐고, 후보 우선순위는 [tier-and-supply](tier-and-supply.md), B12 internal 비교는 [b12-internal-validation](b12-internal-validation.md)에서 다룬다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
