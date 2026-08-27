# 아스트라에 오라티오 CASE_001 콘텐츠 데이터

디나미스원 「아스트라에 오라티오」 시스템 기획자 지원용으로 제작한 CASE형 서브 콘텐츠 데이터 Vertical Slice다.

## 이번 범위

- 포함: CASE 목록·상세, 해금 조건, 진행 순서, 시나리오 대사·연출, 난이도 선택, 난이도별 보상 연결
- 제외: 전투 수치, 보스, HFSM, 스킬, 경제 밸런스, 서버 저장 구조, 로컬라이징
- 실제 제작 데이터: CASE_001 「결투재판 효력분쟁」 1건

## 정본과 Unity 입력

- Authoring 정본: `Astrae-Oratio-CASE001.gsw`
- Unity 권장 입력: `export/json/AstraeCase001MasterData.json`
- 테이블별 확인/부분 로딩: `export/csv/*.csv` 또는 `export/json/*.json`
- Unity 인계 규칙: `UNITY_CONTENT_HANDOFF.md`
- 테이블별 면접 설명: `CONTENT_DATA_GUIDE.md`

## 6개 테이블 원칙

- 실제로 여러 행이 반복되는 해금 조건·진행 단계·시나리오 명령·난이도·보상만 분리한다.
- 이름만 관리하던 ScenarioTable, DifficultyTable, RewardGroupTable은 제거했다.
- 시나리오 등장인물은 ScenarioCommandTable에서 관리하므로 CaseParticipantTable은 제거했다.
- 모든 테이블은 첫 열 `id`를 숫자형 단일 PK로 사용하고, FK도 대상의 숫자 `id` 한 열만 참조한다.
- CASE 진행 상태는 Master Data와 섞지 않고 Unity Save의 `CaseProgress`에서 관리한다.

## 확정하지 않은 정보

- `MAIN_STORY_UNLOCK`: 외부 메인 스토리 시스템이 CASE 콘텐츠 개방 여부를 전달하는 조건이며, 미확정 Chapter/Quest 코드는 만들지 않았다.
- `ScenarioCommandTable.text`: 구체적인 도입·종료 시나리오가 미정이므로 각각 `(미정)`으로 표시했다.
- `CaseRewardTable`: 기능 확인용 가데이터로 쉬움·보통·어려움에 GOLD 1·2·3을 각각 연결했다. 실제 경제 밸런스 값은 아니다.
- `CaseFlowTable`의 BATTLE 행은 콘텐츠 순서만 보존한다. 실제 전투 연결은 전투 프로젝트 착수 후 추가한다.
