# CASE_001 콘텐츠 데이터 설명서

## 전체 구조

`CaseTable → CaseUnlockTable / CaseFlowTable → ScenarioCommandTable / CaseDifficultyTable → CaseRewardTable`

테이블 수를 늘리는 것이 아니라 실제로 여러 행이 반복되는 정보만 분리한 6개 구조다.

## 1. CaseTable

CASE 한 건의 기본 정보다. `name`, `summaryText`, `issueText`는 사건 목록과 상세 화면에 실제로 출력한다.

## 2. CaseUnlockTable

CASE가 열리는 조건을 한 행씩 기록한다. 같은 `caseId`의 조건은 모두 만족해야 한다.

- `MAIN_STORY_UNLOCK`: 메인 스토리에서 CASE 콘텐츠가 개방되면 충족
- `PREVIOUS_CASE_CLEAR`: `requiredCaseId`의 CASE를 클리어하면 충족

CASE_001은 `MAIN_STORY_UNLOCK`만 사용하므로 `requiredCaseId`가 비어 있다. 후속 CASE의 선행 조건에서만 이 값을 사용한다.

## 3. CaseFlowTable

CASE 내부의 진행 목차다. CASE_001은 `SCENARIO → BATTLE → SCENARIO` 순서다. 후속 CASE의 단계 수와 순서가 달라도 Unity Controller를 바꾸지 않고 데이터 행으로 구성할 수 있다.

## 4. ScenarioCommandTable

SCENARIO 유형의 `caseFlowId`에 직접 연결한다. Unity는 `sequence` 순서대로 캐릭터·대사를 실행한다. 현재 확정 자산은 마미야 리츠 스탠딩 한 장뿐이며, 구체적인 도입·종료 대사는 창작하지 않고 `(미정)`으로 남겼다.

## 5. CaseDifficultyTable

BATTLE 유형의 `caseFlowId`에 쉬움·보통·어려움을 연결한다. `sortOrder`는 난이도 버튼 순서다. `isImplemented`는 현재 빌드에서 실제 진입 가능한지를 뜻하며, CASE_001은 보통만 `true`다.

## 6. CaseRewardTable

`caseDifficultyId`에 아이템·재화 코드와 수량을 여러 행으로 연결한다. 별도 보상 그룹 없이도 난이도 하나에 여러 보상을 넣을 수 있다. 현재는 기능 확인용 가데이터로 쉬움 GOLD 1, 보통 GOLD 2, 어려움 GOLD 3을 넣었다.

## 면접 한 문장

“CASE의 정적 정보, 복수 해금 조건, 가변 진행 순서, 시나리오 명령, 난이도와 보상을 실제 반복 단위 기준으로 6개 테이블에 분리했습니다. 이름만 가진 중간 테이블은 제거해 단순성과 확장성을 함께 확보했습니다.”
