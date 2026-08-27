import { strFromU8, unzipSync } from 'fflate'
import { XMLValidator } from 'fast-xml-parser'
import type { DeckIrDocument } from '@shared/deck-ir'

export type OutputPreflightIssue = {
  severity: 'error' | 'warning'
  format: 'pptx' | 'docx'
  code: string
  message: string
  slideOrder?: number
}

export type OutputPreflightReport = {
  checkedAt: number
  pptxBytes: number
  docxBytes: number
  slideCount: number
  liveTextCount: number
  issues: OutputPreflightIssue[]
}

const required = (
  files: Record<string, Uint8Array>,
  names: string[],
  format: 'pptx' | 'docx',
  issues: OutputPreflightIssue[]
): void => {
  names.forEach((name) => {
    if (!files[name]) issues.push({ severity: 'error', format, code: 'OOXML_PART_MISSING', message: `${name}이 없습니다.` })
  })
}

const validXml = (
  files: Record<string, Uint8Array>,
  names: string[],
  format: 'pptx' | 'docx',
  issues: OutputPreflightIssue[]
): void => {
  names.forEach((name) => {
    const bytes = files[name]
    if (!bytes) return
    const result = XMLValidator.validate(strFromU8(bytes))
    if (result !== true) issues.push({ severity: 'error', format, code: 'OOXML_XML_INVALID', message: `${name}의 XML이 손상되었습니다.` })
  })
}

const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0

export const runOutputPreflight = async (document: DeckIrDocument): Promise<OutputPreflightReport> => {
  const [{ buildDeckIrPptxDocument }, { generatePptx }, { buildDeckIrDocxBytes }] = await Promise.all([
    import('../../src/main/io/deck-ir-export/pptx'),
    import('@arcsin1/html2pptx'),
    import('../../src/main/io/deck-ir-export/docx')
  ])
  const issues: OutputPreflightIssue[] = []
  const builtPptx = buildDeckIrPptxDocument(document)
  if (builtPptx.pptx.slideSize?.widthIn !== 13.333 || builtPptx.pptx.slideSize?.heightIn !== 7.5) {
    issues.push({ severity: 'error', format: 'pptx', code: 'SLIDE_SIZE', message: '슬라이드 크기가 16:9 13.333×7.5인치가 아닙니다.' })
  }
  builtPptx.pptx.slides.forEach((slide, index) => {
    const items = [...slide.texts, ...(slide.shapes || []), ...(slide.images || []), ...(slide.tables || [])]
    items.forEach((item) => {
      const candidate = item as unknown as Record<string, unknown>
      const x = number(candidate.x)
      const y = number(candidate.y)
      const w = number(candidate.w)
      const h = number(candidate.h)
      if (x < 0 || y < 0 || w < 0 || h < 0 || x + w > 13.334 || y + h > 7.501) {
        issues.push({ severity: 'error', format: 'pptx', code: 'ELEMENT_OUT_OF_BOUNDS', message: `슬라이드 요소가 캔버스를 벗어났습니다. (${x}, ${y}, ${w}, ${h})`, slideOrder: index + 1 })
      }
    })
    slide.texts.forEach((text) => {
      if (!text.text.trim()) issues.push({ severity: 'warning', format: 'pptx', code: 'EMPTY_TEXT', message: '빈 텍스트 상자가 있습니다.', slideOrder: index + 1 })
      const fontSize = number(text.fontSize) || 16
      const capacity = Math.max(1, (text.w * 72 / fontSize) * (text.h * 72 / (fontSize * 1.12)))
      if ([...text.text].length > capacity * 1.8) {
        issues.push({ severity: 'warning', format: 'pptx', code: 'TEXT_DENSITY', message: '텍스트가 상자에 비해 많아 PowerPoint에서 줄바꿈을 확인해야 합니다.', slideOrder: index + 1 })
      }
    })
  })

  const pptxBytes = new Uint8Array(generatePptx(builtPptx.pptx))
  const pptxFiles = unzipSync(pptxBytes)
  required(pptxFiles, ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels'], 'pptx', issues)
  const slideNames = Object.keys(pptxFiles).filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
  if (slideNames.length !== document.slides.length) {
    issues.push({ severity: 'error', format: 'pptx', code: 'SLIDE_COUNT', message: `DeckIR ${document.slides.length}장과 PPTX ${slideNames.length}장이 일치하지 않습니다.` })
  }
  validXml(pptxFiles, ['ppt/presentation.xml', ...slideNames], 'pptx', issues)
  const slideXml = slideNames.map((name) => strFromU8(pptxFiles[name]!)).join('\n')
  const liveTextCount = (slideXml.match(/<a:t(?:\s[^>]*)?>/gu) || []).length
  if (liveTextCount === 0) issues.push({ severity: 'error', format: 'pptx', code: 'LIVE_TEXT_MISSING', message: '편집 가능한 라이브 텍스트가 없습니다.' })

  const builtDocx = buildDeckIrDocxBytes(document)
  const docxFiles = unzipSync(builtDocx.bytes)
  required(docxFiles, ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml'], 'docx', issues)
  validXml(docxFiles, ['word/document.xml', 'word/styles.xml', 'word/numbering.xml'], 'docx', issues)
  const documentXml = docxFiles['word/document.xml'] ? strFromU8(docxFiles['word/document.xml']) : ''
  if (!documentXml.includes(document.title)) issues.push({ severity: 'error', format: 'docx', code: 'TITLE_MISSING', message: 'Word 본문에 문서 제목이 없습니다.' })

  return {
    checkedAt: Date.now(), pptxBytes: pptxBytes.byteLength, docxBytes: builtDocx.bytes.byteLength,
    slideCount: slideNames.length, liveTextCount, issues
  }
}
