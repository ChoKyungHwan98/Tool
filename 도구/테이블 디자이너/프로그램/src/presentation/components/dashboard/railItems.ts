import { Clock3, Database, Sparkles, Star, Trash2, type LucideIcon } from 'lucide-react'

export type DashboardSection = 'all' | 'recent' | 'favorites' | 'trash' | 'examples'

export interface RailItem {
  readonly id: DashboardSection
  readonly label: string
  readonly icon: LucideIcon
  readonly group: 'library' | 'resource'
}

// 여기에 항목을 추가하는 것이 새 워크벤치 모듈을 셸에 붙이는 유일한 지점이다.
// 홈 화면 디자인 지침에 따라 탐색 문구 뒤에 개수를 붙이지 않는다.
export const RAIL_ITEMS: readonly RailItem[] = [
  { id: 'all', label: '전체 프로젝트', icon: Database, group: 'library' },
  { id: 'recent', label: '최근 작업', icon: Clock3, group: 'library' },
  { id: 'favorites', label: '즐겨찾기', icon: Star, group: 'library' },
  { id: 'trash', label: '휴지통', icon: Trash2, group: 'library' },
  { id: 'examples', label: '예제', icon: Sparkles, group: 'resource' },
]
