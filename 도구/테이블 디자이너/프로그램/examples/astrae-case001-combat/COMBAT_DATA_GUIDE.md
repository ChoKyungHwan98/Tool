# CASE_001 전투 데이터 설명서

## 전체 연결

`CaseDifficultyTable.id → BattleTable.caseDifficultyId → CombatRuleTable / BossTable → 행동 테이블 → Unity HFSM`

콘텐츠 프로젝트가 고른 난이도 ID를 전투 프로젝트가 그대로 받는다. 현재 Unity는 NORMAL의 `1050002`만 실행한다. EASY `1050001`과 HARD `1050003`은 향후 확장용 데이터다.

## 1. CombatRuleTable

전투 전체가 공유하는 규칙이다. 최대 파티는 3명, Turn 시작 AP는 3, 적 행동 예고는 3개다. 현재 목업 캐릭터는 한 명뿐이므로 `maxPartySize=3`은 최대 허용 인원을 뜻한다.

BREAK Gauge가 0이 되면 BREAK가 발생한다는 공통 조건도 이 테이블에서 관리한다. BREAK가 발생한 Turn에는 적 행동 예고와 실제 실행 수를 1개 줄이고, 다음 Turn 시작 시 Gauge를 최대치로 초기화한다. 세 난이도 전투가 같은 CombatRule 행을 공유하므로 BREAK는 보스 전용이 아니라 공통 규칙이다. 이 행동 감소·초기화 규칙은 공식 자료에서 확인된 내용이 아니라 목업의 전략성을 검증하기 위한 Prototype 임의 설정이다.

## 2. BattleTable

콘텐츠 난이도 한 행을 실제 전투 규칙과 보스에 연결하는 전투 입구다. 세 난이도 데이터는 같은 보스와 HFSM을 재사용하고 배율만 다르다. 현재 진입 가능한 행은 NORMAL에 연결된 `2030002`다.

## 3. CharacterTable

플레이어 캐릭터의 기본 HP와 영지선언 Gauge 최대값을 관리한다. 현재는 확정된 마미야 리츠 한 명만 있다.

## 4. CharacterActionTable

캐릭터가 사용할 행동과 AP·쿨다운·고정 HP/BREAK 피해를 관리한다. 회피는 대응 창에서 AP 1을 소비하고 현재 적 행동 1개를 취소한다. 이 여부는 `cancelsCurrentEnemyAction`으로 명시한다. `unityActionKey`로 Unity 행동 코드를 찾으며, 두 번째 캐릭터가 없으므로 교대 공격만 `isImplemented=false`다.

## 5. BossTable

보스의 HP Bar, BREAK Gauge, Unity HFSM 키를 관리한다. 보스는 영지 결정에 불복한 단순 마법사 A이며 경계 마법이나 전용 BREAK 규칙을 사용하지 않는다.

## 6. BossActionTable

보스의 마력탄·연속 마력탄·광역 마력 폭발에 대상·예고·고정 피해·대응 시간·선택 가중치를 연결한다. 모두 기능 목업용 범용 마법이다. 현재 보스는 페이즈나 조건별 패턴이 없으므로 별도 선택 테이블을 만들지 않는다. 나중에 페이즈마다 가중치가 달라질 때만 패턴 테이블을 추가한다.

## NORMAL 전투의 최소 계산

- 보스 HP: `hpPerBar 1000 × hpBarCount 2 × bossHpMultiplier 1.0`
- 캐릭터 공격: `CharacterActionTable.hpDamage`를 HP에 직접 차감
- BREAK 공격: `breakDamage`를 BREAK Gauge에 직접 차감
- 보스 공격: `BossActionTable.hpDamage × bossDamageMultiplier`

이 값은 짧은 Unity 영상에서 전투 흐름을 검증하기 위한 Prototype이며 공식 밸런스가 아니다.

## HFSM 확정 경계

현재 테이블은 HFSM이 사용할 컨트롤러 키·행동 키·선택 가중치까지만 제공한다. 상세 상태와 전이는 Unity 전투 설계 단계로 미룬다.

## 면접 한 문장

“콘텐츠 난이도 ID를 전투 입구에 직접 연결하고, 공통 규칙·캐릭터 행동·보스 행동·선택 가중치를 실제 반복 단위로 분리했습니다. 쉬움과 어려움은 확장 데이터로 보존하고 보통 난이도만 Vertical Slice로 구현합니다.”
