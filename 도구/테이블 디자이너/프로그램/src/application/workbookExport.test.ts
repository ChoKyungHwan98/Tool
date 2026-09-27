import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { createWorkbenchDocument } from './workbenchDocument'
import { buildIntegratedWorkbook, layoutDeterministicSchema, sanitizeWorksheetName } from './workbookExport'
import { gameCSampleProject, gameCSampleRows } from '../domain/gameCSampleProject'

describe('통합 Excel 내보내기', () => {
  it('설명·규격·구조도·테이블별 시트를 결정적인 순서로 만든다', async () => {
    const document = createWorkbenchDocument(gameCSampleProject, gameCSampleRows)
    const first = await buildIntegratedWorkbook(document, { includeDiagram: false, includeData: true })
    const second = await buildIntegratedWorkbook(document, { includeDiagram: false, includeData: true })

    expect(first.manifest.sheetNames).toEqual([
      '1. 테이블 설명 및 규격',
      '2. 테이블 구조도',
      ...gameCSampleProject.tables.map((table) => table.name),
    ])
    expect(first.manifest.sheetNames).toEqual(second.manifest.sheetNames)
    expect(await layoutDeterministicSchema(gameCSampleProject)).toEqual(await layoutDeterministicSchema(gameCSampleProject))

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(first.bytes as never)
    const documentationSheet = workbook.getWorksheet('1. 테이블 설명 및 규격')!
    expect(documentationSheet.getCell('A1').value).toBe(gameCSampleProject.name)
    expect(documentationSheet.getCell('A2').value).toBe('테이블 설명 및 규격')
    expect(documentationSheet.getCell('A4').value).toBe('테이블 설명')
    expect(documentationSheet.getRow(5).values).toEqual([undefined, '테이블명', '설명', '설명', '설명', '설명', '설명', '설명'])

    const specificationSectionRow = 7 + gameCSampleProject.tables.length
    const specificationHeaderRow = specificationSectionRow + 1
    const firstSpecificationRow = specificationHeaderRow + 1
    expect(documentationSheet.getCell(specificationSectionRow, 1).value).toBe('테이블 규격')
    expect(documentationSheet.getRow(specificationHeaderRow).values).toEqual([
      undefined,
      '테이블명',
      '칼럼명',
      '한글명',
      '자료형',
      '키',
      '참조',
      '설명',
    ])
    expect(documentationSheet.getRow(firstSpecificationRow).values).toEqual([
      undefined,
      'ItemType',
      'ItemTypeId',
      '',
      'string',
      'PK',
      '',
      '',
    ])
    // FK 칼럼은 참조 칸에 '테이블.칼럼'이 적힌다.
    const itemTypeIdReference = documentationSheet.getColumn(6).values.find((value) => value === 'ItemType.ItemTypeId')
    expect(itemTypeIdReference).toBe('ItemType.ItemTypeId')
    expect(documentationSheet.columns.map((column) => column.width)).toEqual([22, 24, 16, 12, 8, 28, 48])
    expect(documentationSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2, showGridLines: false })
    expect(documentationSheet.pageSetup).toMatchObject({
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    })
    expect(documentationSheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF18324A' } })
    expect(documentationSheet.getCell('A4').fill).toMatchObject({ fgColor: { argb: 'FF405E73' } })
    expect(documentationSheet.getCell(specificationHeaderRow, 1).fill).toMatchObject({ fgColor: { argb: 'FFDCE7ED' } })
    expect(documentationSheet.properties.tabColor).toEqual({ argb: 'FF18324A' })
    expect(workbook.getWorksheet('2. 테이블 구조도')!.properties.tabColor).toEqual({ argb: 'FF0E7782' })

    const itemSheet = workbook.getWorksheet('Item')!
    expect(itemSheet.getCell('A1').value).toBe('ItemId')
    expect(itemSheet.getCell('B1').value).toBe('ItemTypeId')
    expect(itemSheet.getCell('A2').value).toBe('string')
    expect(itemSheet.getCell('B2').value).toBe('string')
    expect(itemSheet.getCell('A3').value).toBe('bronze_sword')
    expect(itemSheet.getCell('B3').value).toBe('weapon')
    expect(itemSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 })
    expect(itemSheet.autoFilter).toBeUndefined()
    expect(itemSheet.getRow(1).height).toBe(15)
    expect(itemSheet.getRow(2).height).toBe(15)
    expect(itemSheet.getRow(3).height).toBe(15)
    expect(itemSheet.getCell('A1').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' })
    expect(itemSheet.getCell('A2').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' })
    expect(itemSheet.getCell('A3').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' })
    expect(itemSheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFC48210' } })
    expect(itemSheet.getCell('B1').fill).toMatchObject({ fgColor: { argb: 'FF2368A0' } })
    expect(itemSheet.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFE8EDF2' } })

    const itemTypeSheet = workbook.getWorksheet('ItemType')!
    expect(itemTypeSheet.getRow(1).values).toEqual([undefined, 'ItemTypeId', 'Name'])
    expect(itemTypeSheet.getRow(2).values).toEqual([undefined, 'string', 'string'])
    expect(itemTypeSheet.getRow(3).values).toEqual([undefined, 'weapon', '무기'])
    expect(itemTypeSheet.getRow(4).values).toEqual([undefined, 'consumable', '소모품'])
  })

  it('31자·금지 문자·중복 시트명을 안정적으로 정리한다', () => {
    const used = new Set<string>()
    const first = sanitizeWorksheetName('Very/Long:Table*Name?With[Forbidden]Characters', used)
    used.add(first.toLocaleLowerCase())
    const second = sanitizeWorksheetName('Very/Long:Table*Name?With[Forbidden]Characters', used)
    expect(first.length).toBeLessThanOrEqual(31)
    expect(first).not.toMatch(/[\\/?*[\]:]/)
    expect(second).not.toBe(first)
  })
})
