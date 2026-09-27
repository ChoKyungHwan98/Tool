# 게임기획 스튜디오

> 새 도구를 추가하거나 도구 UI·탐색을 수정하기 전에는 반드시 [`docs/TOOL_UI_INTEGRATION_GUIDELINES.md`](docs/TOOL_UI_INTEGRATION_GUIDELINES.md)를 읽고 적용해야 합니다. 빌드 과정에서 도구별 확인 등록을 검사합니다.

여러 게임기획 전문 도구를 프로젝트 단위로 추가하고 연결하는 Windows 데스크톱 워크벤치입니다.

## 현재 구현 범위

- 프로젝트 생성과 최근 프로젝트 복원
- 전체 도구 보관함과 도구별 독립 작업
- 작업공간 안에서 사용하는 상단 작업 탭
- 테이블·패턴·PPT 디자이너를 같은 창의 도구 화면으로 임베드
- 자유 원고에서 근거 인벤토리·슬라이드 주장·디자인 방향·레이아웃 후보 생성
- 16:9 슬라이드 미리보기, 장별 글자 크기·밀도, 이미지 슬롯 편집
- API 없이 PPTX·Word와 무결성·Office 패키지 사전검사 보고서 출력
- 선택형 OpenRouter 제안, Windows 자격 증명 저장, 월·요청별 비용 안전장치
- 테이블·패턴 자료를 명시적으로 참조해 편집 가능한 PPT 벡터 도판으로 삽입
- 작업공간 네이티브 저장, revision 충돌 처리와 최근 20개 백업
- 작업공간에서 열린 도구 탭과 마지막 선택 상태 복원
- AI 리뷰데이터 분석을 같은 작업공간 도구로 실행하고 리뷰 인사이트를 PPT 디자이너로 연결
- Prombot 방식의 시작·포함/제외·본문·끝·네거티브 프롬프트 조합과 프리셋 저장
- 프롬프트 사용 기록은 프로세스 메모리에만 유지해 X로 숨기면 남고 완전 종료하면 삭제
- X 버튼으로 트레이 숨김, 트레이 메뉴에서 완전 종료
- localhost 없는 C++20 + WebView2 독립 실행

## 기술 구조

- 호스트: C++20 / Win32 / WebView2
- 화면: React 19 / TypeScript / Vite
- 데이터: 각 작업공간의 `project.gds.json` + `artifacts` 저장소 + 로컬 프로젝트 레지스트리
- 리뷰 분석 데이터: `도구\AI 리뷰데이터 분석\프로젝트\<Steam App ID>` 단일 저장소 안에 프로젝트별 폴더링
- 배포 UI: `게임기획 스튜디오/app/assets/ui`에서 직접 로드하며 HTTP 서버를 사용하지 않음
- 기획서 엔진: 독립 V1 문서 디자인 엔진 호출 + 원문 보존 검사 + Teacher-guided 배치 + PNG/HTML/PDF/PPTX 출력

AI 리뷰데이터 분석은 예외적으로 Python 분석 서버를 스튜디오가 필요할 때 자동 실행합니다. 서버는 전용 주소 `127.0.0.1:8765`에만 바인딩하고, 소스는 `도구\AI 리뷰데이터 분석\프로그램`, 결과는 같은 도구의 `프로젝트` 폴더에만 저장합니다.

원본과 생성 파일의 경계, 화면 갱신 순서, 비사용 파일 정리 원칙은 [`docs/DEVELOPMENT_WORKFLOW_KO.md`](docs/DEVELOPMENT_WORKFLOW_KO.md)에 정리되어 있습니다. `ui/src`가 화면 원본이며 `ui/dist`와 `app/assets/ui`는 빌드 결과입니다.

## UI 기준

전문 도구의 어두운 편집 환경은 MIT 라이선스인 DevToys의 Windows 토큰을 사용합니다. 도구 보관함·작업공간 목록·연결 캔버스는 MiniMax의 공식 공개 자료인 OpenRoom과 frontend-dev Skill을 검토해 밝은 중립 표면, 1px 구분선, 고밀도 목록 중심으로 독립 구현했습니다. 도구가 늘어도 왼쪽 레일은 고정되고 검색·연결 방식·업무 분류로 찾습니다. Impeccable `4.3.1`은 개발 환경의 검토 보조 도구로만 사용하며 제품이나 저장소의 실행 의존성으로 넣지 않습니다. 출처와 결정 기록은 `docs/DEVTOYS_UI_PORT.md`, `docs/MINIMAX_UI_REFERENCE_KO.md`, `docs/DEVELOPMENT_WORKFLOW_KO.md`, `THIRD_PARTY_NOTICES.md`에 남깁니다.

## 폴더 구조

배포 루트에는 세 항목만 둡니다. 실행 파일이 자기 위치를 기준으로 `도구`와 UI를 찾기 때문에, 아래 배치를 바꾸면 도구 연결이 끊어집니다.

```
게임기획 스튜디오\                  <- 배포 루트
├─ 게임기획 스튜디오.exe             <- 실행 파일
├─ 게임기획 스튜디오\               <- 스튜디오 본체(소스·빌드·문서)
│   ├─ app\assets\ui               <- 실행 시 읽는 정적 UI
│   ├─ native, ui, cmake, scripts, docs, build
│   └─ CMakeLists.txt, README.md 등
└─ 도구\                            <- 전문 도구 전부
    ├─ AI 리뷰데이터 분석
    ├─ PPT 디자이너
    ├─ 테이블 디자이너
    └─ 패턴 디자이너
```

실행 파일이 참조하는 경로는 다음과 같습니다.

| 대상 | 경로 | 정의 위치 |
| --- | --- | --- |
| 정적 UI | `<exe 위치>\게임기획 스튜디오\app\assets\ui` | `native/main.cpp`의 `resolveUiDirectory` |
| 리뷰 분석 서버 | `<exe 위치>\도구\AI 리뷰데이터 분석\프로그램` | `native/main.cpp`의 `reviewAnalyticsProgramDirectory` |
| PPT 디자이너 서버 | `<exe 위치>\도구\PPT 디자이너\game-ppt-designer-next` | `native/main.cpp`의 `pptDesignerDirectory` |

### 버전 관리

배포 루트 자체는 저장소가 아닙니다. 조립 폴더이기 때문입니다. 대신 코드가 있는 곳마다 따로 git을 둡니다.

| 위치 | 저장소 |
| --- | --- |
| `게임기획 스튜디오/` | 있음 (로컬 전용) |
| `도구/테이블 디자이너/프로그램` | 있음 |
| `도구/패턴 디자이너` | 있음 |
| `도구/PPT 디자이너/game-ppt-designer-next` | 있음 |
| `도구/AI 리뷰데이터 분석/프로그램` | 있음 (로컬 전용) |

각 도구의 `프로젝트` 폴더는 사용자 데이터라 커밋하지 않습니다. `.env`에는 API 키가 들어가므로 `.gitignore`가 반드시 막아야 합니다.

### 스튜디오에 들어오지 않는 것

`game-ppt-designer-next`로 대체된 구버전 deck designer(oh-my-ppt 기반 Electron 앱)와 그 빌드 산출물은 `바탕화면/게임기획/_보관`으로 옮겼습니다. 스튜디오는 이 폴더를 참조하지 않습니다. 이력은 그 폴더의 git에 그대로 남아 있습니다.

`도구` 폴더를 다른 경로로 옮기면 PPT 디자이너의 pnpm 링크가 절대경로라 전부 끊어집니다. 옮긴 뒤에는 `도구\PPT 디자이너\game-ppt-designer-next`와 그 안의 `프로젝트`에서 각각 `pnpm install --offline`을 실행해 링크를 다시 만들어야 합니다.

## 빌드

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

전체 빌드는 약 45초가 걸립니다. 한 군데만 고쳤다면 그 부분만 다시 만드세요.

```powershell
# 테이블 디자이너 화면만 (약 8초)
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Only table -SkipTests

# 스튜디오 본체 UI와 실행 파일만
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Only shell,native
```

| 옵션 | 다시 만드는 대상 |
| --- | --- |
| `-Only shell` | 스튜디오 본체 UI (`ui/`) |
| `-Only table` | 테이블 디자이너 |
| `-Only pattern` | 패턴 디자이너 |
| `-Only deck` | PPT 디자이너 |
| `-Only review` | AI 리뷰데이터 분석 파이썬 문법 검사 |
| `-Only native` | C++ 실행 파일 |
| `-Only all` | 전부 (기본값) |
| `-SkipTests` | 테스트를 건너뜁니다. 화면만 고쳤을 때 씁니다 |

`-Only`를 무엇으로 주든 배포 단계(`app/assets/ui` 갱신, 루트 실행 파일 복사)는 항상 실행됩니다. 실행 파일이 아직 없는 상태라면 한 번은 `-Only native`나 전체 빌드가 필요합니다.

**합치기 전에 반드시 전체 빌드를 한 번 돌리세요.** 부분 빌드는 고치지 않은 도구의 이전 결과물을 그대로 씁니다.

빌드 과정에서 전문 도구의 스튜디오 전용 화면과 집중 테스트를 함께 실행합니다. 결과는 배포 루트(이 폴더의 상위)의 `게임기획 스튜디오.exe`이며, 실행에 필요한 정적 UI 파일은 이 프로젝트의 `app\assets\ui`에 폴더링됩니다.

프롬프트 도구의 출처 검토와 저장 경계는 `docs/PROMBOT_TOOL_PORT_KO.md`, UI 분류·확장 규칙은 `docs/MINIMAX_UI_REFERENCE_KO.md`, 1~5단계 구현 상세는 `docs/DECK_DESIGNER_PORT.md`, 상용 배포 전 판정 기준은 `docs/PRODUCT_READINESS_KO.md`를 참고하세요.
