import { useCallback, useState } from 'react'

const STORAGE_KEY = 'gsw.dashboard.favorites'

function readFavorites(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeFavorites(favoriteIds: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favoriteIds]))
  } catch {
    // localStorage에 접근할 수 없으면 즐겨찾기는 이번 세션에서만 유지된다.
  }
}

export function useFavoriteProjects() {
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(() => readFavorites())

  const toggleFavorite = useCallback((projectId: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      writeFavorites(next)
      return next
    })
  }, [])

  return { favoriteIds, toggleFavorite }
}
