/// <reference lib="webworker" />
import type { WorkbenchDocument } from '../domain/schema'
import { checksumText } from './projectChecksum'
import { serializeDocument } from './projectPersistence'

self.addEventListener('message', async (event: MessageEvent<WorkbenchDocument>) => {
  try {
    const serializedDocument = serializeDocument(event.data)
    const checksum = await checksumText(serializedDocument)
    self.postMessage({ serializedDocument, checksum })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '프로젝트를 직렬화하지 못했습니다.' })
  }
})
