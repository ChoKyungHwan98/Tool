# 외부 장표 후보 수집·사람 검토 V1

## 현재 구현

홈 화면의 `레퍼런스 관리`에서 다음 순서로 작업한다.

1. OpenRouter 키·모델 ID 또는 loopback 로컬 비전 모델 주소·ID를 설정한다.
2. OpenRouter web search로 공식 발표·개발사 자료와 공개 블로그·포트폴리오의 원본 페이지 후보를 찾거나 원본 페이지/이미지 URL을 직접 추가한다. 출처 유형은 후보에 기록한다.
3. 실제 공개 HTTPS 장표 이미지를 가져와 크기·품질·SHA-256을 측정한다. 로컬 또는 OpenRouter 비전 모델이 한 장의 정보 구조와 추상 Visual Grammar를 분석한다.
4. 원본 이미지와 분석·적용 조건·복제 금지 항목을 사용자가 보고 승인 또는 거절한다.
5. 승인된 후보만 기존 `ReferenceRecord`로 변환되어 production reference retrieval의 **보조 후보**가 된다. 발견/분석/거절 상태의 후보는 절대 검색 입력에 들어가지 않는다.

기존 Reference Engine의 `ReferenceRecord` 계약과 이미지 품질 분석을 재사용한다. 후보·판단 이력은 `workspace/references/candidates.v1.json`에 보존한다. 원본 이미지는 현재 파일로 캐시하거나 재배포하지 않는다.

## AI 연결

- 웹 후보 검색: OpenRouter의 `openrouter:web_search` server tool 사용. 현재 이 기능은 beta이므로 실패하거나 부정확한 URL이 나오면 직접 URL 추가로 계속할 수 있다.
- 장표 이미지 분석: OpenRouter 또는 OpenAI-compatible loopback 로컬 비전 모델. 실제 모델의 비전·JSON 처리 능력은 사용자 환경에서 확인해야 한다.
- OpenRouter 키: 서버 메모리에만 유지하고 파일·브라우저 storage·작업 artifact에 쓰지 않는다. 서버 재시작 시 환경 변수 `OPENROUTER_API_KEY` 또는 UI 재입력이 필요하다.
- 모델 설정: `OPENROUTER_REFERENCE_MODEL_ID`, `LOCAL_REFERENCE_ENDPOINT`, `LOCAL_REFERENCE_MODEL` 환경 변수 또는 홈 UI의 설정에서 지정한다.
- 로컬 모델은 앱이 설치·실행해 주지 않는다. 별도 비전 모델 서버가 loopback `/chat/completions` 주소에서 실행 중이어야 한다.

## 엄격한 구분

외부 장표 수집과 추상 원칙의 검색은 **모델 가중치 학습이 아니다**. 지금 구현된 R8 LoRA/QLoRA 학습은 우리가 만든 장표에 대한 명시적 사용자 판단으로 Visual Critic을 학습하는 별도 경로다. 수집한 외부 장표의 이미지나 AI의 자기평가를 R8 production dataset/Ready Positive로 자동 변환하지 않는다.

`원칙 승인`은 새 자료를 곧바로 `TeacherPageRecord`나 PatternFragment로 승격시키지 않는다. 현재는 얇은 검색 보조 Reference만 추가한다. 정식 Teacher가 되려면 기존 TeacherPageRecord 수준의 mapping, 출처·권리·복제 금지 검증, human curation이 별도로 필요하다. 현재 직접 장표 생성은 전후 비교·역할 구조 두 유형으로 제한된다.

권리 상태가 확인되지 않은 외부 자료는 `unknown`으로 기록한다. 분석과 추상 원칙 도출만 허용하며 원본 asset 재사용, 썸네일 캐시, 재배포, 원본 geometry/palette/IP 복제는 금지한다.

## 아직 검증되지 않은 것

- 현재 실행 환경에 OpenRouter 키와 로컬 비전 서버가 없어 실제 외부 장표에 대한 live AI 호출은 수행하지 않았다. 모의 응답을 이용한 계약·회귀 테스트만 통과했다.
- AI 검색 URL의 진위와 분석의 관찰 정확성은 사용자 검토가 필요하다. 모델 출력만으로 자동 승인하지 않는다.
- 승인된 보조 Reference가 실제 장표 미감을 개선한다는 품질 증거는 아직 없다.
- 사용자 피드백이 충분해질 때까지 로컬 품질 모델 학습을 시작하지 않는다.
