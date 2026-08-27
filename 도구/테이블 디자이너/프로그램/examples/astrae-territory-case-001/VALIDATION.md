# CASE_001 콘텐츠 데이터 검증 결과

검증 대상: `Astrae-Oratio-CASE001.gsw`

| 검증 항목 | 결과 | 비고 |
|---|---:|---|
| WorkbenchDocument v2 파싱 | PASS | 간소화 스키마 v9.0.0 |
| 테이블 / 관계 / 데이터 행 | PASS | 6개 / 6개 / 15개 |
| PK 중복 | 0 | 모든 테이블의 첫 열 숫자 id 단일 PK |
| 전체 ID 중복 | 0 | 콘텐츠·전투 프로젝트 전역 ID 범위 분리 |
| FK 오류 | 0 | 모든 FK가 대상 숫자 id 한 열 참조 |
| CASE 흐름 순서 중복 | 0 | CASE_001 sequence 1·2·3 |
| 시나리오 명령 순서 중복 | 0 | SCENARIO 흐름별 sequence 1·2 |
| 미확정 시나리오 창작 | 0 | 도입·종료 대사는 각각 (미정), 확정 스탠딩만 resourceKey 사용 |
| 난이도 연결 누락 | 0 | EASY·NORMAL·HARD 각각 BATTLE 흐름에 연결 |
| 난이도 구현 범위 | PASS | NORMAL만 isImplemented=true |
| 가보상 연결 | PASS | EASY·NORMAL·HARD에 GOLD 1·2·3 연결 |
| 불필요한 중간 테이블 | 0 | Participant·Scenario·Difficulty·RewardGroup 제거 |
| 전투 데이터 혼입 | 0 | 전투 수치·보스·HFSM·BattleTable 없음 |
| CSV 정본 일치 | PASS | 앱의 ColumnId 기반 직렬화와 비교 |
| 저장 → 재열기 roundtrip | PASS | Vitest 회귀 테스트 |

## 의도적으로 남긴 null

1. `CaseUnlockTable.requiredCaseId` — MAIN_STORY_UNLOCK은 선행 CASE를 사용하지 않음.
2. ScenarioCommandTable의 `speakerName` — 현재 대사가 미정이라 화자도 확정하지 않음.
3. ScenarioCommandTable의 명령별 미사용 컬럼 — commandType에 따라 필요한 컬럼만 사용함.
