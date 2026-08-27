import { Clock3, Database, Sparkles, Star, Trash2, type LucideIcon } from 'lucide-react'

export type DashboardSection = 'all' | 'recent' | 'favorites' | 'trash' | 'examples'

export interface RailBadgeContext {
  readonly totalCount: number
  readonly favoriteCount: number
  readonly trashCount: number
}

export interface RailItem {
  readonly id: DashboardSection
  readonly label: string
  readonly icon: LucideIcon
  readonly group: 'library' | 'resource'
  readonly badge?: (context: RailBadgeContext) => number | undefined
}

// 여기에 항목을 추가하는 것이 새 워크벤치 모듈을 셸에 붙이는 유일한 지점이다.
export const RAIL_ITEMS: readonly RailItem[] = [
  { id: 'all', label: '전체 프로젝트', icon: Database, group: 'library', badge: (context) => context.totalCount },
  { id: 'recent', label: '최근 작업', icon: Clock3, group: 'library' },
  { id: 'favorites', label: '즐겨찾기', icon: Star, group: 'library', badge: (context) => context.favoriteCount || undefined },
  { id: 'trash', label: '휴지통', icon: Trash2, group: 'library', badge: (context) => context.trashCount || undefined },
  { id: 'examples', label: '예제', icon: Sparkles, group: 'resource' },
]
