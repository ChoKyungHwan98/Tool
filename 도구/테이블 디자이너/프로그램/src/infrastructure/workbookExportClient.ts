import { renderDeterministicDiagramSvg, type WorkbookExportManifest, type WorkbookExportOptions } from '../application/workbookExport'
import type { WorkbenchDocument } from '../domain/schema'

interface WorkerResponse {
  readonly ok: boolean
  readonly bytes?: Uint8Array
  readonly manifest?: WorkbookExportManifest
  readonly error?: string
}

async function svgToPngDataUrl(svg: string): Promise<{ readonly dataUrl: string; readonly aspectRatio: number } | undefined> {
  if (typeof document === 'undefined') return undefined
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth * 2
        canvas.height = image.naturalHeight * 2
        const context = canvas.getContext('2d')
        if (!context) throw new Error('구조도 이미지를 그릴 수 없습니다.')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve({ dataUrl: canvas.toDataURL('image/png'), aspectRatio: image.naturalWidth / image.naturalHeight })
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('구조도 이미지를 생성하지 못했습니다.'))
    }
    image.src = url
  })
}

export async function exportIntegratedWorkbook(documentValue: WorkbenchDocument): Promise<WorkbookExportManifest> {
  const diagram = await svgToPngDataUrl(await renderDeterministicDiagramSvg(documentValue.schema))
  const options: WorkbookExportOptions = {
    includeDiagram: true,
    includeData: true,
    diagramPngDataUrl: diagram?.dataUrl,
    diagramAspectRatio: diagram?.aspectRatio,
  }
  const worker = new Worker(new URL('../application/workbookExportWorker.ts', import.meta.url), { type: 'module' })
  const response = await new Promise<WorkerResponse>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => resolve(event.data), { once: true })
    worker.addEventListener('error', () => reject(new Error('Excel Worker 실행에 실패했습니다.')), { once: true })
    worker.postMessage({ document: documentValue, options })
  }).finally(() => worker.terminate())
  if (!response.ok || !response.bytes || !response.manifest) throw new Error(response.error ?? '통합 Excel 생성에 실패했습니다.')
  const blob = new Blob([response.bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = response.manifest.fileName
  link.click()
  URL.revokeObjectURL(url)
  return response.manifest
}
