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

function styleSectionRow(row: Row, label: string): void {
  row.getCell(1).value = label
  row.height = 26
  for (let column = 1; column <= 4; column += 1) {
    const cell = row.getCell(column)
    fillCell(cell, DOCUMENT_COLORS.section)
    cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: DOCUMENT_COLORS.white } }
    cell.alignment = { vertical: 'middle', horizontal: column === 1 ? 'left' : 'center' }
  }
}

function styleHeaderRow(row: Row): void {
  row.height = 24
  for (let column = 1; column <= 4; column += 1) {
    const cell = row.getCell(column)
    fillCell(cell, DOCUMENT_COLORS.header)
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: DOCUMENT_COLORS.text } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = THIN_DOCUMENT_BORDER
  }
}

function styleBodyRow(row: Row, background: string): void {
  for (let column = 1; column <= 4; column += 1) {
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
    { width: 24 },
    { width: 28 },
    { width: 16 },
    { width: 68 },
  ]
  sheet.pageSetup.orientation = 'landscape'
  sheet.pageSetup.paperSize = 9
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
  sheet.pageSetup.horizontalCentered = true
  sheet.pageSetup.margins = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  sheet.headerFooter.oddFooter = '&LGame Schema Workbench&C&P / &N'

  sheet.mergeCells('A1:D1')
  const title = sheet.getCell('A1')
  title.value = document.schema.name
  title.font = { name: '맑은 고딕', bold: true, size: 18, color: { argb: DOCUMENT_COLORS.white } }
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(title, DOCUMENT_COLORS.title)
  sheet.getRow(1).height = 36
  for (let column = 2; column <= 4; column += 1) fillCell(sheet.getRow(1).getCell(column), DOCUMENT_COLORS.title)

  sheet.mergeCells('A2:D2')
  const subtitle = sheet.getCell('A2')
  subtitle.value = '테이블 설명 및 규격'
  subtitle.font = { name: '맑은 고딕', bold: true, size: 11, color: { argb: DOCUMENT_COLORS.accent } }
  subtitle.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(subtitle, DOCUMENT_COLORS.accentSurface)
  sheet.getRow(2).height = 24
  for (let column = 2; column <= 4; column += 1) fillCell(sheet.getRow(2).getCell(column), DOCUMENT_COLORS.accentSurface)

  sheet.getRow(3).height = 10
  styleSectionRow(sheet.getRow(4), '테이블 설명')
  sheet.mergeCells('A4:D4')

  const descriptionHeader = sheet.getRow(5)
  descriptionHeader.values = ['테이블명', '설명']
  sheet.mergeCells('B5:D5')
  styleHeaderRow(descriptionHeader)

  let currentRow = 6
  document.schema.tables.forEach((table, tableIndex) => {
    const row = sheet.getRow(currentRow)
    row.getCell(1).value = table.name
    row.getCell(2).value = table.description
    sheet.mergeCells(currentRow, 2, currentRow, 4)
    styleBodyRow(row, tableIndex % 2 === 0 ? DOCUMENT_COLORS.white : DOCUMENT_COLORS.alternate)
    row.getCell(1).font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: DOCUMENT_COLORS.accent } }
    row.height = descriptionRowHeight(table.description)
    currentRow += 1
  })

  sheet.getRow(currentRow).height = 12
  currentRow += 1
  styleSectionRow(sheet.getRow(currentRow), '테이블 규격')
  sheet.mergeCells(currentRow, 1, currentRow, 4)
  currentRow += 1

  const specificationHeader = sheet.getRow(currentRow)
  specificationHeader.values = ['테이블명', '칼럼명', '자료형', '설명']
  styleHeaderRow(specificationHeader)
  currentRow += 1

  document.schema.tables.forEach((table, tableIndex) => {
    const columns = table.columns.length > 0 ? table.columns : [null]
    const firstRow = currentRow
    const background = tableIndex % 2 === 0 ? DOCUMENT_COLORS.white : DOCUMENT_COLORS.alternate
    for (const column of columns) {
      const row = sheet.getRow(currentRow)
      row.getCell(1).value = currentRow === firstRow ? table.name : ''
      row.getCell(2).value = column?.name ?? ''
      row.getCell(3).value = column?.dataType.kind ?? ''
      row.getCell(4).value = column?.description ?? ''
      styleBodyRow(row, background)
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

  sheet.pageSetup.printArea = `A1:D${Math.max(1, currentRow - 1)}`
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

export async function layoutDeterministicSchema(project: SchemaProject): Promise<readonly DeterministicDiagramNode[]> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const tables = project.tables.slice().sort((left, right) => left.tableId.localeCompare(right.tableId))
  const graph = {
    id: 'workbook-schema',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '70',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.randomSeed': '1',
    },
    children: tables.map((table) => ({
      id: table.tableId,
      width: 260,
      height: 42 + Math.min(table.columns.length, 10) * 25,
    })),
    edges: project.relations
      .slice()
      .sort((left, right) => left.relationId.localeCompare(right.relationId))
      .map((relation) => ({
        id: relation.relationId,
        sources: [relation.sourceTableId],
        targets: [relation.targetTableId],
      })),
  }
  const result = await new ELK().layout(graph)
  return (result.children ?? []).map((node) => ({
    tableId: node.id,
    x: Math.round((node.x ?? 0) + 40),
    y: Math.round((node.y ?? 0) + 40),
    width: Math.round(node.width ?? 260),
    height: Math.round(node.height ?? 92),
  }))
}

export async function renderDeterministicDiagramSvg(project: SchemaProject): Promise<string> {
  const nodes = await layoutDeterministicSchema(project)
  const nodeById = new Map(nodes.map((node) => [node.tableId, node]))
  const maxX = Math.max(960, ...nodes.map((node) => node.x + node.width + 40))
  const maxY = Math.max(540, ...nodes.map((node) => node.y + node.height + 40))
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const lines = project.relations.slice().sort((a, b) => a.relationId.localeCompare(b.relationId)).map((relation) => {
    const source = nodeById.get(relation.sourceTableId)
    const target = nodeById.get(relation.targetTableId)
    const sourceTable = project.tables.find((table) => table.tableId === relation.sourceTableId)
    const targetTable = project.tables.find((table) => table.tableId === relation.targetTableId)
    if (!source || !target || !sourceTable || !targetTable) return ''
    const sourceIndex = Math.max(0, sourceTable.columns.findIndex((column) => relation.sourceColumnIds.includes(column.columnId)))
    const targetIndex = Math.max(0, targetTable.columns.findIndex((column) => relation.targetColumnIds.includes(column.columnId)))
    const sx = source.x + source.width
    const sy = source.y + 42 + sourceIndex * 25 + 12
    const tx = target.x
    const ty = target.y + 42 + targetIndex * 25 + 12
    const middle = Math.round((sx + tx) / 2)
    return `<path d="M ${sx} ${sy} H ${middle} V ${ty} H ${tx}" fill="none" stroke="#54758b" stroke-width="2" marker-end="url(#arrow)"/>`
  }).join('')
  const cards = project.tables.map((table) => {
    const node = nodeById.get(table.tableId)!
    const columns = table.columns.slice(0, 10).map((column, index) => {
      const pk = table.primaryKey.columnIds.includes(column.columnId)
      const fk = project.relations.some((relation) => relation.sourceColumnIds.includes(column.columnId))
      return `<rect x="${node.x}" y="${node.y + 42 + index * 25}" width="${node.width}" height="25" fill="${index % 2 === 0 ? '#ffffff' : '#f1f5f8'}"/><text x="${node.x + 12}" y="${node.y + 59 + index * 25}" font-size="12" font-family="Arial, sans-serif" fill="#203248">${pk ? 'PK ' : ''}${fk ? 'FK ' : ''}${escape(column.name)}</text><text x="${node.x + node.width - 10}" y="${node.y + 59 + index * 25}" text-anchor="end" font-size="11" font-family="Arial, sans-serif" fill="#718096">${escape(column.dataType.kind)}</text>`
    }).join('')
    return `<g><rect x="${node.x}" y="${node.y}" rx="5" width="${node.width}" height="${node.height}" fill="#fff" stroke="#8ca0b3"/><rect x="${node.x}" y="${node.y}" rx="5" width="${node.width}" height="42" fill="#49677f"/><text x="${node.x + 12}" y="${node.y + 26}" font-size="15" font-weight="700" font-family="Arial, sans-serif" fill="#fff">${escape(table.name)}</text>${columns}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#f8fafc"/><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#54758b"/></marker></defs>${lines}${cards}</svg>`
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
        typeCell.font = { name: '맑은 고딕', size: 9, color: { argb: DOCUMENT_COLORS.muted } }
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DATA_TYPE_ROW_COLOR } }
        typeCell.alignment = { vertical: 'middle', horizontal: 'center' }
        typeCell.border = THIN_DOCUMENT_BORDER

        sheet.getColumn(index + 1).width = Math.max(12, Math.min(36, Math.max(column.name.length, column.dataType.kind.length) + 6))
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
