# 게임기획 스튜디오

여러 게임기획 전문 도구를 프로젝트 단위로 추가하고 연결하는 Windows 데스크톱 워크벤치입니다.

## 현재 구현 범위

- 프로젝트 생성과 최근 프로젝트 복원
- 전체 도구 보관함과 도구별 독립 작업
- 작업공간 안에서 사용하는 상단 작업 탭
- 테이블·패턴·기획서 디자이너를 같은 창의 도구 화면으로 임베드
- 자유 원고에서 근거 인벤토리·슬라이드 주장·디자인 방향·레이아웃 후보 생성
- 16:9 슬라이드 미리보기, 장별 글자 크기·밀도, 이미지 슬롯 편집
- API 없이 PPTX·Word와 무결성·Office 패키지 사전검사 보고서 출력
- 선택형 OpenRouter 제안, Windows 자격 증명 저장, 월·요청별 비용 안전장치
- 테이블·패턴 자료를 명시적으로 참조해 편집 가능한 PPT 벡터 도판으로 삽입
- 작업공간 네이티브 저장, revision 충돌 처리와 최근 20개 백업
- 작업공간에서 열린 도구 탭과 마지막 선택 상태 복원
- Prombot 방식의 시작·포함/제외·본문·끝·네거티브 프롬프트 조합과 프리셋 저장
- 프롬프트 사용 기록은 프로세스 메모리에만 유지해 X로 숨기면 남고 완전 종료하면 삭제
- X 버튼으로 트레이 숨김, 트레이 메뉴에서 완전 종료
- localhost 없는 C++20 + WebView2 독립 실행

## 기술 구조

- 호스트: C++20 / Win32 / WebView2
- 화면: React 19 / TypeScript / Vite
- 데이터: 각 프로젝트의 `project.gds.json` + `artifacts` 저장소 + 로컬 프로젝트 레지스트리
- 배포 UI: `게임기획 스튜디오/app/assets/ui`에서 직접 로드하며 HTTP 서버를 사용하지 않음
- 기획서 엔진: DeckIR + 콘텐츠 기반 디자인 방향 + 슬라이드별 레이아웃 후보

## UI 기준

전문 도구의 어두운 편집 환경은 MIT 라이선스인 DevToys의 Windows 토큰을 사용합니다. 도구 보관함·작업공간 목록·연결 캔버스는 MiniMax의 공식 공개 자료인 OpenRoom과 frontend-dev Skill을 검토해 밝은 중립 표면, 1px 구분선, 고밀도 목록 중심으로 독립 구현했습니다. 도구가 늘어도 왼쪽 레일은 고정되고 검색·연결 방식·업무 분류로 찾습니다. 출처와 결정 기록은 `docs/DEVTOYS_UI_PORT.md`, `docs/MINIMAX_UI_REFERENCE_KO.md`, `THIRD_PARTY_NOTICES.md`에 남깁니다.

## 빌드

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

빌드 과정에서 전문 도구의 스튜디오 전용 화면과 집중 테스트를 함께 실행합니다. 결과는 상위 `게임기획 툴` 폴더의 `게임기획 스튜디오.exe`이며, 실행에 필요한 정적 UI 파일은 이 프로젝트의 `app\assets\ui`에 폴더링됩니다.

프롬프트 도구의 출처 검토와 저장 경계는 `docs/PROMBOT_TOOL_PORT_KO.md`, UI 분류·확장 규칙은 `docs/MINIMAX_UI_REFERENCE_KO.md`, 1~5단계 구현 상세는 `docs/DECK_DESIGNER_PORT.md`, 상용 배포 전 판정 기준은 `docs/PRODUCT_READINESS_KO.md`를 참고하세요.
