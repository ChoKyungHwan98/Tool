# 게임 C PK/FK 구조도 QA

## 목적

PK와 FK가 첫 열에만 묶이지 않고 단일 키, 복합 키, 중간 테이블 관계를 구조도에서 읽을 수 있는지 확인한다.

## 예제 구조

- `ItemType.ItemTypeId` 단일 PK
- `Item.ItemId` 단일 PK
- `Item.ItemTypeId` FK → `ItemType.ItemTypeId`
- `Monster.MonsterId` 단일 PK
- `MonsterDrop.MonsterId + ItemId` 복합 PK
- `MonsterDrop.MonsterId` FK → `Monster.MonsterId`
- `MonsterDrop.ItemId` FK → `Item.ItemId`
- `Shop.ShopId` 단일 PK
- `ShopItem.ShopId + ItemId` 복합 PK
- `ShopItem.ShopId` FK → `Shop.ShopId`
- `ShopItem.ItemId` FK → `Item.ItemId`

`MonsterDrop`의 첫 열은 일반 열인 `DisplayOrder`이고, 두 번째와 세 번째 열이 복합 PK다. 따라서 A1이 항상 PK여야 한다는 제약이 없음을 검증한다.

## 확인 결과

- 전체 구조 화면에 6개 테이블과 5개 FK가 표시된다.
- 단일 PK는 `PK`, 참조되는 대상 키는 `REF`, 외래 키는 `FK`로 구분된다.
- `MonsterDrop`과 `ShopItem`은 `복합 PK` 카드로 표시되며 각 구성 열에 `PK·FK` 배지가 함께 표시된다.
- 관계선은 FK 열에서 대상 PK 열로 연결되고 선택 테이블의 직접 관계가 강조된다.
- 저장된 샘플 행은 FK 무결성과 복합 PK 중복 검증을 통과한다.

## 발견한 UX 문제

1. PK는 임의 열과 복합 열을 선택할 수 있지만 `테이블 설계 > 키와 관계`까지 이동해야만 설정 가능해 발견성이 낮다.
2. FK 생성 화면이 첫 대상 테이블과 첫 소스 열을 자동 선택해, 사용자가 의도하지 않은 관계를 만들기 쉽다.
3. 현재 연결 목록은 관계 이름만 표시하고 `소스 테이블.열 → 대상 테이블.열` 매핑을 보여주지 않는다.
4. 현재 연결 목록에서 FK를 수정하거나 삭제하는 명령이 노출되지 않는다.

다음 PK/FK 편집 Gate에서는 빈 선택으로 시작하는 단계형 매핑, 상세 연결 목록, 삭제와 재연결 동선을 우선 검토한다.

## 증거

- 구조도: `design/screenshots/game-c-pk-fk-example.png`
- 도메인 검증: `src/domain/gameCSampleProject.test.ts`
- 화면 회귀: `e2e/game-c-schema-example.spec.ts`
- 실제 OpenRouter 요청은 실행하지 않았다.
