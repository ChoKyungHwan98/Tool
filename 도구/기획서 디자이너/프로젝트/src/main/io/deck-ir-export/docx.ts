import fs from 'fs'
import path from 'path'
import { strToU8, zipSync } from 'fflate'
import type { DeckIrDocument, DeckIrSlide } from '@shared/deck-ir'
import { buildDeckIrExportReport, type DeckIrExportReport } from './report'

const xml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const run = (
  text: string,
  options: { bold?: boolean; color?: string; size?: number } = {}
): string =>
  `<w:r><w:rPr><w:rFonts w:ascii="Pretendard" w:hAnsi="Pretendard" w:eastAsia="Pretendard"/>${
    options.bold ? '<w:b/>' : ''
  }${options.color ? `<w:color w:val="${options.color}"/>` : ''}${
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ''
  }</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`

const paragraph = (
  text: string,
  options: {
    style?: string
    bold?: boolean
    color?: string
    size?: number
    before?: number
    after?: number
    keepNext?: boolean
  } = {}
): string =>
  `<w:p><w:pPr>${options.style ? `<w:pStyle w:val="${options.style}"/>` : ''}<w:spacing w:before="${
    options.before ?? 0
  }" w:after="${options.after ?? 120}" w:line="264" w:lineRule="auto"/>${
    options.keepNext ? '<w:keepNext/>' : ''
  }</w:pPr>${run(text, options)}</w:p>`

const bullet = (text: string): string =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr>${run(
    text
  )}</w:p>`

const shade = (fill: string): string => `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`

const callout = (label: string, text: string, fill = 'F4F6F9'): string =>
  `<w:p><w:pPr>${shade(fill)}<w:spacing w:before="80" w:after="120"/><w:ind w:left="160" w:right="160"/></w:pPr>${run(
    `${label}  `,
    { bold: true, color: 'C7563B' }
  )}${run(text)}</w:p>`

const tableCell = (text: string, width: number, header: boolean): string =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? shade('F2F4F7') : ''}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${run(
    text,
    { bold: header, size: 20 }
  )}</w:p></w:tc>`

const mappingTable = (report: DeckIrExportReport): string => {
  const widths = [1000, 2360, 3600, 2400]
  const rows = [
    ['장', '슬라이드 ID', '인벤토리 ID', '주장 ID'],
    ...report.contentMapping.map((item) => [
      String(item.slideOrder),
      item.slideId,
      item.inventoryIds.join(', ') || '-',
      item.claimIds.join(', ') || '-'
    ])
  ]
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DDE3"/><w:left w:val="single" w:sz="4" w:color="D9DDE3"/><w:bottom w:val="single" w:sz="4" w:color="D9DDE3"/><w:right w:val="single" w:sz="4" w:color="D9DDE3"/><w:insideH w:val="single" w:sz="4" w:color="E5E7EB"/><w:insideV w:val="single" w:sz="4" w:color="E5E7EB"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths
    .map((width) => `<w:gridCol w:w="${width}"/>`)
    .join('')}</w:tblGrid>${rows
    .map(
      (row, rowIndex) =>
        `<w:tr>${rowIndex === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${row
          .map((cell, cellIndex) => tableCell(cell, widths[cellIndex], rowIndex === 0))
          .join('')}</w:tr>`
    )
    .join('')}</w:tbl>`
}

const slideSection = (document: DeckIrDocument, slide: DeckIrSlide): string => {
  const dataRequirements = document.dataRequirements.filter(
    (item) => item.status === 'missing' && (!item.slideId || item.slideId === slide.id)
  )
  const imageSlots = document.imageSlots.filter((item) => item.slideId === slide.id)
  return [
    paragraph(`${slide.order}. ${slide.headline.text}`, {
      style: 'Heading1',
      keepNext: true,
      before: 320,
      after: 160
    }),
    ...slide.body.map((item) => bullet(item.text)),
    ...(slide.takeaway ? [callout('핵심', slide.takeaway.text, 'EEF3EA')] : []),
    ...dataRequirements.map((item) =>
      callout('[DATA REQUIRED]', `${item.field}: ${item.question}`, 'FFF7E6')
    ),
    ...imageSlots.map((slot) =>
      callout(
        '[IMAGE]',
        `${slot.description} / ${slot.composition} / ${slot.aspectRatio} / 최소 ${slot.minWidth}x${slot.minHeight}`,
        'F2F3F5'
      )
    )
  ].join('')
}

const stylesXml = (): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Pretendard" w:hAnsi="Pretendard" w:eastAsia="Pretendard"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="222222"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Pretendard" w:hAnsi="Pretendard" w:eastAsia="Pretendard"/><w:b/><w:color w:val="222222"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="320"/></w:pPr><w:rPr><w:color w:val="6E746D"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="320" w:after="160"/></w:pPr><w:rPr><w:b/><w:color w:val="2E5B48"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="2E5B48"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`

const numberingXml = (): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:color w:val="C7563B"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`

const documentXml = (document: DeckIrDocument, report: DeckIrExportReport): string => {
  const body = [
    paragraph('기획 문서', { bold: true, color: 'C7563B', size: 22, after: 80 }),
    paragraph(document.title, { style: 'Title', keepNext: true }),
    paragraph(`DeckIR r${document.revision} · 근거 추적형 원본`, { style: 'Subtitle' }),
    paragraph('기획 의도', { style: 'Heading1', keepNext: true }),
    paragraph(document.brief.rawText || '사용자가 직접 내용을 입력할 수 있습니다.'),
    ...[...document.slides]
      .sort((a, b) => a.order - b.order)
      .map((slide) => slideSection(document, slide)),
    paragraph('부록 · 콘텐츠 매핑', { style: 'Heading1', keepNext: true, before: 360 }),
    paragraph('각 슬라이드의 문장이 어떤 인벤토리와 주장에 연결되는지 확인합니다.', {
      color: '6E746D'
    }),
    mappingTable(report),
    ...(report.aiTellAudit.prohibitedPhraseHits.length > 0
      ? [callout('AI 문체 점검', report.aiTellAudit.prohibitedPhraseHits.join(', '), 'FFF7E6')]
      : [callout('AI 문체 점검', '금지 표현이 발견되지 않았습니다.', 'EEF3EA')]),
    `<w:sectPr><w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`
}

const headerXml = (title: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(
    title,
    { bold: true, color: '6E746D', size: 18 }
  )}</w:p></w:hdr>`

const footerXml = (): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr>${run(
    '기획서 디자이너  ·  ',
    { color: '8A8E89', size: 18 }
  )}<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="8A8E89"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`

export const buildDeckIrDocxBytes = (
  document: DeckIrDocument
): { bytes: Uint8Array; report: DeckIrExportReport } => {
  const report = buildDeckIrExportReport(document, {
    warnings: ['Pretendard가 설치되어 있지 않으면 Word가 호환 글꼴로 대체할 수 있습니다.']
  })
  const now = new Date().toISOString()
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
    ),
    'word/document.xml': strToU8(documentXml(document, report)),
    'word/styles.xml': strToU8(stylesXml()),
    'word/numbering.xml': strToU8(numberingXml()),
    'word/settings.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>`
    ),
    'word/header1.xml': strToU8(headerXml(document.title)),
    'word/footer1.xml': strToU8(footerXml()),
    'word/_rels/document.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`
    ),
    'docProps/core.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(
        document.title
      )}</dc:title><dc:creator>Deck Designer</dc:creator><cp:lastModifiedBy>Deck Designer</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
    ),
    'docProps/app.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Deck Designer</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>0.1</AppVersion></Properties>`
    )
  }
  return { bytes: zipSync(files, { level: 6 }), report }
}

export const exportDeckIrDocx = async (
  outputPath: string,
  document: DeckIrDocument
): Promise<{ path: string; reportPath: string; pageCount: number; report: DeckIrExportReport }> => {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  const { bytes, report } = buildDeckIrDocxBytes(document)
  await fs.promises.writeFile(outputPath, Buffer.from(bytes))
  const reportPath = `${outputPath}.report.json`
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { path: outputPath, reportPath, pageCount: document.slides.length, report }
}
