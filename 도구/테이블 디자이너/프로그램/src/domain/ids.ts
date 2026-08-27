import type { EntityId } from './schema'

export function makeId(prefix: string): EntityId {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

  return `${prefix}_${id}`
}
