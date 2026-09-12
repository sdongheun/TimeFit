# 짜투리(TimeFit) 문서 안내

기준: 2026-09-12, 소스 `30c0284`. 사용자가 App Store 배포 완료를 보고했다. 저장소의 현재 코드·연결 상태를 설명하며 운영 DB 설정이나 출시 IPA와의 동등성을 새로 검증했다는 뜻은 아니다.

## 먼저 읽기

1. [현재 기능과 구조](03_product/현재기능과구조.md): 기능별 진입점·코드·저장 경계·과거 코드 구분
2. [추천 정책](03_product/추천로직.md), [UIUX 공통 규칙](03_product/UIUX_공통규칙.md): 현행 정정 절부터 읽기
3. [요구사항과 검증 상태](테스트.md), [UIUX 테스트 명세](03_product/UIUX_테스트명세.md)
4. [작업 보드](작업조정_보드.md), [역할별 문서](work/README.md): 후속 작업 소유 경계

## 기능별 문서

| 찾는 내용 | 기준/근거 문서 |
| --- | --- |
| 앱 목적·개발 폴더·검증 명령 | [프로젝트 README](../README.md) |
| 출발/도착 수동 선택·시간 설정·추천·2곳 선택 | [추천 정책](03_product/추천로직.md), [현재 구조](03_product/현재기능과구조.md) |
| 장소 상세·주변 둘러보기·지도·화면 표현 | [UIUX 규칙](03_product/UIUX_공통규칙.md) |
| 코스 진행·Live Activity·기록·계정·개인화 | [현재 구조](03_product/현재기능과구조.md), [DB 설계](04_backend/데이터베이스설계.md) |
| 데이터·사진·운영시간 근거 | [데이터 역할 색인](work/data-curation/README.md), [출시 자산 감사](work/data-curation/release-assets-final.md), [운영시간 감사](02_data/사용중_장소_운영시간_감사.md), [AI-Hub 체류 근거](02_data/AI허브_카테고리별_체류시간분포.md) |
| 외부 API·캐시·공급자 | [API 역할 색인](work/external-api/README.md), [데이터 처리 사실표](05_release/publish/data-facts.md) |
| 사용자용 기능 설명·공개 고지 | [지원 안내](05_release/publish/support.md), [개인정보처리방침](05_release/publish/privacy-policy.md), [이용약관](05_release/publish/terms.md) |
| 출시 당시 빌드·스토어 입력·실기기 근거 | [출시 문서 세션](05_release/release-document-session.md), [제출 자료](05_release/publish/app-store-submission.md), [출시 후 인계](work/integration-decision/post-release-role-commits.md) |

## 현행과 과거를 구별하는 규칙

- 소스의 존재만으로 현재 사용 기능이라고 판단하지 않는다. 화면 등록뿐 아니라 탭·버튼·복원·빌드 플래그의 호출 경로를 확인한다.
- `docs/work/`의 완료 명령과 `archive/`는 증거·이력이다. 과거 `지금 실행`, `보류`, `구현 전` 문구로 작업을 재개하지 않는다.
- 구현이 정책을 어겼다면 정책을 코드에 맞춰 자동 완화하지 않고 **구현 편차**로 남긴다.
- 운영 적용·서비스 설정은 코드만으로 확정하지 않는다. 과거 문서의 `원격 미적용` 역시 현재 사실로 복사하지 않는다.
- [이전 색인 전체](README-history.md)의 상세 링크는 이력 조회용이다. 기존 사양·검증 숫자를 현재 값으로 일괄 치환하지 않는다.

## 다음 순서

문서 정합성 정리 → 테스트 현황·누락 조사 → 필요한 테스트 보강 → 승인된 코드 정리·리팩터링/UI 수정. 문서 정리만으로 제품 코드 제거, DB 변경, 공개 문서 재배포 또는 스토어 업데이트를 수행하지 않는다. 역할 경계와 인수인계는 [AGENTS.md](../AGENTS.md)를 따른다.
