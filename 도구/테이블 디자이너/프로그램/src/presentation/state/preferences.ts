/**
 * 기기별 작업 설정. 프로젝트 파일에는 넣지 않는다.
 * 첫 열 PK: 게임 테이블의 첫 컬럼은 Index(ID)로 둔다는 실무 규칙을 기본으로 따른다.
 */
const FIRST_COLUMN_PK_KEY = 'gsw-first-column-pk'

export function readFirstColumnPrimaryKey(): boolean {
  try {
    return window.localStorage.getItem(FIRST_COLUMN_PK_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeFirstColumnPrimaryKey(on: boolean): void {
  try {
    window.localStorage.setItem(FIRST_COLUMN_PK_KEY, on ? 'on' : 'off')
  } catch {
    // 저장 공간을 못 쓰면 이번 실행에서만 적용된다.
  }
}
