import type { CellValue, DataTypeKind, EntityId, SchemaProject, WorkbenchDocument } from '../domain/schema'
import type { Cell, Row, Worksheet } from 'exceljs'

export interface WorkbookExportOptions {
  readonly includeDiagram: boolean
  readonly includeData: boolean
  readonly diagramPngDataUrl?: string
  readonly diagramAspectRatio?: number
}

export interface WorkbookExportManifest {
  readonly fileName: string
  readonly sheetNames: readonly string[]
  readonly tableSheetNames: Readonly<Record<EntityId, string>>
  readonly revision: number
}

export interface DeterministicDiagramNode {
  readonly tableId: EntityId
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const INVALID_SHEET_CHARACTERS = /[\\/?*[\]:]/g
const DOCUMENTATION_SHEET_NAME = '1. 테이블 설명 및 규격'
const DIAGRAM_SHEET_NAME = '2. 테이블 구조도'
const DATA_TYPE_ROW_COLOR = 'FFE8EDF2'

const DOCUMENT_COLORS = {
  title: 'FF18324A',
  section: 'FF405E73',
  accent: 'FF0E7782',
  accentSurface: 'FFE5F1F2',
  header: 'FFDCE7ED',
  tableGroup: 'FFEDF4F6',
  alternate: 'FFF6F8FA',
  white: 'FFFFFFFF',
  text: 'FF172033',
  muted: 'FF617184',
  border: 'FFCBD6DE',
} as const

const THIN_DOCUMENT_BORDER = {
  top: { style: 'thin' as const, color: { argb: DOCUMENT_COLORS.border } },
  left: { style: 'thin' as const, color: { argb: DOCUMENT_COLORS.border } },
  bottom: { style: 'thin' as const, color: { argb: DOCUMENT_COLORS.border } },
  right: { style: 'thin' as const, color: { argb: DOCUMENT_COLORS.border } },
}

function fillCell(cell: Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// 설명 시트 칸 수. 강의 과제 형식(칼럼명·한글명·자료형·설명)에 키와 참조를 더했다.
const DOC_COLUMNS = 7
const DOC_LAST = 'G'

function styleSectionRow(row: Row, label: string): void {
  row.getCell(1).value = label
  row.height = 26
  for (let column = 1; column <= DOC_COLUMNS; column += 1) {
    const cell = row.getCell(column)
    fillCell(cell, DOCUMENT_COLORS.section)
    cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: DOCUMENT_COLORS.white } }
    cell.alignment = { vertical: 'middle', horizontal: column === 1 ? 'left' : 'center' }
  }
}

function styleHeaderRow(row: Row): void {
  row.height = 24
  for (let column = 1; column <= DOC_COLUMNS; column += 1) {
    const cell = row.getCell(column)
    fillCell(cell, DOCUMENT_COLORS.header)
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: DOCUMENT_COLORS.text } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = THIN_DOCUMENT_BORDER
  }
}

function styleBodyRow(row: Row, background: string): void {
  for (let column = 1; column <= DOC_COLUMNS; column += 1) {
    const cell = row.getCell(column)
    fillCell(cell, background)
    cell.font = { name: '맑은 고딕', size: 10, color: { argb: DOCUMENT_COLORS.text } }
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    cell.border = THIN_DOCUMENT_BORDER
  }
}

function descriptionRowHeight(value: string): number {
  if (value.length === 0) return 24
  return Math.min(54, Math.max(24, Math.ceil(value.length / 62) * 18))
}

function buildDocumentationSheet(sheet: Worksheet, document: WorkbenchDocument): void {
  sheet.properties.defaultRowHeight = 21
  sheet.properties.tabColor = { argb: DOCUMENT_COLORS.title }
  sheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }]
  sheet.columns = [
    { width: 22 },
    { width: 24 },
    { width: 16 },
    { width: 12 },
    { width: 8 },
    { width: 28 },
    { width: 48 },
  ]
  sheet.pageSetup.orientation = 'landscape'
  sheet.pageSetup.paperSize = 9
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
  sheet.pageSetup.horizontalCentered = true
  sheet.pageSetup.margins = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  sheet.headerFooter.oddFooter = '&LGame Schema Workbench&C&P / &N'

  sheet.mergeCells(`A1:${DOC_LAST}1`)
  const title = sheet.getCell('A1')
  title.value = document.schema.name
  title.font = { name: '맑은 고딕', bold: true, size: 18, color: { argb: DOCUMENT_COLORS.white } }
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(title, DOCUMENT_COLORS.title)
  sheet.getRow(1).height = 36
  for (let column = 2; column <= DOC_COLUMNS; column += 1) fillCell(sheet.getRow(1).getCell(column), DOCUMENT_COLORS.title)

  sheet.mergeCells(`A2:${DOC_LAST}2`)
  const subtitle = sheet.getCell('A2')
  subtitle.value = '테이블 설명 및 규격'
  subtitle.font = { name: '맑은 고딕', bold: true, size: 11, color: { argb: DOCUMENT_COLORS.accent } }
  subtitle.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(subtitle, DOCUMENT_COLORS.accentSurface)
  sheet.getRow(2).height = 24
  for (let column = 2; column <= DOC_COLUMNS; column += 1) fillCell(sheet.getRow(2).getCell(column), DOCUMENT_COLORS.accentSurface)

  sheet.getRow(3).height = 10
  styleSectionRow(sheet.getRow(4), '테이블 설명')
  sheet.mergeCells(`A4:${DOC_LAST}4`)

  const descriptionHeader = sheet.getRow(5)
  descriptionHeader.values = ['테이블명', '설명']
  sheet.mergeCells(`B5:${DOC_LAST}5`)
  styleHeaderRow(descriptionHeader)

  let currentRow = 6
  document.schema.tables.forEach((table, tableIndex) => {
    const row = sheet.getRow(currentRow)
    row.getCell(1).value = table.name
    row.getCell(2).value = table.description
    sheet.mergeCells(currentRow, 2, currentRow, DOC_COLUMNS)
    styleBodyRow(row, tableIndex % 2 === 0 ? DOCUMENT_COLORS.white : DOCUMENT_COLORS.alternate)
    row.getCell(1).font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: DOCUMENT_COLORS.accent } }
    row.height = descriptionRowHeight(table.description)
    currentRow += 1
  })

  sheet.getRow(currentRow).height = 12
  currentRow += 1
  styleSectionRow(sheet.getRow(currentRow), '테이블 규격')
  sheet.mergeCells(currentRow, 1, currentRow, DOC_COLUMNS)
  currentRow += 1

  const specificationHeader = sheet.getRow(currentRow)
  specificationHeader.values = ['테이블명', '칼럼명', '한글명', '자료형', '키', '참조', '설명']
  styleHeaderRow(specificationHeader)
  currentRow += 1

  document.schema.tables.forEach((table, tableIndex) => {
    const columns = table.columns.length > 0 ? table.columns : [null]
    const firstRow = currentRow
    const background = tableIndex % 2 === 0 ? DOCUMENT_COLORS.white : DOCUMENT_COLORS.alternate
    for (const column of columns) {
      const row = sheet.getRow(currentRow)
      const pk = column ? table.primaryKey.columnIds.includes(column.columnId) : false
      const fkRelation = column ? document.schema.relations.find((relation) => relation.sourceColumnIds.includes(column.columnId)) : undefined
      const fkTarget = fkRelation ? document.schema.tables.find((item) => item.tableId === fkRelation.targetTableId) : undefined
      const fkTargetColumn = fkTarget?.columns.find((item) => fkRelation?.targetColumnIds.includes(item.columnId))
      row.getCell(1).value = currentRow === firstRow ? table.name : ''
      row.getCell(2).value = column?.name ?? ''
      row.getCell(3).value = column && column.displayName !== column.name ? column.displayName : ''
      row.getCell(4).value = column?.dataType.kind ?? ''
      row.getCell(5).value = [pk ? 'PK' : '', fkRelation ? 'FK' : ''].filter(Boolean).join(', ')
      row.getCell(6).value = fkTarget && fkTargetColumn ? `${fkTarget.name}.${fkTargetColumn.name}` : ''
      row.getCell(7).value = column?.description ?? ''
      styleBodyRow(row, background)
      if (fkTarget) row.getCell(6).font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF2368A0' } }
      row.height = descriptionRowHeight(column?.description ?? '')
      currentRow += 1
    }
    const lastRow = currentRow - 1
    if (lastRow > firstRow) sheet.mergeCells(firstRow, 1, lastRow, 1)
    const tableCell = sheet.getCell(firstRow, 1)
    fillCell(tableCell, DOCUMENT_COLORS.tableGroup)
    tableCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: DOCUMENT_COLORS.accent } }
    tableCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  })

  sheet.pageSetup.printArea = `A1:${DOC_LAST}${Math.max(1, currentRow - 1)}`
}

function toWorkbookCellValue(kind: DataTypeKind, value: CellValue | undefined): string | number | boolean | Date | null {
  if (value === undefined || value === null) return null
  if ((kind === 'date' || kind === 'datetime') && typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

export function sanitizeWorksheetName(name: string, used: ReadonlySet<string>): string {
  const base = name.replace(INVALID_SHEET_CHARACTERS, '_').trim().slice(0, 31) || 'Table'
  let candidate = base
  let sequence = 2
  while (used.has(candidate.toLocaleLowerCase())) {
    const suffix = ` (${sequence})`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    sequence += 1
  }
  return candidate
}

// 앱 구조도(SchemaCanvas)와 같은 치수. 내보낸 구조도가 앱과 똑같이 보이게 맞춘다.
const NODE_WIDTH = 236
const HEADER_HEIGHT = 34
const ROW_HEIGHT = 28
const MORE_HEIGHT = 24
const MARGIN = 40

type DiagramTable = SchemaProject['tables'][number]

// 앱 구조도와 같은 관계 색. 관계 순서(project.relations)도 앱과 같게 쓴다.
const RELATION_COLORS = ['#167786', '#7751a3', '#bd6518', '#356ca5', '#4f7b45', '#a14e68', '#8a6a19', '#536b85'] as const

interface Box { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** 가로·세로 선분이 상자를 지나가는지 (상자 테두리에서 4px 안쪽까지). */
function segmentHitsBox(x1: number, y1: number, x2: number, y2: number, box: Box): boolean {
  const left = box.x - 4
  const right = box.x + box.width + 4
  const top = box.y - 4
  const bottom = box.y + box.height + 4
  if (y1 === y2) return y1 > top && y1 < bottom && Math.max(x1, x2) > left && Math.min(x1, x2) < right
  return x1 > left && x1 < right && Math.max(y1, y2) > top && Math.min(y1, y2) < bottom
}

/**
 * 관계선 경로: 출발 → 세로 통로 → 도착. 통로는 선마다 따로 잡고, 다른 표를 지나지 않는 것을 고른다.
 * 모든 후보가 표를 지나면 가장 적게 지나는 통로를 쓴다.
 */
function routeRelation(
  sx: number, sy: number, tx: number, ty: number,
  obstacles: readonly Box[], usedLanes: number[],
): string {
  const lo = Math.min(sx, tx)
  const hi = Math.max(sx, tx)
  const candidates: number[] = []
  if (hi - lo > 40) {
    for (let x = lo + 18; x <= hi - 18; x += 10) candidates.push(x)
  }
  // 표가 겹쳐 사이 공간이 없으면 바깥쪽 통로도 본다.
  for (let offset = 24; offset <= 240; offset += 12) candidates.push(hi + offset, lo - offset)

  let best = { x: candidates[0] ?? (sx + tx) / 2, score: Number.POSITIVE_INFINITY }
  for (const lane of candidates) {
    const segments: [number, number, number, number][] = [[sx, sy, lane, sy], [lane, sy, lane, ty], [lane, ty, tx, ty]]
    const hits = segments.reduce((sum, [a, b, c, d]) => sum + obstacles.filter((box) => segmentHitsBox(a, b, c, d, box)).length, 0)
    const crowded = usedLanes.some((used) => Math.abs(used - lane) < 8) ? 1 : 0
    const detour = Math.abs(lane - (sx + tx) / 2) / 1000
    const score = hits * 10 + crowded + detour
    if (score < best.score) best = { x: lane, score }
    if (score < 0.5) break
  }
  usedLanes.push(best.x)
  return `M ${sx} ${sy} H ${best.x} V ${ty} H ${tx}`
}

/** 앱 구조도처럼 PK·FK·참조되는 열만 보인다. 나머지는 "+ N개 열"로 접는다. */
function keyColumnsOf(project: SchemaProject, table: DiagramTable) {
  return table.columns.filter((column) =>
    table.primaryKey.columnIds.includes(column.columnId)
    || project.relations.some((relation) => relation.sourceColumnIds.includes(column.columnId)
      || relation.targetColumnIds.includes(column.columnId)),
  )
}

function nodeHeight(project: SchemaProject, table: DiagramTable): number {
  const visible = keyColumnsOf(project, table).length
  const hidden = table.columns.length - visible
  return HEADER_HEIGHT + visible * ROW_HEIGHT + (hidden > 0 ? MORE_HEIGHT : 0)
}

export async function layoutDeterministicSchema(project: SchemaProject): Promise<readonly DeterministicDiagramNode[]> {
  const saved = new Map(project.layout.nodes.map((node) => [node.entityId, node]))
  const tables = project.tables.slice().sort((left, right) => left.tableId.localeCompare(right.tableId))
  if (tables.length === 0) return []

  // 앱에서 배치해 둔 위치가 있으면 그대로 쓴다. 없는 표만 자동 배치한다.
  let auto = new Map<string, { x: number; y: number }>()
  if (tables.some((table) => !saved.has(table.tableId))) {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
    const result = await new ELK().layout({
      id: 'workbook-schema',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '48',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.randomSeed': '1',
      },
      children: tables.map((table) => ({ id: table.tableId, width: NODE_WIDTH, height: nodeHeight(project, table) })),
      edges: project.relations.map((relation) => ({
        id: relation.relationId, sources: [relation.sourceTableId], targets: [relation.targetTableId],
      })),
    })
    auto = new Map((result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
  }

  const placed = tables.map((table) => {
    const position = saved.get(table.tableId) ?? auto.get(table.tableId) ?? { x: 0, y: 0 }
    return { table, x: position.x, y: position.y }
  })
  // 그림 왼쪽 위를 여백 위치로 맞춘다.
  const minX = Math.min(...placed.map((item) => item.x))
  const minY = Math.min(...placed.map((item) => item.y))
  return placed.map(({ table, x, y }) => ({
    tableId: table.tableId,
    x: Math.round(x - minX + MARGIN),
    y: Math.round(y - minY + MARGIN),
    width: NODE_WIDTH,
    height: nodeHeight(project, table),
  }))
}

export async function renderDeterministicDiagramSvg(project: SchemaProject): Promise<string> {
  const nodes = await layoutDeterministicSchema(project)
  const nodeById = new Map(nodes.map((node) => [node.tableId, node]))
  const maxX = Math.max(960, ...nodes.map((node) => node.x + node.width + MARGIN))
  const maxY = Math.max(540, ...nodes.map((node) => node.y + node.height + MARGIN))
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  // 이름과 참조 표시가 한 줄(236px)에 겹치지 않게 앱처럼 말줄임한다.
  const clip = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 1)}…` : value
  const font = 'Pretendard, Malgun Gothic, Arial, sans-serif'
  const portY = (table: DiagramTable, node: DeterministicDiagramNode, columnIds: readonly string[]) => {
    const visible = keyColumnsOf(project, table)
    const index = Math.max(0, visible.findIndex((column) => columnIds.includes(column.columnId)))
    return node.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2
  }
  const usedLanes: number[] = []
  const arrivals = new Map<string, number>()
  const lines = project.relations.map((relation, relationIndex) => {
    const source = nodeById.get(relation.sourceTableId)
    const target = nodeById.get(relation.targetTableId)
    const sourceTable = project.tables.find((table) => table.tableId === relation.sourceTableId)
    const targetTable = project.tables.find((table) => table.tableId === relation.targetTableId)
    if (!source || !target || !sourceTable || !targetTable) return ''
    const color = RELATION_COLORS[relationIndex % RELATION_COLORS.length]
    const sy = portY(sourceTable, source, relation.sourceColumnIds)
    // 같은 열로 여러 선이 들어오면 도착점을 위아래로 조금씩 벌려 구분되게 한다.
    const arrivalKey = `${relation.targetTableId}:${relation.targetColumnIds.join(',')}`
    const arrivalOrder = arrivals.get(arrivalKey) ?? 0
    arrivals.set(arrivalKey, arrivalOrder + 1)
    const ty = portY(targetTable, target, relation.targetColumnIds) + (arrivalOrder % 2 === 0 ? 1 : -1) * Math.ceil(arrivalOrder / 2) * 5
    const forward = target.x >= source.x + source.width / 2
    const sx = forward ? source.x + source.width : source.x
    const tx = forward ? target.x : target.x + target.width
    const obstacles = nodes.filter((node) => node.tableId !== source.tableId && node.tableId !== target.tableId)
    const path = routeRelation(sx, sy, tx, ty, obstacles, usedLanes)
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" marker-end="url(#arrow-${relationIndex % RELATION_COLORS.length})"/>`
  }).join('')
  const cards = project.tables.map((table) => {
    const node = nodeById.get(table.tableId)
    if (!node) return ''
    const visible = keyColumnsOf(project, table)
    const hidden = table.columns.length - visible.length
    const rows = visible.map((column, index) => {
      const pk = table.primaryKey.columnIds.includes(column.columnId)
      const fkRelation = project.relations.find((relation) => relation.sourceColumnIds.includes(column.columnId))
      const fk = Boolean(fkRelation)
      const fkTargetTable = fkRelation ? project.tables.find((item) => item.tableId === fkRelation.targetTableId) : undefined
      const fkTargetColumn = fkTargetTable?.columns.find((item) => fkRelation?.targetColumnIds.includes(item.columnId))
      const fkLabel = fkTargetTable && fkTargetColumn ? `→ ${fkTargetTable.name}.${fkTargetColumn.name}` : ''
      const fkColor = fkRelation ? RELATION_COLORS[project.relations.indexOf(fkRelation) % RELATION_COLORS.length] : '#718096'
      const y = node.y + HEADER_HEIGHT + index * ROW_HEIGHT
      const badge = pk ? 'PK' : fk ? 'FK' : ''
      const badgeColor = pk ? '#c7772a' : '#3f6fa8'
      return `<rect x="${node.x}" y="${y}" width="${node.width}" height="${ROW_HEIGHT}" fill="${index % 2 === 0 ? '#ffffff' : '#f4f7fa'}"/>`
        + (badge ? `<rect x="${node.x + 8}" y="${y + 7}" width="22" height="14" rx="3" fill="${badgeColor}"/><text x="${node.x + 19}" y="${y + 18}" text-anchor="middle" font-size="9" font-weight="700" font-family="${font}" fill="#fff">${badge}</text>` : '')
        + `<text x="${node.x + 38}" y="${y + 18}" font-size="12" font-weight="${pk ? 700 : 500}" font-family="${font}" fill="#203248">${escape(fkLabel ? clip(column.name, 14) : clip(column.name, 24))}</text>`
        + `<text x="${node.x + node.width - 10}" y="${y + 18}" text-anchor="end" font-size="11" font-family="${font}" fill="${fkLabel ? fkColor : '#718096'}">${escape(fkLabel ? clip(fkLabel, 18) : column.dataType.kind)}</text>`
    }).join('')
    const more = hidden > 0
      ? `<text x="${node.x + node.width / 2}" y="${node.y + HEADER_HEIGHT + visible.length * ROW_HEIGHT + 16}" text-anchor="middle" font-size="11" font-family="${font}" fill="#718096">+ ${hidden}개 열</text>`
      : ''
    return `<g><rect x="${node.x}" y="${node.y}" rx="6" width="${node.width}" height="${node.height}" fill="#fff" stroke="#8ca0b3"/><rect x="${node.x}" y="${node.y}" rx="6" width="${node.width}" height="${HEADER_HEIGHT}" fill="#49677f"/><text x="${node.x + 12}" y="${node.y + 22}" font-size="13" font-weight="700" font-family="${font}" fill="#fff">${escape(table.name)}</text>${rows}${more}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#f8fafc"/><defs>${RELATION_COLORS.map((color, index) => `<marker id="arrow-${index}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${color}"/></marker>`).join('')}</defs>${lines}${cards}</svg>`
}

export async function buildIntegratedWorkbook(
  document: WorkbenchDocument,
  options: WorkbookExportOptions,
): Promise<{ readonly bytes: Uint8Array; readonly manifest: WorkbookExportManifest }> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Game Schema Workbench'
  workbook.title = document.schema.name
  workbook.subject = `Schema revision ${document.revision}`
  workbook.created = new Date(0)
  workbook.modified = new Date(0)
  workbook.calcProperties.fullCalcOnLoad = false

  const description = workbook.addWorksheet(DOCUMENTATION_SHEET_NAME)
  buildDocumentationSheet(description, document)

  const diagram = workbook.addWorksheet(DIAGRAM_SHEET_NAME, { views: [{ showGridLines: false }] })
  diagram.properties.tabColor = { argb: DOCUMENT_COLORS.accent }
  diagram.getCell('A1').value = '테이블 구조도'
  diagram.getCell('A1').font = { bold: true, size: 16 }
  if (options.includeDiagram && options.diagramPngDataUrl) {
    const imageId = workbook.addImage({ base64: options.diagramPngDataUrl, extension: 'png' })
    const width = 1400
    const height = Math.min(900, Math.max(420, Math.round(width / (options.diagramAspectRatio ?? 1.7))))
    diagram.addImage(imageId, { tl: { col: 0, row: 2 }, ext: { width, height } })
  } else {
    diagram.getCell('A3').value = '구조도 이미지를 생성할 수 없어 테이블 목록으로 대체했습니다.'
    document.schema.tables.forEach((table, index) => { diagram.getCell(index + 5, 1).value = table.name })
  }

  const usedNames = new Set<string>([DOCUMENTATION_SHEET_NAME.toLocaleLowerCase(), DIAGRAM_SHEET_NAME.toLocaleLowerCase()])
  const tableSheetNames: Record<EntityId, string> = {}
  if (options.includeData) {
    for (const table of document.schema.tables) {
      const sheetName = sanitizeWorksheetName(table.name, usedNames)
      usedNames.add(sheetName.toLocaleLowerCase())
      tableSheetNames[table.tableId] = sheetName
      const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 2 }] })
      sheet.addRow(table.columns.map((column) => column.name))
      sheet.addRow(table.columns.map((column) => column.dataType.kind))
      const rows = document.rowsByTable[table.tableId] ?? []
      for (const row of rows) {
        sheet.addRow(table.columns.map((column) => toWorkbookCellValue(column.dataType.kind, row.cells[column.columnId])))
      }
      table.columns.forEach((column, index) => {
        const cell = sheet.getCell(1, index + 1)
        const pk = table.primaryKey.columnIds.includes(column.columnId)
        const fk = document.schema.relations.some((relation) => relation.sourceColumnIds.includes(column.columnId))
        cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pk ? 'FFC48210' : fk ? 'FF2368A0' : 'FF52677B' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = THIN_DOCUMENT_BORDER

        const typeCell = sheet.getCell(2, index + 1)
        // FK 열은 무엇을 참조하는지 머리글 메모에 적는다. 2행은 자료형만 둔다(변환 도구가 읽는 줄).
        const fkRelation = document.schema.relations.find((relation) => relation.sourceColumnIds.includes(column.columnId))
        const fkTarget = fkRelation ? document.schema.tables.find((item) => item.tableId === fkRelation.targetTableId) : undefined
        const fkTargetColumn = fkTarget?.columns.find((item) => fkRelation?.targetColumnIds.includes(item.columnId))
        if (fkTarget && fkTargetColumn) {
          cell.note = `참조: ${fkTarget.name}.${fkTargetColumn.name}`
        }
        typeCell.font = { name: '맑은 고딕', size: 9, color: { argb: DOCUMENT_COLORS.muted } }
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DATA_TYPE_ROW_COLOR } }
        typeCell.alignment = { vertical: 'middle', horizontal: 'center' }
        typeCell.border = THIN_DOCUMENT_BORDER

        sheet.getColumn(index + 1).width = Math.max(12, Math.min(36, Math.max(column.name.length, String(typeCell.value ?? '').length) + 6))
        if (column.dataType.kind === 'date') sheet.getColumn(index + 1).numFmt = 'yyyy-mm-dd'
        if (column.dataType.kind === 'datetime') sheet.getColumn(index + 1).numFmt = 'yyyy-mm-dd hh:mm:ss'
      })
      for (let rowIndex = 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const workbookRow = sheet.getRow(rowIndex)
        workbookRow.height = 15
        for (let columnIndex = 1; columnIndex <= table.columns.length; columnIndex += 1) {
          workbookRow.getCell(columnIndex).alignment = { vertical: 'middle', horizontal: 'center' }
        }
      }
    }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const fileName = `${document.schema.name.replace(INVALID_SHEET_CHARACTERS, '_')}.xlsx`
  return {
    bytes,
    manifest: {
      fileName,
      sheetNames: workbook.worksheets.map((sheet) => sheet.name),
      tableSheetNames,
      revision: document.revision,
    },
  }
}
