import fs from 'fs'
import path from 'path'
import {
  generatePptx,
  type HtmlToPptxDocument,
  type HtmlToPptxShape,
  type HtmlToPptxSlide,
  type HtmlToPptxTextBox
} from '@arcsin1/html2pptx'
import type { DeckIrDocument, DeckIrSlide } from '@shared/deck-ir'
import type { DesignDirection, LayoutCandidate, LayoutFamily } from '@shared/design-engine'
import { buildDeckIrExportReport, type DeckIrExportReport } from './report'

const SLIDE_WIDTH = 13.333
const SLIDE_HEIGHT = 7.5
const FONT_FACE = 'Pretendard'

type Palette = {
  canvas: string
  surface: string
  ink: string
  muted: string
  accent: string
}

type SlideBuildContext = {
  document: DeckIrDocument
  slide: DeckIrSlide
  palette: Palette
  candidate: LayoutCandidate | null
  direction: DesignDirection | null
}

const DEFAULT_PALETTE: Palette = {
  canvas: 'F7F4ED',
  surface: 'FFFFFF',
  ink: '222222',
  muted: '7A7A74',
  accent: 'C7563B'
}

const cleanHex = (value: string | undefined, fallback: string): string =>
  value?.replace(/^#/, '').toUpperCase() || fallback

const resolvePalette = (direction: DesignDirection | null): Palette => ({
  canvas: cleanHex(direction?.palette.canvas, DEFAULT_PALETTE.canvas),
  surface: cleanHex(direction?.palette.surface, DEFAULT_PALETTE.surface),
  ink: cleanHex(direction?.palette.ink, DEFAULT_PALETTE.ink),
  muted: cleanHex(direction?.palette.muted, DEFAULT_PALETTE.muted),
  accent: cleanHex(direction?.palette.accent, DEFAULT_PALETTE.accent)
})

type SlideVisualSettings = { fontScale: number; density: 'spacious' | 'balanced' | 'dense' }

const slideVisualSettings = (ctx: SlideBuildContext): SlideVisualSettings => {
  const overrides = ctx.document.extensions.studioVisualOverrides
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return { fontScale: 1, density: 'balanced' }
  }
  const value = (overrides as Record<string, unknown>)[ctx.slide.id]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { fontScale: 1, density: 'balanced' }
  }
  const candidate = value as Partial<SlideVisualSettings>
  return {
    fontScale: Math.max(0.8, Math.min(1.25, Number(candidate.fontScale) || 1)),
    density: ['spacious', 'balanced', 'dense'].includes(candidate.density || '')
      ? candidate.density as SlideVisualSettings['density']
      : 'balanced'
  }
}

const scaledTitleSize = (ctx: SlideBuildContext, size: number, minimum = 22): number =>
  Math.max(minimum, Math.round(size * slideVisualSettings(ctx).fontScale))

const bodyFontSize = (ctx: SlideBuildContext): number => {
  const density = slideVisualSettings(ctx).density
  return density === 'spacious' ? 18 : density === 'dense' ? 15 : 17
}

const textBox = (
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  options: Partial<HtmlToPptxTextBox> = {}
): HtmlToPptxTextBox => {
  const box: HtmlToPptxTextBox = {
    text,
    x,
    y,
    w,
    h,
    fontSize,
    fontFace: FONT_FACE,
    color: options.color || DEFAULT_PALETTE.ink,
    paddingLeft: options.paddingLeft ?? 0,
    paddingRight: options.paddingRight ?? 0,
    paddingTop: options.paddingTop ?? 0,
    paddingBottom: options.paddingBottom ?? 0,
    verticalAlign: options.verticalAlign || 'top',
    wrap: options.wrap ?? true,
    ...options
  }
  // html2pptx의 lineSpacing은 배수가 아니라 pt 단위다. 1.2 같은 배수 입력은
  // 그대로 쓰면 1.2pt로 내보내져 여러 줄의 한글이 한 줄 위에 겹친다.
  if (options.lineSpacing && options.lineSpacing <= 3) {
    box.lineSpacing = Math.round(fontSize * options.lineSpacing * 10) / 10
  }
  return box
}

const weightedTextLength = (text: string): number =>
  [...text].reduce((total, character) => {
    if (character === '\n') return total
    if (/\s/u.test(character)) return total + 0.45
    if (/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af]/u.test(character)) return total + 1
    return total + 0.58
  }, 0)

const fitTextSize = (
  text: string,
  frame: { w: number; h: number },
  maximum: number,
  minimum: number,
  lineHeight = 1.16
): number => {
  const explicitLines = text.split('\n')
  for (let size = maximum; size >= minimum; size -= 1) {
    const charactersPerLine = Math.max(1, (frame.w * 72) / size)
    const lineCount = explicitLines.reduce(
      (total, lineText) =>
        total + Math.max(1, Math.ceil(weightedTextLength(lineText) / charactersPerLine)),
      0
    )
    if (lineCount * size * lineHeight <= frame.h * 72) return size
  }
  return minimum
}

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  options: Partial<HtmlToPptxShape> = {}
): HtmlToPptxShape => ({ x, y, w, h, fill, shapeType: 'rect', ...options })

const line = (x: number, y: number, w: number, h: number, color: string): HtmlToPptxShape => ({
  x,
  y,
  w,
  h,
  shapeType: 'line',
  border: { color, widthPt: 1.25 }
})

const addBodyList = (
  texts: HtmlToPptxTextBox[],
  items: string[],
  frame: { x: number; y: number; w: number; h: number },
  palette: Palette,
  options: { numbered?: boolean; align?: 'left' | 'center' | 'right'; fontSize?: number } = {}
): void => {
  if (items.length === 0) return
  const gap = Math.min(0.17, frame.h / Math.max(items.length, 1) / 5)
  const itemHeight = Math.max(
    0.52,
    Math.min(0.95, (frame.h - gap * (items.length - 1)) / items.length)
  )
  items.forEach((item, index) => {
    const prefix = options.numbered ? `${index + 1}.` : '•'
    const fontSize = options.fontSize || 17
    texts.push(
      textBox(prefix, frame.x, frame.y + index * (itemHeight + gap), 0.35, itemHeight, fontSize, {
        bold: true,
        color: palette.accent,
        align: 'center'
      }),
      textBox(
        item,
        frame.x + 0.42,
        frame.y + index * (itemHeight + gap),
        frame.w - 0.42,
        itemHeight,
        fontSize,
        { color: palette.ink, lineSpacing: 1.18, align: options.align || 'left' }
      )
    )
  })
}

const addFrame = (
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[],
  ctx: SlideBuildContext
): void => {
  const { document, slide, palette, direction } = ctx
  shapes.push(rect(0.66, 0.52, 0.42, 0.07, palette.accent))
  texts.push(
    textBox(document.title, 1.18, 0.39, 7.3, 0.3, 11, {
      bold: true,
      color: palette.muted,
      wrap: false
    }),
    textBox(String(slide.order).padStart(2, '0'), 11.92, 0.38, 0.7, 0.3, 11, {
      bold: true,
      color: palette.muted,
      align: 'right',
      wrap: false
    })
  )
  if (direction) {
    texts.push(
      textBox(direction.motif.name, 9.1, 0.39, 2.45, 0.3, 10, {
        color: palette.muted,
        align: 'right',
        wrap: false
      })
    )
  }
}

const addHeadline = (
  texts: HtmlToPptxTextBox[],
  ctx: SlideBuildContext,
  frame = { x: 0.78, y: 0.92, w: 11.75, h: 1.08 },
  fontSize = 36
): void => {
  const fittedSize = fitTextSize(ctx.slide.headline.text, frame, scaledTitleSize(ctx, fontSize), 22, 1.12)
  texts.push(
    textBox(ctx.slide.headline.text, frame.x, frame.y, frame.w, frame.h, fittedSize, {
      bold: true,
      color: ctx.palette.ink,
      lineSpacing: 1.03
    })
  )
}

const addDataRequirements = (
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[],
  ctx: SlideBuildContext
): void => {
  const requirements = ctx.document.dataRequirements.filter(
    (item) => item.status === 'missing' && (!item.slideId || item.slideId === ctx.slide.id)
  )
  if (requirements.length === 0) return
  const text = requirements
    .slice(0, 2)
    .map((item) => `[DATA REQUIRED] ${item.field}: ${item.question}`)
    .join('\n')
  shapes.push(
    rect(0.78, 6.57, 11.75, 0.48, ctx.palette.surface, {
      border: { color: ctx.palette.accent, widthPt: 1 }
    })
  )
  texts.push(
    textBox(text, 0.98, 6.65, 11.35, 0.3, 16, {
      bold: true,
      color: ctx.palette.accent,
      wrap: false
    })
  )
}

const addTakeaway = (texts: HtmlToPptxTextBox[], ctx: SlideBuildContext): void => {
  if (!ctx.slide.takeaway) return
  texts.push(
    textBox(ctx.slide.takeaway.text, 0.82, 6.08, 11.6, 0.35, 16, {
      bold: true,
      color: ctx.palette.ink,
      align: 'right'
    })
  )
}

const buildCover = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  const { palette, slide, direction } = ctx
  const titleFrame = { x: 5.72, y: 1.65, w: 6.15, h: 2.35 }
  const titleSize = fitTextSize(slide.headline.text, titleFrame, scaledTitleSize(ctx, 52, 30), 30, 1.08)
  shapes.push(
    rect(0, 0, 4.95, SLIDE_HEIGHT, palette.ink),
    rect(5.72, 1.18, 6.73, 0.12, palette.accent),
    rect(11.52, 5.88, 0.95, 0.95, palette.surface, {
      shapeType: 'ellipse',
      border: { color: palette.accent, widthPt: 2 }
    })
  )
  texts.push(
    textBox('기획서', 0.78, 0.78, 3.3, 0.4, 16, {
      bold: true,
      color: palette.surface,
      wrap: false
    }),
    textBox(
      slide.headline.text,
      titleFrame.x,
      titleFrame.y,
      titleFrame.w,
      titleFrame.h,
      titleSize,
      {
        bold: true,
        color: palette.ink,
        lineSpacing: 1.02
      }
    ),
    textBox(direction?.name || '맥락 기반 디자인', 5.75, 4.46, 4.3, 0.42, 18, {
      color: palette.muted
    }),
    textBox(String(slide.order).padStart(2, '0'), 11.65, 6.15, 0.7, 0.34, 16, {
      bold: true,
      color: palette.accent,
      align: 'center',
      wrap: false
    })
  )
}

const buildStatement = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  shapes.push(rect(0.78, 2.05, 0.12, 3.72, ctx.palette.accent))
  const titleFrame = { x: 1.28, y: 1.76, w: 10.55, h: 2.25 }
  const titleSize = fitTextSize(ctx.slide.headline.text, titleFrame, scaledTitleSize(ctx, 46, 28), 28, 1.1)
  texts.push(
    textBox(
      ctx.slide.headline.text,
      titleFrame.x,
      titleFrame.y,
      titleFrame.w,
      titleFrame.h,
      titleSize,
      {
        bold: true,
        color: ctx.palette.ink,
        verticalAlign: 'middle',
        lineSpacing: 1.06
      }
    )
  )
  addBodyList(
    texts,
    ctx.slide.body.map((item) => item.text),
    { x: 1.35, y: 4.15, w: 9.9, h: 1.6 },
    ctx.palette,
    { fontSize: bodyFontSize(ctx) }
  )
}

const buildComparison = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const items = ctx.slide.body.map((item) => item.text)
  const midpoint = Math.max(1, Math.ceil(items.length / 2))
  const sides = [items.slice(0, midpoint), items.slice(midpoint)]
  const frames = [
    { x: 0.78, y: 2.25, w: 5.62, h: 3.55 },
    { x: 6.92, y: 2.25, w: 5.62, h: 3.55 }
  ]
  frames.forEach((frame, index) => {
    shapes.push(
      rect(
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        index === 0 ? ctx.palette.surface : ctx.palette.canvas,
        {
          border: { color: index === 0 ? ctx.palette.muted : ctx.palette.accent, widthPt: 1 }
        }
      )
    )
    addBodyList(
      texts,
      sides[index],
      { x: frame.x + 0.35, y: frame.y + 0.38, w: frame.w - 0.7, h: frame.h - 0.7 },
      ctx.palette,
      { fontSize: bodyFontSize(ctx) }
    )
  })
}

const buildSequence = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const items = ctx.slide.body.map((item) => item.text)
  const count = Math.max(items.length, 1)
  const left = 0.88
  const width = 11.55
  const segment = width / count
  shapes.push(line(left, 3.45, width, 0, ctx.palette.muted))
  items.forEach((item, index) => {
    const x = left + segment * index
    shapes.push(
      rect(x + segment * 0.38, 3.22, 0.46, 0.46, ctx.palette.accent, {
        shapeType: 'ellipse'
      })
    )
    texts.push(
      textBox(String(index + 1).padStart(2, '0'), x, 2.48, segment, 0.34, 16, {
        bold: true,
        color: ctx.palette.accent,
        align: 'center',
        wrap: false
      }),
      textBox(item, x + 0.08, 3.9, segment - 0.16, 1.45, 17, {
        color: ctx.palette.ink,
        align: 'center',
        lineSpacing: 1.14
      })
    )
  })
}

const buildCausal = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const items = ctx.slide.body.map((item) => item.text)
  const count = Math.max(items.length, 1)
  const cardWidth = Math.min(3.42, 10.95 / count)
  const totalWidth = cardWidth * count + 0.55 * Math.max(0, count - 1)
  const startX = (SLIDE_WIDTH - totalWidth) / 2
  items.forEach((item, index) => {
    const x = startX + index * (cardWidth + 0.55)
    if (index < items.length - 1)
      shapes.push(line(x + cardWidth, 3.85, 0.55, 0, ctx.palette.accent))
    shapes.push(
      rect(x, 2.55, cardWidth, 2.55, index % 2 === 0 ? ctx.palette.surface : ctx.palette.canvas, {
        border: { color: ctx.palette.muted, widthPt: 0.8 },
        shapeType: 'roundRect',
        radiusAdj: 0.12
      })
    )
    texts.push(
      textBox(String(index + 1).padStart(2, '0'), x + 0.28, 2.85, cardWidth - 0.56, 0.32, 16, {
        bold: true,
        color: ctx.palette.accent
      }),
      textBox(item, x + 0.28, 3.38, cardWidth - 0.56, 1.25, 17, {
        color: ctx.palette.ink,
        verticalAlign: 'middle',
        lineSpacing: 1.13
      })
    )
  })
}

const buildMetric = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  const allText = [ctx.slide.headline.text, ...ctx.slide.body.map((item) => item.text)].join(' ')
  const metric = allText.match(/[+-]?(?:\d[\d,]*(?:\.\d+)?)(?:%|배|초|ms|프레임|회|개)?/)?.[0]
  addHeadline(texts, ctx, { x: 0.78, y: 0.92, w: 7.4, h: 1.08 }, 36)
  if (metric) {
    texts.push(
      textBox(metric, 0.82, 2.05, 6.1, 2.15, 76, {
        bold: true,
        color: ctx.palette.accent,
        verticalAlign: 'middle',
        wrap: false
      })
    )
  }
  shapes.push(rect(7.18, 2.05, 0.08, 3.82, ctx.palette.accent))
  addBodyList(
    texts,
    ctx.slide.body.map((item) => item.text),
    { x: 7.78, y: 2.18, w: 4.5, h: 3.5 },
    ctx.palette,
    { fontSize: bodyFontSize(ctx) }
  )
}

const buildSystem = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const items = ctx.slide.body.map((item) => item.text).slice(0, 6)
  const center = { x: 5.18, y: 2.65, w: 3.0, h: 1.55 }
  shapes.push(
    rect(center.x, center.y, center.w, center.h, ctx.palette.accent, {
      shapeType: 'roundRect',
      radiusAdj: 0.16
    })
  )
  texts.push(
    textBox(
      ctx.slide.headline.text,
      center.x + 0.2,
      center.y + 0.18,
      center.w - 0.4,
      center.h - 0.36,
      22,
      {
        bold: true,
        color: ctx.palette.surface,
        align: 'center',
        verticalAlign: 'middle'
      }
    )
  )
  const zones = [
    { x: 0.82, y: 2.25 },
    { x: 9.35, y: 2.25 },
    { x: 0.82, y: 4.55 },
    { x: 9.35, y: 4.55 },
    { x: 3.1, y: 5.0 },
    { x: 7.18, y: 5.0 }
  ]
  items.forEach((item, index) => {
    const zone = zones[index]
    const w = index >= 4 ? 3 : 2.95
    shapes.push(
      rect(zone.x, zone.y, w, 1.05, ctx.palette.surface, {
        border: { color: ctx.palette.muted, widthPt: 0.8 },
        shapeType: 'roundRect',
        radiusAdj: 0.12
      })
    )
    texts.push(
      textBox(item, zone.x + 0.18, zone.y + 0.15, w - 0.36, 0.72, 16, {
        color: ctx.palette.ink,
        align: 'center',
        verticalAlign: 'middle'
      })
    )
  })
}

const buildImageSlot = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx, { x: 0.78, y: 0.92, w: 5.1, h: 1.25 }, 36)
  const slot = ctx.document.imageSlots.find((item) => item.slideId === ctx.slide.id)
  const placeholderText = slot
    ? `[IMAGE]\n${slot.description}\n${slot.composition}\n${slot.aspectRatio} · 최소 ${slot.minWidth}x${slot.minHeight}`
    : '[IMAGE]\n이 장의 주장을 증명할 이미지가 필요합니다.'
  shapes.push(
    rect(5.78, 1.42, 6.73, 4.72, 'F2F3F5', {
      border: { color: ctx.palette.muted, widthPt: 1, dash: 'dash' }
    })
  )
  texts.push(
    textBox(placeholderText, 6.18, 2.45, 5.9, 2.1, 17, {
      color: ctx.palette.muted,
      align: 'center',
      verticalAlign: 'middle',
      lineSpacing: 1.2
    })
  )
  if (slot?.annotations.length) {
    texts.push(
      textBox(slot.annotations.join(' · '), 6.05, 5.58, 6.08, 0.3, 16, {
        bold: true,
        color: ctx.palette.accent,
        align: 'right',
        wrap: false
      })
    )
  }
  addBodyList(
    texts,
    ctx.slide.body.map((item) => item.text),
    { x: 0.82, y: 2.6, w: 4.35, h: 3.25 },
    ctx.palette,
    { fontSize: bodyFontSize(ctx) }
  )
}

const buildSplit = (
  ctx: SlideBuildContext,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  shapes.push(rect(0.78, 1.26, 4.62, 4.98, ctx.palette.surface))
  const titleFrame = { x: 1.08, y: 1.65, w: 4.02, h: 2.2 }
  const titleSize = fitTextSize(ctx.slide.headline.text, titleFrame, scaledTitleSize(ctx, 38, 24), 24, 1.1)
  texts.push(
    textBox(
      ctx.slide.headline.text,
      titleFrame.x,
      titleFrame.y,
      titleFrame.w,
      titleFrame.h,
      titleSize,
      {
        bold: true,
        color: ctx.palette.ink,
        lineSpacing: 1.04,
        verticalAlign: 'middle'
      }
    )
  )
  shapes.push(rect(5.82, 1.26, 0.09, 4.98, ctx.palette.accent))
  addBodyList(
    texts,
    ctx.slide.body.map((item) => item.text),
    { x: 6.43, y: 1.72, w: 5.6, h: 4.15 },
    ctx.palette,
    { fontSize: bodyFontSize(ctx) }
  )
}

type ConnectedArtifact = {
  kind: string
  title: string
  slideIds: string[]
  data?: unknown
}

const artifactNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const connectedArtifactForSlide = (ctx: SlideBuildContext): ConnectedArtifact | undefined => {
  const artifacts = ctx.document.extensions.studioArtifacts
  if (!Array.isArray(artifacts)) return undefined
  return (artifacts as ConnectedArtifact[]).find((artifact) => artifact.slideIds?.includes(ctx.slide.id))
}

const buildConnectedTable = (
  ctx: SlideBuildContext,
  artifact: ConnectedArtifact,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const data = artifact.data && typeof artifact.data === 'object' ? artifact.data as Record<string, unknown> : {}
  const columns = ((data.columns as Array<Record<string, unknown>> | undefined) || []).slice(0, 6)
  const rows = ((data.rows as Array<Record<string, unknown>> | undefined) || []).slice(0, 5)
  const count = Math.max(1, columns.length)
  const frame = { x: 0.78, y: 2.18, w: 11.75, h: 3.84 }
  const columnWidth = frame.w / count
  const rowHeight = frame.h / Math.max(2, rows.length + 1)
  columns.forEach((column, columnIndex) => {
    const x = frame.x + columnIndex * columnWidth
    shapes.push(rect(x, frame.y, columnWidth, rowHeight, ctx.palette.accent, {
      border: { color: ctx.palette.canvas, widthPt: 0.7 }
    }))
    texts.push(textBox(String(column.displayName || column.name || '열'), x + 0.1, frame.y + 0.08, columnWidth - 0.2, rowHeight - 0.16, 14, {
      bold: true, color: ctx.palette.surface, verticalAlign: 'middle'
    }))
  })
  rows.forEach((row, rowIndex) => {
    const cells = row.cells && typeof row.cells === 'object' ? row.cells as Record<string, unknown> : {}
    columns.forEach((column, columnIndex) => {
      const x = frame.x + columnIndex * columnWidth
      const y = frame.y + (rowIndex + 1) * rowHeight
      shapes.push(rect(x, y, columnWidth, rowHeight, rowIndex % 2 === 0 ? ctx.palette.surface : ctx.palette.canvas, {
        border: { color: ctx.palette.muted, widthPt: 0.5 }
      }))
      const value = cells[String(column.columnId || '')]
      const label = value === undefined || value === null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
      texts.push(textBox(label.slice(0, 70), x + 0.1, y + 0.08, columnWidth - 0.2, rowHeight - 0.16, 12, {
        color: ctx.palette.ink, verticalAlign: 'middle'
      }))
    })
  })
  if (columns.length === 0) texts.push(textBox('연결된 테이블에 표시할 열이 없습니다.', 0.9, 3.25, 11.4, 0.6, 18, { color: ctx.palette.muted, align: 'center' }))
}

const buildConnectedPattern = (
  ctx: SlideBuildContext,
  artifact: ConnectedArtifact,
  texts: HtmlToPptxTextBox[],
  shapes: HtmlToPptxShape[]
): void => {
  addFrame(texts, shapes, ctx)
  addHeadline(texts, ctx)
  const data = artifact.data && typeof artifact.data === 'object' ? artifact.data as Record<string, unknown> : {}
  const graphs = (data.graphs as Array<Record<string, unknown>> | undefined) || []
  const graph = graphs[0] || {}
  const nodes = ((graph.nodes as Array<Record<string, unknown>> | undefined) || []).slice(0, 12)
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]))
  const positions = nodes.map((node) => node.position && typeof node.position === 'object' ? node.position as Record<string, unknown> : {})
  const xs = positions.map((position) => artifactNumber(position.x))
  const ys = positions.map((position) => artifactNumber(position.y))
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, minX + 1)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, minY + 1)
  const nodeFrame = (node: Record<string, unknown>) => {
    const position = node.position && typeof node.position === 'object' ? node.position as Record<string, unknown> : {}
    return {
      x: 0.95 + ((artifactNumber(position.x) - minX) / (maxX - minX)) * 9.95,
      y: 2.25 + ((artifactNumber(position.y) - minY) / (maxY - minY)) * 3.2,
      w: 1.72,
      h: 0.7
    }
  }
  const edges = ((graph.edges as Array<Record<string, unknown>> | undefined) || []).slice(0, 20)
  edges.forEach((edge) => {
    const source = nodeById.get(String(edge.source))
    const target = nodeById.get(String(edge.target))
    if (!source || !target) return
    const from = nodeFrame(source)
    const to = nodeFrame(target)
    const fromX = from.x + from.w / 2
    const fromY = from.y + from.h / 2
    const toX = to.x + to.w / 2
    const toY = to.y + to.h / 2
    shapes.push(line(Math.min(fromX, toX), Math.min(fromY, toY), Math.abs(toX - fromX), Math.abs(toY - fromY), ctx.palette.muted))
  })
  nodes.forEach((node) => {
    const frame = nodeFrame(node)
    const initial = String(node.kind || '').includes('initial')
    shapes.push(rect(frame.x, frame.y, frame.w, frame.h, initial ? ctx.palette.accent : ctx.palette.surface, {
      border: { color: initial ? ctx.palette.accent : ctx.palette.muted, widthPt: 0.8 },
      shapeType: 'roundRect', radiusAdj: 0.12
    }))
    texts.push(textBox(String(node.name || node.kind || '상태'), frame.x + 0.12, frame.y + 0.1, frame.w - 0.24, frame.h - 0.2, 13, {
      bold: true, color: initial ? ctx.palette.surface : ctx.palette.ink, align: 'center', verticalAlign: 'middle'
    }))
  })
  texts.push(textBox(String(graph.name || artifact.title), 9.65, 6.18, 2.75, 0.28, 11, { color: ctx.palette.accent, align: 'right', wrap: false }))
  if (nodes.length === 0) texts.push(textBox('연결된 패턴에 표시할 노드가 없습니다.', 0.9, 3.25, 11.4, 0.6, 18, { color: ctx.palette.muted, align: 'center' }))
}

const resolveLayoutFamily = (ctx: SlideBuildContext): LayoutFamily => {
  if (ctx.slide.role === 'cover') return 'visual-canvas'
  if (ctx.slide.role === 'divider' || ctx.slide.role === 'closing') return 'statement-field'
  if (ctx.slide.imageSlotIds.length > 0) return 'annotated-artifact'
  return ctx.candidate?.family || 'asymmetric-split'
}

const buildSlide = (ctx: SlideBuildContext): HtmlToPptxSlide => {
  const texts: HtmlToPptxTextBox[] = []
  const shapes: HtmlToPptxShape[] = []
  const family = resolveLayoutFamily(ctx)
  const connectedArtifact = connectedArtifactForSlide(ctx)
  if (connectedArtifact?.kind === 'data-table') buildConnectedTable(ctx, connectedArtifact, texts, shapes)
  else if (connectedArtifact?.kind === 'pattern-set') buildConnectedPattern(ctx, connectedArtifact, texts, shapes)
  else if (ctx.slide.role === 'cover') buildCover(ctx, texts, shapes)
  else if (['statement-field', 'editorial-axis'].includes(family))
    buildStatement(ctx, texts, shapes)
  else if (['shared-criteria', 'mirrored-evidence', 'before-after-hinge'].includes(family))
    buildComparison(ctx, texts, shapes)
  else if (['progression-track', 'staged-path', 'judgement-timeline'].includes(family))
    buildSequence(ctx, texts, shapes)
  else if (family === 'causal-chain') buildCausal(ctx, texts, shapes)
  else if (['metric-stage', 'chart-argument'].includes(family)) buildMetric(ctx, texts, shapes)
  else if (['system-map', 'state-machine', 'modular-matrix'].includes(family))
    buildSystem(ctx, texts, shapes)
  else if (['annotated-artifact', 'visual-canvas'].includes(family))
    buildImageSlot(ctx, texts, shapes)
  else buildSplit(ctx, texts, shapes)

  addTakeaway(texts, ctx)
  addDataRequirements(texts, shapes, ctx)

  const mapping = buildDeckIrExportReport(ctx.document).contentMapping.find(
    (item) => item.slideId === ctx.slide.id
  )
  const sourceLines = (mapping?.inventoryIds || []).map((inventoryId) => {
    const item = ctx.document.inventory.find((entry) => entry.id === inventoryId)
    const source = ctx.document.sources.find((entry) => entry.id === item?.sourceId)
    return `- ${source?.name || '사용자 제공 자료'} · ${inventoryId}`
  })
  const notes = [
    ctx.slide.notes.trim(),
    '[Sources]',
    ...(sourceLines.length > 0 ? sourceLines : ['- 사용자 직접 작성'])
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title: ctx.slide.headline.text,
    backgroundColor: ctx.palette.canvas,
    texts,
    shapes,
    images: [],
    tables: [],
    notes
  }
}

export const buildDeckIrPptxDocument = (
  document: DeckIrDocument
): { pptx: HtmlToPptxDocument; report: DeckIrExportReport } => {
  const selectedDirection =
    document.designPlan?.directions.find(
      (direction) => direction.id === document.designPlan?.selectedDirectionId
    ) || null
  const palette = resolvePalette(selectedDirection)
  const storyboardChanges: DeckIrExportReport['storyboardChanges'] = []
  const slides = [...document.slides]
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const decision = document.designPlan?.storyboard.find((item) => item.slideId === slide.id)
      const candidate =
        decision?.candidates.find((item) => item.id === decision.selectedCandidateId) || null
      if (!candidate) {
        storyboardChanges.push({
          slideId: slide.id,
          reason: '선택된 레이아웃이 없어 논리 구조 기반 안전 레이아웃을 사용했습니다.'
        })
      }
      return buildSlide({ document, slide, palette, candidate, direction: selectedDirection })
    })
  const warnings = [
    'Pretendard가 설치되어 있지 않으면 PowerPoint가 호환 글꼴로 대체할 수 있습니다.'
  ]
  return {
    pptx: {
      title: document.title,
      author: 'Deck Designer',
      slides,
      slideSize: { widthIn: SLIDE_WIDTH, heightIn: SLIDE_HEIGHT }
    },
    report: buildDeckIrExportReport(document, { storyboardChanges, warnings })
  }
}

export const exportDeckIrPptx = async (
  outputPath: string,
  document: DeckIrDocument
): Promise<{ path: string; reportPath: string; pageCount: number; report: DeckIrExportReport }> => {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  const { pptx, report } = buildDeckIrPptxDocument(document)
  await fs.promises.writeFile(outputPath, Buffer.from(generatePptx(pptx)))
  const reportPath = `${outputPath}.report.json`
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { path: outputPath, reportPath, pageCount: pptx.slides.length, report }
}
