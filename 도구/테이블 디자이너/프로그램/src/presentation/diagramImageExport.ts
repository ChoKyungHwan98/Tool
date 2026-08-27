export const EXPORT_PADDING = 48
export const EXPORT_PIXEL_RATIO = 2
const MAX_OUTPUT_EDGE = 16_000
const EXCLUDED_CLASSES = [
  'react-flow__minimap',
  'react-flow__controls',
  'react-flow__background',
  'react-flow__panel',
] as const

export function diagramImageFileName(projectName: string, now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const safeName = projectName.trim().replace(/[\\/:*?"<>|]/g, '_') || '프로젝트'
  return `${safeName}-구조도-${year}${month}${day}.png`
}

// 캡처 대상은 .react-flow__viewport 하위지만, 혹시 포함될 수 있는 오버레이
// 요소들을 이중 안전망으로 걸러 순수한 노드·엣지만 남긴다.
export function exportCaptureFilter(node: unknown): boolean {
  if (!(node instanceof Element)) return true
  return !EXCLUDED_CLASSES.some((className) => node.classList.contains(className))
}

export interface ExportBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ExportTransform {
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly transform: string
}

export function computeExportTransform(
  bounds: ExportBounds,
  padding = EXPORT_PADDING,
  pixelRatio = EXPORT_PIXEL_RATIO,
): ExportTransform {
  const width = Math.ceil(bounds.width + padding * 2)
  const height = Math.ceil(bounds.height + padding * 2)
  const longestEdge = Math.max(width, height)
  const boundedRatio = longestEdge * pixelRatio > MAX_OUTPUT_EDGE
    ? Math.max(1, Math.floor((MAX_OUTPUT_EDGE / longestEdge) * 100) / 100)
    : pixelRatio

  return {
    width,
    height,
    pixelRatio: boundedRatio,
    transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)`,
  }
}
