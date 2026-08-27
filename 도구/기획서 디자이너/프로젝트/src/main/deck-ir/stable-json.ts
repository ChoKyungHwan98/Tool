import crypto from 'crypto'

const sortRecursively = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortRecursively)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortRecursively(item)])
  )
}

export const stableStringify = (value: unknown): string => JSON.stringify(sortRecursively(value))

export const sha256Text = (value: string): string =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex')
