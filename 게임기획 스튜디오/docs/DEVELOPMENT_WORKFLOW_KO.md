# 개발 구조와 갱신 절차

최종 갱신: 2026-09-25

## 기준 파일과 생성 파일

| 구분 | 경로 | 관리 원칙 |
| --- | --- | --- |
| 셸 화면 원본 | `ui/src` | 직접 수정하고 Git으로 관리합니다. |
| 도구 보관함 화면 | `ui/src/ToolCatalogHome.tsx`, `ui/src/catalog.css` | 보관함의 구조와 전용 표현만 둡니다. |
| 공통 셸 화면 | `ui/src/App.tsx`, `ui/src/devtoys-shell.css` | 탐색, 작업공간, 도구 공통 화면을 둡니다. |
| 네이티브 호스트 | `native` | Win32, WebView2, 저장소와 도구 실행을 담당합니다. |
| 웹 빌드 결과 | `ui/dist` | Vite가 생성합니다. 직접 수정하지 않습니다. |
| 실행용 화면 | `app/assets/ui` | 빌드 스크립트가 `ui/dist`에서 복사합니다. 직접 수정하지 않습니다. |
| 네이티브 빌드 결과 | `build` | CMake가 생성합니다. 직접 수정하거나 Git에 넣지 않습니다. |
| 배포 실행 파일 | 상위 폴더의 `게임기획 스튜디오.exe` | 빌드 스크립트가 최신 실행 파일을 복사합니다. |

화면을 고친 뒤 브라우저에서만 확인하면 배포 실행 파일에는 예전 화면이 남을 수 있습니다. 반드시 셸 빌드를 실행해 `app/assets/ui`까지 갱신합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Only shell
```

네이티브 코드도 바꿨다면 다음 명령을 사용합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Only shell,native
```

## 확인 순서

1. `ui`에서 `npm run check`
2. `ui`에서 `npm test -- --run`
3. `ui`에서 `npm run dev`를 실행한 뒤 `node scripts/qa-catalog-ui.mjs`로 도구 보관함의 검색, 필터, 화면 넘침을 확인
4. `scripts/build.ps1 -Only shell`로 실행용 화면 갱신
5. 상위 폴더의 `게임기획 스튜디오.exe`에서 최종 확인

## 비사용 파일 정리 원칙

- 실행 코드에서 불러오지 않고 문서에서도 참조하지 않는 비교용 화면과 캡처는 제거합니다.
- `ui/dist`, `app/assets/ui`, `build`처럼 다시 만들 수 있는 결과물은 원본으로 취급하지 않습니다.
- 사용자 프로젝트, 도구별 `프로젝트` 폴더, 환경 변수 파일과 자격 증명은 정리 대상에 포함하지 않습니다.
- 제3자 코드를 제거할 때는 `THIRD_PARTY_NOTICES.md`의 관련 고지도 함께 갱신합니다.

## Impeccable 사용 결정

Impeccable은 개인 Codex 환경에 정식 설치된 `4.3.1` 버전을 화면 검토 보조 도구로 사용합니다. 이 저장소에는 복사하거나 실행 의존성으로 추가하지 않습니다.

현재 방식이 적합한 이유는 다음과 같습니다.

- 프로그램 실행에는 Impeccable이 필요하지 않습니다.
- 한 저장소 안에 기술 문서와 검사 스크립트를 중복 보관하지 않습니다.
- 개인 설치본을 갱신하면 다른 화면 작업에도 같은 기준을 적용할 수 있습니다.

화면 변경 시에는 `impeccable doctor`로 환경과 프로젝트 지침을 확인하고, 마무리 단계에서 변경한 화면 파일만 검사합니다. 제품의 최종 기준은 [`TOOL_UI_INTEGRATION_GUIDELINES.md`](TOOL_UI_INTEGRATION_GUIDELINES.md)와 실제 화면 확인입니다.
