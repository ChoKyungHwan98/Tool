# 게임기획 스튜디오 — 작업 전에 읽을 것

이 파일은 **탐색 비용을 줄이려고** 있다. 아래에 답이 있는 것은 다시 찾지 말 것.

## 구조

```
게임기획 스튜디오\              <- 배포 루트 (git 없음. 조립 폴더)
├─ 게임기획 스튜디오.exe         <- 실행 파일
├─ 게임기획 스튜디오\            <- 본체 (git 있음)
│   ├─ native\                 C++ / WebView2 호스트
│   ├─ ui\src\                 스튜디오 셸 React
│   ├─ app\assets\ui\          실행 시 읽는 배포 UI (빌드가 생성. 직접 고치지 말 것)
│   └─ scripts\build.ps1       빌드
└─ 도구\
    ├─ 테이블 디자이너\프로그램\      React + Tauri (git 있음)
    ├─ 패턴 디자이너\               React (git 있음)
    ├─ PPT 디자이너\game-ppt-designer-next\   pnpm 모노레포 (git 있음)
    └─ AI 리뷰데이터 분석\프로그램\   FastAPI + 정적 HTML (git 있음)
```

각 도구의 `프로젝트` 폴더는 **사용자 데이터**다. 코드가 아니다.

## 빌드 — 전체를 돌리지 말 것

전체는 약 66초, 부분은 약 8초다.

```powershell
# 한 군데만 고쳤을 때 (기본으로 이것을 쓴다)
.\scripts\build.ps1 -Only table -SkipTests

# 대상: shell | table | pattern | deck | review | native | all
.\scripts\build.ps1 -Only shell,native
```

`-Only`가 무엇이든 배포 단계(`app/assets/ui` 갱신, 루트 exe 복사)는 항상 돈다.
**합치기 전 한 번은 전체 빌드**를 돌린다.

빌드는 백그라운드로 돌리고 **완료 알림만 기다린다. 중간에 들여다보지 말 것.**
확인 한 번이 대화 전체를 다시 읽는 비용이다.

## 화면을 고칠 때

> **새 도구를 만들거나 도구 홈을 고치기 전에 반드시** `게임기획 스튜디오\SHARED_PRODUCT_UI_GUIDELINE.md`의
> 「⚠ 홈 레이아웃은 모든 도구가 똑같다」와 「글자 기준 — 모든 화면」을 읽는다.
> 마우스 사이드 버튼·스튜디오 `←` 계약(「⚠ 스튜디오와 도구 사이의 뒤로가기 계약」)도 모든 도구 필수다.
> 기준 화면은 AI 리뷰데이터 분석 홈이다. 색·글자뿐 아니라 **배치(사이드바·제목·본문 시작 위치)까지** 같아야 한다.


홈 화면 규칙은 `게임기획 스튜디오\SHARED_PRODUCT_UI_GUIDELINE.md`에 있다.
색·글자·간격·검색창·버튼 규격과 프로젝트 홈 상호작용 계약이 전부 거기 있다. 먼저 읽을 것.
글자 기준(글꼴 1개, 크기 12·13·14·15·16·18·20·24px…, 굵기 400~700)은 홈뿐 아니라 **모든 화면**에 적용되고 빌드가 자동 검사한다.

프로젝트 홈은 **세 벌**로 따로 구현되어 있다. 하나를 고치면 나머지도 봐야 한다.

- `게임기획 스튜디오\ui\src\ProjectLauncher.tsx` (스튜디오 홈)
- `도구\PPT 디자이너\...\apps\workbench\src\ProjectHomeLauncher.tsx`
- `도구\AI 리뷰데이터 분석\프로그램\static\index.html` (삭제만. 폴더 없음)

테이블 디자이너 홈은 목록형이다. 카드 그리드로 바꾸지 말 것.

## 이미 겪은 함정 (다시 겪지 말 것)

| 증상 | 원인 |
| --- | --- |
| 도구 화면을 고쳤는데 스튜디오에 반영 안 됨 | 그 도구가 자체 서버로 HTML을 주면 `Cache-Control: no-cache`가 필요 |
| 삭제 버튼을 눌러도 아무 일 없음 | 서버 CORS `Access-Control-Allow-Methods`에 `DELETE` 누락 + `fetch`에 try 없음 |
| 우클릭 메뉴가 안 열림 | WebView2가 기본 메뉴를 끔. `contextmenu`와 오른쪽 `pointerdown` 양쪽에서 열 것 |
| `도구` 폴더를 옮긴 뒤 PPT 디자이너가 죽음 | pnpm 링크가 절대경로. 해당 폴더에서 `pnpm install --offline` |
| bash heredoc의 한글이 깨짐 | cp949. 파이썬 스크립트를 파일로 써서 실행할 것 |
| `.ps1`을 `powershell`로 실행하면 한글 깨짐 | UTF-8을 cp949로 읽음. PowerShell 도구에서 직접 실행할 것 |
| `pnpm: not recognized` | PATH에 없음. `corepack pnpm` 사용 |
| 경로 오류가 마구 남 | 경로에 공백·한글. bash에서 반드시 따옴표로 감쌀 것 |
| 도구가 "제거 또는 삭제되었을 수 있습니다" | 배포 UI에 `tools/`가 없음. 도구 빌드는 `build\ui-tools`에 보관되고 배포 때 합쳐진다. 비었으면 해당 도구를 `-Only`로 빌드 |
| 도구 스크립트 안에서 `pnpm` 못 찾음 | `build.ps1`이 `build\bin\pnpm.cmd`(corepack) 를 PATH에 붙여준다. 빌드 스크립트 밖에서 돌릴 땐 `corepack pnpm` |
| 빌드가 "글자 기준을 벗어난 곳" 으로 멈춤 | 글자 크기·굵기가 기준 밖. `SHARED_PRODUCT_UI_GUIDELINE.md` 「글자 기준 — 모든 화면」 참고 |

## 건드리지 말 것

- `app\assets\ui\` — 빌드 산출물이다
- `.env` — API 키가 들어 있다. 커밋 금지
- 각 도구의 `프로젝트\` — 사용자 데이터다
- `productName` (테이블 디자이너 tauri.conf.json) — 앱 데이터 폴더 경로가 바뀐다

## 작업 방식

- 파일을 통째로 읽기 전에 `git diff`로 충분한지 먼저 볼 것
- 같은 것을 두 번 조사하지 말 것. 모르면 이 파일에 추가할 것
- 되돌릴 수 없는 삭제 전에는 먼저 커밋하거나 `바탕화면\게임기획\_보관`으로 옮길 것
