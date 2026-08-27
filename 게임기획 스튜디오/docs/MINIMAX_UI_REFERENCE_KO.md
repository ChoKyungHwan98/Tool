# MiniMax 공개 UI 레퍼런스 적용 기록

## 검토한 공식 자료

- MiniMax OpenRoom: <https://github.com/MiniMax-AI/OpenRoom>
  - 검토 커밋: `02468154c4d99f8925916425bf444d672454fb3d`
  - 검토 범위: `LICENSE`, `NOTICE`, `components/Shell`, `components/AppWindow`, `pages/Home`
- MiniMax frontend-dev Skill: <https://github.com/MiniMax-AI/skills/blob/main/skills/frontend-dev/SKILL.md>
  - 검토 커밋: `60aaae52bb2af8162732751a4332f62a5fef518b`
  - 검토 범위: 디자인 규칙, 금지 패턴, 품질 게이트

두 저장소 모두 MIT 라이선스다. 이 작업에서는 OpenRoom의 컴포넌트나 SCSS를 직접 복사하지 않고, 공개된 설계 원칙을 게임기획 스튜디오의 React/CSS 구조로 다시 구현했다.

## 적용한 원칙

- 큰 보라색 히어로와 같은 크기의 카드 격자를 제거했다.
- 밝은 중립 표면, 작은 글자 위계, 1px 구분선, 넓은 여백으로 정보 구조를 만든다.
- 도구가 많아질수록 카드를 추가하지 않고 고밀도 목록과 검색을 사용한다.
- 왼쪽 레일에는 안정적인 전역 목적지만 둔다. 도구 수가 늘어도 레일 항목은 늘지 않는다.
- 악센트는 아이콘의 작은 의미 색에만 사용하고 전체 화면을 지배하지 않는다.
- 모든 주요 버튼과 입력에는 키보드 포커스 링을 제공한다.

## 도구 100~500개를 위한 관리 모델

도구 등록 정보 한 벌을 세 화면이 함께 사용한다.

1. **도구 보관함**: 이름·설명·키워드 검색, 연결 방식과 업무 분류의 교차 필터
2. **작업공간 도구 추가**: 같은 검색 데이터에서 `작업공간 연결 가능`과 `독립 도구`를 분리
3. **작업공간 캔버스**: 연결 가능한 도구만 포트를 표시하고 독립 도구는 단독 노드로 유지

연결 방식은 `workspace.inputs/outputs` 유무로 자동 판정한다. 업무 분류는 다음 네 축을 우선순위로 사용한다.

- 데이터·밸런스
- 로직·전투
- 문서·발표
- AI·자동화

새 도구는 왼쪽 메뉴를 수정하지 않고 `ToolDefinition`만 등록한다. 분류가 늘어나도 미등록 분류는 목록 뒤에 자동으로 배치된다.

## 로컬 구현

- 분류·검색 모델: `ui/src/toolCatalog.ts`
- 도구 보관함·작업공간 목록: `ui/src/App.tsx`
- 작업공간 도구 추가: `ui/src/WorkspaceGraph.tsx`
- 화면 토큰·레이아웃: `ui/src/devtoys-shell.css`
- 단위 테스트: `ui/src/toolCatalog.test.ts`
- 상호작용·스크린샷 QA: `scripts/qa-catalog-ui.mjs`
