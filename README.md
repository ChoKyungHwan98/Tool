# Tool

게임 기획 도구 전체를 한곳에서 파악하고 개발하기 위한 비공개 소스 모노레포입니다.

## 구조

실제 배포 폴더(`게임기획 스튜디오\`)와 같은 모양입니다. 루트의 `CLAUDE.md`가 작업 규칙·빌드·함정을 정리한 첫 문서입니다.

- `게임기획 스튜디오/`: 여러 도구를 같은 창에서 실행하고 연결하는 Windows 호스트
  - `native/`: C++20, Win32, WebView2 호스트 (프로젝트 저장, OpenRouter 키·예산, 다운로드 기록, 도구 대화 저장)
  - `ui/`: React 19 + TypeScript 셸 UI
  - `scripts/build.ps1`: 통합 빌드와 검증 진입점 (`-Only shell|table|pattern|deck|review|native`)
  - `SHARED_PRODUCT_UI_GUIDELINE.md`: 모든 도구가 따르는 화면·글자·뒤로가기 규칙 (빌드가 자동 검사)
- `도구/테이블 디자이너/프로그램/`: 게임 데이터 테이블 구조를 처음 만드는 도구 (AI 대화로 표·열·관계 생성)
- `도구/패턴 디자이너/`: 전투 패턴과 상태 흐름 설계 도구
- `도구/PPT 디자이너/game-ppt-designer-next/`: PPT·Word 기획서 생성 및 편집 도구
- AI 리뷰데이터 분석: 별도 저장소 [`Ai_review`](https://github.com/ChoKyungHwan98/Ai_review). 배포 폴더에서는 `도구/AI 리뷰데이터 분석/프로그램/`에 둡니다.

각 도구는 독립 실행이 가능하고, 스튜디오 빌드 시 전용 웹 화면으로 함께 묶입니다. 세부 규칙은 각 프로젝트의 `AGENTS.md`, `README.md`, `package.json`과 문서를 우선 확인하세요.

## 저장소 정책

이 저장소는 구조 이해와 소스 개발에 필요한 파일만 관리합니다. EXE, `node_modules`, `dist`, CMake/Rust 빌드 캐시, 데이터베이스, 로그와 로컬 인증정보는 의도적으로 제외합니다. 실행 파일은 소스에서 다시 빌드할 수 있습니다.

- 각 도구의 `프로젝트/` 폴더(사용자 데이터)는 넣지 않습니다.
- WebView2 설치 파일(`게임기획 스튜디오/redist/MicrosoftEdgeWebview2Setup.exe`)은 EXE라 넣지 않습니다. 배포할 때 https://go.microsoft.com/fwlink/p/?LinkId=2124703 에서 받아 같은 위치에 둡니다.
- `.env`(OpenRouter 키)는 절대 올리지 않습니다.
