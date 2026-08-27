# 아스트라에 오라티오 CASE_001 전투·캐릭터 데이터

## 역할

이 프로젝트는 콘텐츠 프로젝트의 난이도 ID 3개를 공통 전투 규칙, 공통 BREAK 규칙, 마미야 리츠와 단순 마법사 보스 행동 데이터로 연결한다.

- Authoring 정본: `Astrae-Oratio-CASE001-Combat.gsw`
- Unity 권장 입력: `export/json/AstraeCase001CombatData.json`
- 테이블별 쉬운 설명: `COMBAT_DATA_GUIDE.md`
- HFSM 최소 계약·후속 범위: `BOSS_CASE001_HFSM_DESIGN.md`
- 콘텐츠 연결 키: `CaseDifficultyTable.id` 1050001·1050002·1050003
- Unity HFSM 연결 키: `BossCase001Hfsm`

## ID 규칙

- 모든 테이블의 첫 열 `id`는 다른 테이블과도 겹치지 않는 숫자형 단일 PK다.
- 예: `2010001` = 전투 프로젝트(2) + CombatRuleTable(01) + 첫 행(0001)
- FK도 대상 행의 전체 숫자 ID를 그대로 사용한다.

## 책임 분리

- Table Designer: AP, HP, 공통 BREAK 발생 조건·적 행동 감소·Gauge 초기화 시점, 행동 ID, 수치와 행동 가중치
- 후속 Unity HFSM: 보스 행동 3개 선택·예고·실행 순서
- 공통 Battle Controller: BREAK 발생과 이후 공통 처리
- Unity Action Code: 피해 계산, 애니메이션과 VFX

## 정규화 기준

- `name`은 기획자가 숫자 ID의 대상을 확인하기 위한 편의값이다.
- `BattleTable.caseDifficultyId`는 콘텐츠 프로젝트와의 연결, `unityActionKey`와 `hfsmControllerKey`는 Unity 실행 연결에 실제로 사용하므로 유지한다.
- 설명·근거 상태·미확정 연결 키는 실행 데이터에서 제거하고 본 문서에서 관리한다.

## 난이도 처리

- `BattleTable`의 각 행은 콘텐츠 `CaseDifficultyTable.id` 하나와 직접 연결된다.
- 세 난이도는 같은 `BossTable`과 `CombatRuleTable`을 재사용한다.
- HP·공격력·BREAK Gauge만 배율로 조정하므로 보스 행동표와 HFSM을 복제하지 않는다.
- EASY/HARD 행은 확장용으로 유지하지만 콘텐츠의 `isImplemented=false`이므로 현재 Unity에서는 진입하지 않는다.
- NORMAL(1050002)만 현재 Unity 구현 대상이다.

## 수치 주의

캐릭터·보스·행동 수치와 난이도 배율은 기능 목업을 위한 가안이다. Unity가 계산식을 추측하지 않도록 `hpDamage`와 `breakDamage`는 고정 피해로 사용한다. 회피 AP 1·현재 적 행동 1개 취소와 BREAK 시 적 행동 1개 감소·다음 Turn Gauge 초기화도 목업용 결정이며 공식 규칙이 아니다.
