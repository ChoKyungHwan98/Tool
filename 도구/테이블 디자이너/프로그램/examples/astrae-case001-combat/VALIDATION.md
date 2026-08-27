# CASE_001 전투·캐릭터 데이터 검증 결과

검증 대상: `Astrae-Oratio-CASE001-Combat.gsw`

| 검증 항목 | 결과 | 비고 |
|---|---:|---|
| WorkbenchDocument v2 파싱 | PASS | 정규화 스키마 v6.2.0과 6개 테이블·14개 데이터 행을 함께 저장 |
| 저장 → 재열기 roundtrip | PASS | 문서 전체가 동일하게 복원됨 |
| PK 중복 | 0 | 모든 테이블의 첫 열 `id` 단일 PK |
| 전체 ID 중복 | 0 | 콘텐츠·전투 프로젝트의 모든 행 ID가 서로 다른 범위 사용 |
| FK 오류 | 0 | 모든 FK가 대상 테이블의 숫자 `id` 한 열만 참조 |
| 테이블 / 관계 | PASS | 실제 반복 단위만 분리한 6개 / 4개 관계 |
| Enum 오류 | 0 | 행동·예고·대상·승패 조건 포함 |
| 필수값 누락 | 0 | Unity 실행에 필요한 AP·대상·피해 값이 모두 존재 |
| 콘텐츠 프로젝트 연결 | PASS | `BattleTable.caseDifficultyId`가 콘텐츠 난이도 ID 3개와 직접 일치 |
| 현재 구현 난이도 | PASS | 콘텐츠 `isImplemented=true`는 NORMAL(1050002) 한 건 |
| 난이도별 전투 튜닝 | PASS | 전투 3행이 HP·공격력·BREAK Gauge 배율로 분리 |
| BREAK 공통 규칙 연결 | PASS | Gauge 0에서 발생, 해당 Turn 적 행동 1개 감소, 다음 Turn 시작 시 Gauge 최대치 초기화 |
| 보스 전용 경계·페이즈 제거 | PASS | 범용 마법 3종과 행동별 가중치만 사용 |
| Unity HFSM 후속 연결 키 | PASS | Controller·행동 키만 보존하고 상세 HFSM은 후속 범위 |
| 단일 캐릭터 범위 | PASS | 최대 파티 3명 규칙은 유지하고 현재 캐릭터는 마미야 리츠 1명 |
| 미구현 행동 분리 | PASS | 교대 공격만 `isImplemented=false` |
| 실행 수치 명확화 | PASS | 계수 대신 `hpDamage`·`breakDamage` 고정 피해 사용 |
| 불필요한 중간 테이블 제거 | PASS | BreakRuleTable·BossActionSelectionTable을 공통 규칙·행동 테이블에 병합 |
| 설명·근거·중복 열 제거 | PASS | battleCode·conditionKey·중복 기본 AP 열 미사용 |
| CSV 정본 일치 | PASS | 앱의 ColumnId 기반 직렬화 결과와 비교 |

## 현재 구현 경계

1. EASY/HARD 전투 행은 확장용 데이터로 유지하지만 콘텐츠에서 진입하지 않는다.
2. NORMAL(1050002)만 Unity 전투 구현 대상으로 사용한다.
3. 회피 AP 1과 현재 적 행동 1개 취소는 기능 목업용 결정이다.
4. 교대 공격은 두 번째 캐릭터가 없으므로 표시·실행하지 않는다.
5. BREAK의 적 행동 1개 감소와 다음 Turn Gauge 초기화는 공식 확인값이 아닌 Prototype 임의 설정이다.

확정되지 않은 Scene/Prefab과 BREAK의 추가 피해·기절 효과는 테이블에 만들지 않았다. 실제 요구가 확정되면 추가한다.

## 포트폴리오 가안 수치

HP, BREAK, 고정 피해, 행동 가중치와 난이도 배율은 Unity 기능 목업을 실행하기 위한 `Prototype` 수치다. 공식 게임 수치 또는 공개자료에서 확인된 수치로 주장하지 않는다.

검증 명령:

```powershell
npm run test:run -- src/application/astraeCaseMasterData.test.ts src/application/astraeCaseCombatData.test.ts
```
