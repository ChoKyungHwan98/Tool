import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { XMLValidator } from 'fast-xml-parser'
import {
  createEmptyDeckIr,
  type DeckIrDocument,
  type DeckIrSlide
} from '../../../src/shared/deck-ir'
import { planDeckStoryboard, type DesignDirection } from '../../../src/shared/design-engine'
import {
  buildDeckIrDocxBytes,
  buildDeckIrPptxDocument,
  exportDeckIrDocx,
  exportDeckIrPptx
} from '../../../src/main/io/deck-ir-export'

const makeSlide = (
  order: number,
  structure: DeckIrSlide['logicalStructure'],
  headline: string,
  body: string[]
): DeckIrSlide => ({
  id: `slide-${order}`,
  order,
  role: order === 1 ? 'cover' : order === 6 ? 'closing' : 'content',
  logicalStructure: structure,
  headline: {
    id: `headline-${order}`,
    text: headline,
    sourceItemIds: ['inventory-1'],
    claimIds: [],
    transform: 'user-authored'
  },
  body: body.map((text, index) => ({
    id: `body-${order}-${index}`,
    text,
    sourceItemIds: ['inventory-1'],
    claimIds: [],
    transform: 'user-authored' as const
  })),
  claimIds: [],
  dataRequirementIds: [],
  imageSlotIds: [],
  notes: ''
})

const direction = (id: string, accent: string, name: string): DesignDirection => ({
  id,
  name,
  rationale: '프레임 실측과 판정 전환을 한눈에 읽히게 만든다.',
  toneWords: ['정밀함', '긴장감'],
  palette: {
    canvas: '#F4F0E8',
    surface: '#FFFFFF',
    ink: '#202622',
    muted: '#73786F',
    accent
  },
  typography: {
    titleCharacter: '짧고 단단한 제목',
    bodyCharacter: '실측 근거를 빠르게 읽는 본문',
    emphasisRule: '핵심 수치에만 굵기를 준다.'
  },
  motif: {
    name: '판정 눈금',
    description: '전환 구간을 눈금으로 표시한다.',
    usageRule: '전환과 핵심 근거에만 사용한다.'
  },
  navigation: '장 번호와 논증 위치를 함께 표시한다.',
  evidenceTreatment: '수치와 상태를 본문 가까이에 붙인다.',
  shapeLanguage: '얇은 선과 단단한 면',
  sourceSignalIds: [],
  heroSlideIds: ['slide-1', 'slide-5']
})

const createDocument = (): DeckIrDocument => {
  const document = createEmptyDeckIr({
    sessionId: 'export-session',
    title: '전투 판정 개선 기획',
    rawBrief: '회피 후딜 12프레임 실측값과 실패 상태를 근거로 전투 판정을 설명한다.',
    now: 100,
    idFactory: (prefix) => `${prefix}-1`
  })
  document.slides = [
    makeSlide(1, 'declaration', '회피의 손해가 방어 선택을 막기에 고정했다', []),
    makeSlide(2, 'mechanism', '판정은 입력부터 회복까지 네 상태로 나뉜다', [
      '입력 대기',
      '무적 구간',
      '공격 연결',
      '회복 구간'
    ]),
    makeSlide(3, 'cause-effect', '12프레임의 후딜이 다음 선택을 늦춘다', [
      '회피 성공',
      '후딜 12프레임',
      '반격 지연'
    ]),
    makeSlide(4, 'comparison', '기존안과 수정안은 실패 책임의 위치가 다르다', [
      '기존: 회피 후 행동 불가',
      '수정: 실패 시에만 후딜 유지'
    ]),
    makeSlide(5, 'number-focus', '12프레임을 검증의 기준으로 둔다', [
      '성공 시 체감 손실',
      '실패 시 위험 유지'
    ]),
    makeSlide(6, 'tradeoff', '성공 보상과 실패 책임을 함께 검증한다', [
      '플레이테스트에서 선택률을 기록한다'
    ])
  ]
  document.slides[1].imageSlotIds = ['image-1']
  document.imageSlots = [
    {
      id: 'image-1',
      slideId: 'slide-2',
      description: '회피 판정 프레임을 보여주는 게임 화면',
      composition: '캐릭터와 피격 박스를 함께 담는다.',
      aspectRatio: '16:9',
      minWidth: 1600,
      minHeight: 900,
      annotations: ['입력', '무적 시작', '회복']
    }
  ]
  document.slides[5].dataRequirementIds = ['data-1']
  document.dataRequirements = [
    {
      id: 'data-1',
      slideId: 'slide-6',
      field: '성공 기준',
      question: '플레이테스트에서 어떤 변화가 성공인가?',
      reason: '검증 결론에 필요한 기준',
      status: 'missing'
    }
  ]
  const first = direction('direction-1', '#C7563B', '판정선의 긴장')
  const second = direction('direction-2', '#4F725F', '상태도의 절제')
  document.designPlan = {
    directions: [first, second],
    selectedDirectionId: first.id,
    storyboard: planDeckStoryboard(document, first),
    generatedAt: 200
  }
  return document
}

describe('DeckIR Office export', () => {
  let outputDir = ''
  let document: DeckIrDocument

  beforeAll(() => {
    const requestedOutputDir = process.env.DECK_IR_EXPORT_QA_DIR?.trim()
    outputDir = requestedOutputDir
      ? path.resolve(requestedOutputDir)
      : fs.mkdtempSync(path.join(os.tmpdir(), 'deck-ir-export-'))
    fs.mkdirSync(outputDir, { recursive: true })
    document = createDocument()
  })

  afterAll(() => {
    if (!process.env.DECK_IR_EXPORT_QA_DIR && outputDir.startsWith(os.tmpdir())) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })

  it('builds an editable 16:9 PPTX with selected layout families and source notes', async () => {
    const outputPath = path.join(outputDir, 'sample.pptx')
    const built = buildDeckIrPptxDocument(document)
    expect(built.pptx.slideSize).toEqual({ widthIn: 13.333, heightIn: 7.5 })
    expect(built.pptx.slides).toHaveLength(6)
    expect(new Set(built.pptx.slides.map((slide) => slide.texts.length)).size).toBeGreaterThan(2)
    expect(built.pptx.slides.every((slide) => slide.notes?.includes('[Sources]'))).toBe(true)

    const result = await exportDeckIrPptx(outputPath, document)
    const files = unzipSync(fs.readFileSync(outputPath))
    const slideXml = Object.entries(files)
      .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .map(([, bytes]) => strFromU8(bytes))
      .join('\n')
    expect(result.pageCount).toBe(6)
    expect(slideXml).toContain('회피의 손해가 방어 선택을 막기에 고정했다')
    expect(slideXml).toContain('[DATA REQUIRED]')
    expect(slideXml).toContain('[IMAGE]')
    expect(slideXml).toContain('<a:t>')
    expect(Object.keys(files).some((name) => name.startsWith('ppt/notesSlides/notesSlide'))).toBe(
      true
    )
    expect(fs.existsSync(result.reportPath)).toBe(true)
  })

  it('builds a structured DOCX with real styles, numbering, fixed tables, and audit appendix', async () => {
    const outputPath = path.join(outputDir, 'sample.docx')
    const built = buildDeckIrDocxBytes(document)
    const files = unzipSync(built.bytes)
    const documentXml = strFromU8(files['word/document.xml'])
    const stylesXml = strFromU8(files['word/styles.xml'])
    const numberingXml = strFromU8(files['word/numbering.xml'])
    expect(XMLValidator.validate(documentXml)).toBe(true)
    expect(XMLValidator.validate(stylesXml)).toBe(true)
    expect(XMLValidator.validate(numberingXml)).toBe(true)
    expect(documentXml).toContain('전투 판정 개선 기획')
    expect(documentXml).toContain('[DATA REQUIRED]')
    expect(documentXml).toContain('w:tblW w:w="9360" w:type="dxa"')
    expect(documentXml).toContain('<w:tblHeader/>')
    expect(stylesXml).toContain('w:styleId="Heading1"')
    expect(numberingXml).toContain('w:numFmt w:val="bullet"')

    const result = await exportDeckIrDocx(outputPath, document)
    expect(fs.statSync(outputPath).size).toBeGreaterThan(2_000)
    expect(result.report.dataRequired).toEqual([
      expect.objectContaining({ slideOrder: 6, field: '성공 기준' })
    ])
    expect(result.report.imageSlots).toEqual([
      expect.objectContaining({ slideOrder: 2, minResolution: '1600x900' })
    ])
    expect(fs.existsSync(result.reportPath)).toBe(true)
  })
})
