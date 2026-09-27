# Project-centered Product UI (R7)

앱 첫 화면은 편집기가 아니라 프로젝트 목록이다. 홈에서 AI 학습과 모델 관리로 들어가고, 프로젝트 안에서는 기획서 모드와 발표 모드 중 작업 방식을 선택한다. 각 화면에서 전체 프로젝트로 돌아갈 수 있다. SlideIR, InformationPlan, CompositionPlan, RenderTree, Harness 같은 내부 이름은 일반 화면에 표시하지 않는다. 공통 글자·색·레이아웃 기준은 게임기획 툴 루트의 `SHARED_PRODUCT_UI_GUIDELINE.md`를 따른다.

기획서와 발표자료는 같은 Source/SlideIR을 공유하지만 각각 document/presentation mode로 Workbench를 연다. 실제 16:9 결과가 화면의 중심이며 원고, 후보 비교, 화면 검토, AI 사용 내역, 변경 기록은 필요할 때만 여는 surface다. 검토 결과가 없을 때 빈 오른쪽 panel을 계속 점유하지 않는다.

후보 비교는 Hard Gate를 통과해 반환된 실제 candidate만 표시한다. 한 개뿐이면 복제 후보를 만들지 않았다는 상태를 명확히 설명한다. Finding에 region 정보가 있으면 canvas 위 진입점과 검토 surface를 연결한다.
