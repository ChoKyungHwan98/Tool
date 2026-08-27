/// <reference lib="webworker" />
import { buildIntegratedWorkbook, type WorkbookExportOptions } from './workbookExport'
import type { WorkbenchDocument } from '../domain/schema'

self.addEventListener('message', async (event: MessageEvent<{ document: WorkbenchDocument; options: WorkbookExportOptions }>) => {
  try {
    const result = await buildIntegratedWorkbook(event.data.document, event.data.options)
    self.postMessage({ ok: true, bytes: result.bytes, manifest: result.manifest }, { transfer: [result.bytes.buffer] })
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : '통합 Excel 생성에 실패했습니다.' })
  }
})
