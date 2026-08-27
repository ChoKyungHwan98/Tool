# 그리드 엑셀식 드래그 조작 설계

- 날짜: 2026-07-20
- 대상: 테이블 편집 화면(`DataGridView`)의 마우스 드래그 조작
- 상태: 승인됨

## 배경

테이블 편집 그리드는 이미 엑셀의 상당 부분을 구현하고 있다. A·B·C 열 문자, 1·2·3 행 번호,
하단 시트 탭, 키보드 이동, 타이핑 편집, 복사·잘라내기·붙여넣기(탭 구분), Delete 지우기,
Ctrl+A, Ctrl+F/Ctrl+H, 열 너비 드래그, 열 순서 드래그, 아래 방향 자동 채우기, 정렬·필터·
열 고정·숨김이 이미 동작한다.

엑셀 대비 비어 있는 것은 "마우스로 움직이고 끄는" 기본 조작이다. 이 스펙은 그 조작들과
움직일 때의 조작감을 가져오는 것을 다룬다.

열마다 타입(int·float·enum·boolean·FK 등)이 정해져 있어 아무 칸이나 자유롭게 열리면 데이터가
깨진다. 따라서 "열 이름을 입력해야 새 열이 해금"되는 스키마 무결성 방식은 그대로 두고,
조작감만 엑셀식으로 맞춘다.

## 목표 (범위)

1. 드래그 범위 선택 — 셀을 누른 채 끌어 범위 선택
2. 선택 영역 드래그 이동 — 선택 테두리를 잡아 다른 위치로 값 이동
3. 행 드래그 순서 변경 — 행 번호를 끌어 행 순서 변경
4. 자동 채우기 방향 확장 — 위·아래·좌·우 + 핸들 더블클릭 자동 채움
5. 조작감 — 커서 변화, 드래그 고스트 프리뷰, 셀 스냅, 가장자리 자동 스크롤, 엑셀식 선택 테두리

## 비목표

- 스키마 무결성 완화(자유 셀 해금) — 하지 않는다.
- 수식·함수, 병합 셀, 다중 시트 동시 편집 — 범위 밖.
- 열을 드래그로 다른 테이블에 옮기기 — 범위 밖.

## 동작 명세

### 1. 드래그 범위 선택

- 데이터 셀 또는 스키마 셀(1행)에서 `pointerdown` → 앵커 지정, 포인터 캡처.
- `pointermove` → 포인터 좌표를 기하학적으로 행·열 인덱스로 환산해 포커스 갱신.
  가상 스크롤 때문에 화면 밖 셀은 DOM에 없으므로 `elementFromPoint`를 쓰지 않고,
  스크롤 오프셋 + 열 시작 좌표 + 행 높이로 직접 계산한다.
- 클릭과 구분: 포인터 이동이 임계값(약 4px)을 넘어야 드래그로 판정. 임계값 이내면 기존
  단일 선택(`onClick`) 유지.
- 뷰포트 가장자리(약 24px) 안으로 포인터가 들어오면 자동 스크롤.
- `pointerup` → 선택 확정, `selectionKind`는 `cell`.

### 2. 선택 영역 드래그 이동

- 선택 테두리 위에서 `pointerdown` → 이동 모드 진입. 테두리 판정은 활성 선택 범위의 바깥
  가장자리 몇 px 밴드로 한다(채우기 핸들과 겹치지 않게 핸들 우선).
- 드래그 중 반투명 고스트 프리뷰가 커서를 따라간다. 대상 위치는 드롭 시점에 확정.
- 드롭 시:
  1. `computeMoveTarget`으로 대상 범위 계산(격자 한계로 클램프).
  2. 대상 셀 전부를 기존 `cellInputError`로 검증.
  3. 하나라도 타입 불일치면 이동을 **차단하고 안내**(`gridError`). 붙여넣기와 동일한 정책.
  4. 통과하면 원본 셀을 비우고 대상 셀을 채우는 업데이트를 **한 커맨드**(`updateCells`)로
     실행 → undo 한 번에 원복.
- 제외 대상: 1행(스키마·열 이름), 추가행(append row), 추가열(append column)에는 이동으로
  값을 넣거나 이동 시작을 허용하지 않는다.
- 정렬·필터·검색이 걸린 상태에서도 값 이동 자체는 허용하되, 대상 행은 현재 뷰의 표시 순서
  기준으로 매핑한다(붙여넣기와 동일하게 `viewRowAt` 사용).

### 3. 행 드래그 순서 변경

- 행 번호 버튼에서 드래그 시작 → 행 사이에 삽입 위치 표시선 렌더.
- 드롭 → `moveRows(tableId, rowIds, targetIndex)` 호출.
- 새 도메인 트랜잭션 `MoveRowsCommand`: rows 배열에서 대상 행들을 뽑아 targetIndex에 재삽입.
  execute/undo 지원, 감사 로그 기록. `InsertRowsCommand`/`DeleteRowsCommand`와 같은 패턴.
- **정렬·필터·검색이 활성이면 비활성화**하고 이유를 안내한다. 파생된 뷰의 순서를 원본에
  적용하면 결과가 모호하기 때문. `moveColumn`(열 이동)과 대칭 구조.

### 4. 자동 채우기 방향 확장

- 채우기 핸들은 지금처럼 활성 선택의 우하단 모서리에 표시.
- 드래그 방향(위·아래·좌·우)을 감지해 `fillValuesDirectional`로 채운다. 내부적으로 기존
  `nextFillValues`(순열·증가 규칙)를 방향에 맞게 감싼다.
- 좌우 채우기는 대상 열들의 타입 검증을 통과해야 한다(불일치 시 차단+안내).
- 핸들 **더블클릭** → 바로 왼쪽(또는 인접) 열의 데이터가 채워진 마지막 행까지 아래로 자동 채움
  (`autofillExtent`).

### 5. 조작감

- 커서: 일반 셀 `default`, 선택 테두리 `move`, 채우기 핸들 `crosshair`(또는 `cell`).
- 드래그 이동 시 반투명 고스트 프리뷰 엘리먼트가 커서를 따라감.
- 셀 단위 스냅(이미 셀 격자 기반).
- 모든 드래그에서 가장자리 자동 스크롤 공유.
- 선택 영역은 엑셀식 굵은 테두리 유지(기존 스타일 활용).

## 코드 구조

`DataGridView.tsx`는 이미 1600줄로 크다. 새 조작의 판정 로직은 순수 함수로 분리해 단위
테스트하고, UI 핸들러만 컴포넌트에 둔다.

### 신규 순수 모듈

`src/presentation/gridDragOperations.ts` (신설) 또는 기존 `workbookGridOperations.ts`에 추가:

- `pointerToGridPosition(clientX, clientY, metrics)` — 포인터 좌표 → `{ rowIndex, columnIndex }`.
  가상 스크롤 대응의 핵심. 열 시작 좌표 배열·행 높이·스크롤 오프셋·행헤더/헤더 크기를 입력받음.
- `computeMoveTarget(sourceRange, dropPosition, bounds)` — 이동 대상 범위 계산 및 클램프.
- `moveUpdates(sourceCells, targetCells)` — 원본 비우기 + 대상 채우기 업데이트 목록 생성.
- `fillValuesDirectional(sourceValues, count, direction)` — `nextFillValues` 4방향 래퍼.
- `autofillExtent(neighborColumnValues)` — 더블클릭 채우기 범위 산출.
- `edgeAutoScroll(pointer, viewportRect)` — 가장자리 감지 시 스크롤 델타 산출(순수 계산부).

### 신규 도메인 / 애플리케이션

- `MoveRowsCommand` (`src/application/documentCommands.ts`) — rows 재정렬 트랜잭션.
- `moveRows(tableId, rowIds, targetIndex)` 스토어 액션 (`workbenchStore.ts`) — `moveColumn` 대칭.

### UI 계층 (`DataGridView.tsx`)

- 셀에 `onPointerDown` 추가 → 테두리 히트 여부로 드래그 선택/이동 분기.
- 행 번호에 드래그 순서 변경 핸들러 + 삽입 표시선.
- 채우기 핸들에 방향 감지 + `onDoubleClick`.
- 자동 스크롤·고스트 프리뷰·포인터 추적은 작은 훅 `useGridDrag`로 캡슐화(선택적).

### CSS

기존 스프레드시트 스타일 파일에 커서·고스트·삽입 표시선 규칙 추가.

## 테스트 (TDD)

### 단위

- `pointerToGridPosition` 좌표→인덱스 변환(스크롤·헤더 오프셋 포함).
- `computeMoveTarget` 클램프·경계.
- `moveUpdates` 원본 비우기 + 대상 채우기.
- 이동 검증 차단(타입 불일치 시 업데이트 없음).
- `fillValuesDirectional` 4방향.
- `autofillExtent` 인접 데이터 끝 판정.
- `MoveRowsCommand` execute/undo, 감사 로그.
- 기존 `workbookGridOperations.test.ts` · `documentCommands.test.ts` 옆에 배치.

### e2e (Playwright, `e2e/`)

- 드래그 범위 선택.
- 드래그 이동 성공 / 타입 차단.
- 행 재정렬(정렬 해제 상태) / 정렬 활성 시 비활성.
- 자동 채우기 4방향 및 더블클릭.
- 메모리 노트: React Flow/가상 스크롤 가시성 함정 — 백그라운드 탭이면 렌더 안 되므로 실제
  포그라운드에서 검증.

## 리스크와 대응

- **가상 스크롤 히트테스트**: `elementFromPoint` 대신 기하학적 좌표 계산으로 회피.
- **click vs drag 충돌**: pointer 이동 임계값(약 4px)으로 분리, 기존 `onClick` 유지.
- **성능**: `pointermove`는 `requestAnimationFrame`으로 throttle, 대량 이동은 단일 커맨드.
- **드래그 이동 vs 채우기 핸들 히트 겹침**: 핸들 영역을 우선 판정.

## 승인 후 다음 단계

writing-plans 스킬로 단계별 구현 계획을 작성한다.
