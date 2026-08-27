# 설계: 대화형 AI 작업 파트너 (OpenRouter)

> 작성 2026-07-20. 현재 "검토 전용" AI를 **대화하며 테이블을 함께 설계·생성하는 파트너**로 바꾼다.
> 관련: `SPEC_WORKSPACE_v1.md`(게이트 E, AI 정규화)

---

## 1. 지금 무엇이 잘못돼 있나 (코드 근거)

"안녕"이라고 쳐도 "스키마 구조를 검토하고 있습니다"가 뜨는 건 버그가 아니라 설계다.

| # | 문제 | 위치 |
|---|---|---|
| 1 | 무슨 입력이든 `"You are reviewing a game data schema. Return compact JSON only."`로 감싸서 전송 | `openRouterProvider.ts:162` |
| 2 | 로딩 문구가 하드코딩. 모델 동작과 무관하게 항상 같은 문장 | `AiAssistantPanel.tsx:212` |
| 3 | **대화 기록이 없음.** 매 요청 `role:'user'` 1개만 전송 → 다중 턴 불가 | `openRouterProvider.ts:205` |
| 4 | AI가 쓸 수 있는 명령이 `create_table`, `add_export_column` **2개뿐**. 행 삽입 어휘 없음 | `openRouterProvider.ts:302` |
| 5 | 행 데이터 전송이 정책상 throw | `openRouterProvider.ts:90`, `AGENTS.md` |

3번이 사용자가 원하는 "이렇게 할까요? → 그래 → 실행" 흐름을 구조적으로 막는 핵심이다.

## 2. 확정된 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 행 데이터 전송 | **20행 샘플, 요청별 옵트인** | AI가 기존 데이터 스타일을 맞추되 토큰·유출 위험 최소화 |
| 모델 정책 | **무료 기본 + 저가 유료 옵트인** | 평소 대화 0원, 도구 호출 때만 유료. 월 $1~3 예상 |
| 지출 통제 | **월 상한(기본 $10) 강제 + 요청 전 예상 비용 표시** | 사용자 예산 상한이 $10. 코드로 초과 불가하게 |
| 대량 행 생성 | **하이브리드**: AI는 규칙, 앱이 전개. 창의적 칸만 LLM | 1000행 기준 출력 토큰 약 130배 절감 |

## 3. 핵심 아이디어

**AI는 데이터를 직접 건드리지 않는다. Command를 제안할 뿐이다.**

이미 typed Command 엔진 + 변경 검토(승인 후 적용) + Undo/Redo가 있다. 이게 AI 에이전트에 필요한 안전한 쓰기 경로 그 자체다. AI 출력은 전부 이 게이트를 통과한다. 따라서:

- AI가 만든 변경도 **Undo 한 번으로 전부 롤백**된다.
- AI가 스키마를 **몰래 바꿀 수 없다**. 승인 전에는 아무것도 적용되지 않는다.
- "짜준 게 구조도로 바로 보인다"는 **자동으로 된다**. 캔버스가 스키마에서 파생되므로 Command 적용 즉시 반영된다.

## 4. 아키텍처: 4개 층

### 4.1 대화 층
- `messages: {role, content, toolCalls?}[]` 히스토리를 유지하고 스레드 전체를 전송.
- 시스템 프롬프트를 "게임 데이터 설계 파트너"로 교체. 도구 목록을 함께 선언.
- **tool calling** 사용 → 모델이 *그냥 대화*하거나 *도구 호출*을 선택. `response_format: json_object` 강제 해제.
- 로딩 문구 중립화("생각 중…"), 실제 말풍선 스레드 렌더.

### 4.2 도구 층 (도구 = Command 매핑)

**스키마 도구** — 기존 Command에 그대로 매핑:

| 도구 | Command |
|---|---|
| `create_table` | `CreateTableCommand` |
| `add_column` | `AddColumnCommand` |
| `rename_table` / `rename_column` | `RenameTableCommand` / `RenameColumnCommand` |
| `set_primary_key` | `ChangePrimaryKeyCommand` |
| `set_nullable` | `ChangeNullableCommand` |
| `add_relation` | `AddForeignKeyCommand` |
| `delete_*` | 기존 파괴적 Command (`approveDestructive` 필수) |

**데이터 도구** — 신규 Command 필요 (현재 행 편집은 Command를 안 거쳐서 Undo 불가):

| 도구 | 신규 Command |
|---|---|
| `insert_rows_by_rule` | `InsertRowsCommand` |
| `update_cells` | `UpdateCellsCommand` |

**대화 도구** — 변경 없음:
- `propose_plan(steps[])` → "이렇게 진행할까요?" 카드 렌더.

### 4.3 승인 층

tool call을 **즉시 실행하지 않는다.** 배치로 스테이징 → 제안 카드 렌더 → 승인 → 한 트랜잭션 적용.

제안 카드 구성:
- 요약 한 줄
- 영향: 테이블 N개 / 컬럼 M개 / 행 K개
- 미리보기: 스키마는 구조 diff, 행은 **앞 20행 표 + 총 건수**
- **검증 결과**: 스테이징 시점에 기존 validator를 돌려 "검증 통과" 또는 "경고 3건" 표시
- 버튼: `승인` `수정 요청` `취소`

채팅으로 "그래 그렇게 해"라고 해도 승인되게 한다(마지막 pending 제안에 한해 긍정 응답을 승인으로 해석). **단 파괴적 작업(삭제·머지)은 반드시 버튼 클릭을 요구한다.**

### 4.4 생성 층 (하이브리드)

`insert_rows_by_rule`이 받는 **생성 스펙**:

```json
{
  "tableId": "table_item",
  "idRange": { "column": "ItemId", "from": 10001, "to": 11000 },
  "fields": [
    { "column": "Name",   "mode": "llm_list", "prompt": "판타지 RPG 무기 이름", "sampleCount": 20 },
    { "column": "Tier",   "mode": "weighted", "values": ["일반","고급","희귀","영웅","전설"], "weights": [50,30,12,6,2] },
    { "column": "Attack", "mode": "formula",  "expression": "50 + index * 0.5 + tierBonus" },
    { "column": "Price",  "mode": "formula",  "expression": "Attack * 12" },
    { "column": "CategoryId", "mode": "reference", "targetTable": "table_category" }
  ]
}
```

필드 모드: `constant` / `sequence` / `formula` / `weighted` / `cycle` / `llm_list` / `reference`.

**핵심 안전 장치 — `reference` 모드.** FK 대상 테이블의 **실존 ID 중에서만** 앱이 고른다. 즉 LLM은 원시 ID를 절대 쓰지 않으므로 **참조 무결성을 깨뜨릴 수 없다.** 관계 무결성이 이 툴의 존재 이유인데, AI 생성이 그걸 위협하지 않게 구조로 막는다.

수식은 안전한 소형 평가기로 처리한다(`index`, 같은 행의 다른 컬럼, 등급 계수만 참조 가능. 임의 코드 실행 금지).

## 5. 두 시나리오 검증

### 시나리오 A — "아이템 10001~11000 알아서 채워줘"
1. 사용자 요청 → AI가 스키마(+옵트인 시 20행 샘플)를 보고 생성 스펙 초안 작성.
2. AI: "ItemId 10001~11000, 등급 분포 50/30/12/6/2, 공격력 = 50 + index×0.5 + 등급보정, 가격 = 공격력×12, 이름은 판타지 무기명으로. 이렇게 진행할까요?" + 앞 20행 미리보기.
3. 사용자 "그래 그렇게 해" → 앱이 로컬에서 1000행 결정론적 전개 → validator 통과 확인 → `InsertRowsCommand` 1개로 적용.
4. Undo 한 번에 1000행 전부 롤백.

**비용**: 출력 ~300토큰. 저가 모델 기준 1센트 미만.

### 시나리오 B — 빈 프로젝트에서 "이런 콘텐츠 테이블이 필요해"
1. AI가 정규화·확장성 관점으로 구조 제안(텍스트) + `create_table` × N, `add_relation` × M 도구 호출.
2. 제안 카드에 "테이블 5개, 관계 4개 생성" + 구조 미리보기.
3. 승인 → Command 배치 적용 → **구조도에 즉시 렌더**(캔버스가 스키마 파생이라 자동).

## 6. 비용 통제 설계

1. **모델 계층** — 잡담·질문은 무료 모델(0원). 도구 호출 필요 시에만 저가 유료로 승격(사용자 확인 1회). 대형 구조 설계만 중급 모델, 명시적 선택 시.
2. **요청 전 예상 비용 표시** — 카탈로그 API가 `pricing`을 주므로 실제 단가로 계산해 표시.
3. **월 상한** — 기본 $10. 도달 시 유료 호출 차단(코드 강제). 누적 사용량 표시.
4. **문맥 다이어트** — 전체 스키마 대신 관련 테이블 + FK 이웃만. 대화 기록은 최근 N턴 + 요약.

참고 단가(구간, 변동됨): 무료 $0 / 저가 요청당 ~0.2센트 / 중급 ~4센트 / 최상급 ~20센트.

## 7. 위험과 대응

| 위험 | 대응 |
|---|---|
| 무료 모델의 tool calling이 불안정 | 구조화 재시도 1회 → 실패 시 "제안 생성 실패"를 명시(조용히 깨지지 않게). 유료 승격 안내 |
| 대형 스키마가 문맥 초과 | 2단계: 테이블 인덱스만 먼저 → 필요한 테이블 상세를 모델이 요청 |
| 행 샘플 유출 | 옵트인 + 20행 상한 + 전송 전 무엇이 나가는지 표시 |
| AI가 파괴적 변경 제안 | 삭제·머지는 버튼 승인 강제, 채팅 긍정으로 승인 불가 |
| 1000행 생성 후 검증 실패 | 스테이징 단계에서 validator 실행, 경고를 카드에 표시하고 승인 여부는 사용자에게 |

## 8. 필요한 신규 구현 (기존에 없는 것)

- `InsertRowsCommand`, `UpdateCellsCommand` — **행 편집을 Command 체계로 편입.** 현재 `updateCell`/`addRow`는 Command를 안 거쳐 Undo가 안 된다.
- 생성 스펙 평가기(수식·분포·reference 전개).
- tool calling 요청/응답 처리 (기존은 단발 JSON).
- 대화 스레드 상태 + 말풍선 UI.
- 비용 추정·상한·누적 사용량.

## 9. 빌드 순서

| 게이트 | 내용 | 완료 기준 |
|---|---|---|
| **AI-1** | 대화 전환: 히스토리·시스템 프롬프트·중립 로딩·말풍선 | **"안녕"에 정상적인 대화 응답이 온다** |
| **AI-2** | 도구 호출 → 스키마 Command + 승인 카드 | 시나리오 B가 동작 |
| **AI-3** | 행 Command 신설 + 하이브리드 생성기 + 미리보기 | 시나리오 A가 동작 |
| **AI-4** | 비용 계층·상한·예상 비용·문맥 다이어트 | 월 $10 초과가 불가능 |

AI-1만으로도 지금의 즉각적인 불만("무슨 말을 해도 검토 답변")이 해소된다.
