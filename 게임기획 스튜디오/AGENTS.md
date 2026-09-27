# 게임 기획 스튜디오 작업 필수 지침

게임 기획 스튜디오에 새 도구를 추가하거나 기존 도구의 화면·탐색·임베딩 방식을 수정하기 전에 반드시 `docs/TOOL_UI_INTEGRATION_GUIDELINES.md` 전체를 읽는다.

새 도구를 등록할 때는 다음 두 작업이 완료되지 않으면 빌드가 통과해서는 안 된다.

1. `docs/TOOL_UI_INTEGRATION_GUIDELINES.md`의 체크리스트를 적용한다.
2. 적용을 확인한 뒤 `docs/tool-guideline-ack.json`의 `acknowledgedTools`에 도구 ID를 추가한다.

프로젝트 홈의 배열·우클릭 삭제·폴더 기능을 우회하는 별도 프로젝트 런처를 만들지 않는다. 모든 도구의 프로젝트는 동일한 프로젝트 홈 규칙을 사용한다.
