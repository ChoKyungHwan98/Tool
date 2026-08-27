# DevToys UI 이식 기준

게임기획 스튜디오의 현재 셸은 DevToys 2의 Windows UI 구조를 기준으로 한다. 단순 색상 모사가 아니라 실제 GitHub 소스의 내비게이션 수치, Fluent 토큰, 도구 그리드 밀도를 제품 흐름에 맞게 이식한 것이다.

## 원본

- 저장소: https://github.com/DevToys-app/DevToys
- 기준 커밋: `7e12df8448aa1f6aec4a8736b3e06a1c90530715`
- 라이선스: MIT

## 이식 매핑

| DevToys 원본 | 게임기획 스튜디오 적용 |
|---|---|
| `NavBar.razor.scss` | 49px 접힘/320px 펼침 탐색 패널, 48px 상단 영역, 우측 작업 표면의 8px 라운드 |
| `NavBarItem.razor.scss` | 아이콘 16px, 항목 간격, 선택 상태의 왼쪽 악센트 표시 |
| `windows/dark.scss` | 텍스트 투명도, 컨트롤/카드/호버 표면, 4px 컨트롤·8px 오버레이 라운드, 파란 악센트 |
| `GridView.razor.scss` | 12px 간격의 반응형 도구 카드 묶음 |
| `ToolGroup.razor.scss` | 40px 작업 페이지 여백과 134px 도구 카드 밀도 |
| `dark-theme-tile.png` | 프로젝트·라이브러리 히어로의 실제 반복 패턴 자산 |

## 제품에 맞춘 차이

- DevToys의 도구 분류는 현재 프로젝트에 추가한 도구 목록으로 바꾼다.
- 프로젝트 전환은 상단 선택기가 담당한다.
- 상단 탭은 실제 열어 둔 프로젝트 홈·도구·연결 지도를 복원한다.
- 도구 검색은 현재 프로젝트의 도구를 필터링한다.
- 테이블과 패턴의 연결 지도는 독립 기능으로 유지한다.
- 왼쪽 탐색을 접으면 49px 아이콘 모드가 되고, 도구 작업에서는 집중 모드로 사용할 수 있다.

## 실행 파일

실행 UI는 `ui/src/main.tsx`에서 `ui/src/devtoys-shell.css`를 로드한다. `ui/src/nimbalyst-shell.css`는 초기 비교 기록이며 실행 번들에 포함하지 않는다.
