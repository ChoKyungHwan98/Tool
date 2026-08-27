import readXlsxFile from 'read-excel-file/browser'
import { parseCsv } from '../application/csvImportExport'
import type { ImportCell, RawImportSheet } from '../application/importPreview'

export async function readImportFiles(files: readonly File[]): Promise<readonly RawImportSheet[]> {
  const sheets: RawImportSheet[] = []

  for (const file of files) {
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.csv')) {
      const parsed = parseCsv(await file.text())
      sheets.push({
        sourceName: file.name,
        sheetName: file.name.replace(/\.csv$/i, ''),
        rows: [
          [...parsed.headers],
          ...parsed.rows.map((row) => parsed.headers.map((header) => row[header] ?? '')),
        ],
      })
      continue
    }

    if (lowerName.endsWith('.xlsx')) {
      const workbookSheets = await readXlsxFile(file)
      sheets.push(...workbookSheets.map((sheet) => ({
        sourceName: file.name,
        sheetName: sheet.sheet,
        rows: sheet.data as readonly (readonly ImportCell[])[],
      })))
      continue
    }

    throw new Error(`${file.name}은(는) 지원하지 않는 형식입니다. CSV 또는 XLSX 파일을 선택하세요.`)
  }

  return sheets
}
