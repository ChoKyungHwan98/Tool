# Unity 콘텐츠 구현 인계

## 범위

이번 인계는 CASE 콘텐츠 화면과 시나리오 재생까지만 대상으로 한다. 전투 로직·보스·HFSM은 구현하지 않는다.

## 로딩 순서

1. `AstraeCase001MasterData.json`을 읽고 각 테이블을 `id` 기준 Dictionary로 만든다.
2. CaseTable을 목록에 표시하고 CaseUnlockTable에서 같은 caseId의 조건을 모두 검사한다.
3. 수임 후 CaseFlowTable을 sequence 순서대로 진행한다.
4. SCENARIO이면 해당 caseFlowId의 ScenarioCommandTable을 sequence 순서대로 실행한다.
5. BATTLE이면 해당 caseFlowId의 CaseDifficultyTable로 버튼을 만든다.
6. `isImplemented=false`인 쉬움·어려움 버튼은 클릭 시 `미구현` 안내만 표시한다.
7. `isImplemented=true`인 보통만 전투에 진입시키고, 클리어 시 CaseRewardTable의 GOLD 2를 지급한다.

## 기존 Unity 고정값 교체 대상

- 제목·개요·쟁점 → CaseTable
- 고정된 화면 진행 분기 → CaseFlowTable
- 고정 화자·대사·이미지 → ScenarioCommandTable
- 고정 난이도 배열 → CaseDifficultyTable
- 난이도 구현 여부 → CaseDifficultyTable.isImplemented
- 난이도별 가보상 → CaseRewardTable

## 리소스 키 연결

- `MAMIYA_RITSU_STANDING` → 확정 원본 `C:/Users/Admin/Downloads/새 폴더 (3)/새 폴더/캐릭터-스탠딩-공식작화-리빌드.jpg`
- Unity 구현 시 위 원본을 프로젝트 Assets로 복사하고 Addressables 또는 리소스 Dictionary에 같은 키로 등록한다.
- `01.png`~`05.png`와 긴 영문 파일명의 이미지는 NovelAI 후보이므로 정본 키에 등록하지 않는다.

## Runtime 저장 분리

정적 테이블에 상태를 쓰지 않는다. Unity Save 영역에 별도 `CaseProgress`를 둔다.

`caseId / state(LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED) / currentFlowId / isArchived`

`MAIN_STORY_UNLOCK`은 메인 스토리 시스템의 CASE 콘텐츠 개방 Boolean을 확인한다. 정확한 연동 API는 Unity 구현 단계에서 결정한다.
