# Nimbalyst UI 비교 기록 (비활성)

이 문서는 초기 비교 실험의 출처 기록입니다. 2026-08-08부터 실행 UI는 `devtoys-shell.css`를 사용하며, `nimbalyst-shell.css`는 로드되지 않습니다.

## 원본

- 저장소: https://github.com/nimbalyst/nimbalyst
- 기준 커밋: `2e6237c8e8114eda32129f75df1b2a6b8aaf754c`
- 라이선스: MIT

## 이식 매핑

| Nimbalyst 원본 | 게임기획 스튜디오 적용 |
|---|---|
| `dark/theme.json` | 배경·표면·텍스트·테두리·파란 활성색 토큰 |
| `NavigationGutter.tsx` | 48px 왼쪽 도구 거터와 36px 버튼 |
| `TabBar.tsx` | 36px 탭 바, 30px 탭, 활성 탭 상단 2px 표시 |
| `WindowTopBar.tsx` | 38px 통합 창 상단 바와 Windows 창 제어 버튼 |
| `ProjectRail.css` | 거터 간격·상태 전환·툴팁/배지 규칙의 기준 |

## 제품 의미

- Nimbalyst의 프로젝트 전환 레일을 그대로 사용하지 않는다.
- 왼쪽 48px 거터는 현재 프로젝트에 추가한 전문 도구를 전환한다.
- 프로젝트 전환은 상단 선택기가 담당한다.
- 상단 탭은 도구가 아니라 실제 열린 작업과 문서를 나타낸다.
- 테이블과 패턴은 연결 가능하며 기획서 도구는 초기에는 독립적이다.

현재 UI 기준은 `docs/DEVTOYS_UI_PORT.md`입니다.
