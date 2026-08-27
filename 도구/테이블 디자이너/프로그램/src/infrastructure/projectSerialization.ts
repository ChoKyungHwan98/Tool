import type { WorkbenchDocument } from '../domain/schema'
import { checksumText } from './projectChecksum'
import { serializeDocument } from './projectPersistence'

export interface SerializedProjectRevision {
  readonly serializedDocument: string
  readonly checksum: string
}

export async function serializeProjectRevision(document: WorkbenchDocument): Promise<SerializedProjectRevision> {
  if (typeof Worker === 'undefined') {
    const serializedDocument = serializeDocument(document)
    return { serializedDocument, checksum: await checksumText(serializedDocument) }
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./projectSerializationWorker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.addEventListener('message', (event: MessageEvent<SerializedProjectRevision & { readonly error?: string }>) => {
      finish()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data)
    }, { once: true })
    worker.addEventListener('error', (event) => {
      finish()
      reject(new Error(event.message || '프로젝트 직렬화 Worker가 중단되었습니다.'))
    }, { once: true })
    worker.postMessage(document)
  })
}
