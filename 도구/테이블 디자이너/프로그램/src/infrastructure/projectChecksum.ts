import { serializeDocument } from './projectPersistence'
import type { WorkbenchDocument } from '../domain/schema'

export async function checksumDocument(document: WorkbenchDocument): Promise<string> {
  return checksumText(serializeDocument(document))
}

export async function checksumText(text: string): Promise<string> {

  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
  }

  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
