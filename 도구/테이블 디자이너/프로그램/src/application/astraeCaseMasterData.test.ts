import { describe, expect, it } from 'vitest'
import projectText from '../../examples/astrae-territory-case-001/Astrae-Oratio-CASE001.gsw?raw'
import caseDifficultyTableCsv from '../../examples/astrae-territory-case-001/export/csv/CaseDifficultyTable.csv?raw'
import caseFlowTableCsv from '../../examples/astrae-territory-case-001/export/csv/CaseFlowTable.csv?raw'
import caseRewardTableCsv from '../../examples/astrae-territory-case-001/export/csv/CaseRewardTable.csv?raw'
import caseTableCsv from '../../examples/astrae-territory-case-001/export/csv/CaseTable.csv?raw'
import caseUnlockTableCsv from '../../examples/astrae-territory-case-001/export/csv/CaseUnlockTable.csv?raw'
import scenarioCommandTableCsv from '../../examples/astrae-territory-case-001/export/csv/ScenarioCommandTable.csv?raw'
import type { DataRow, SchemaTable, WorkbenchDocument } from '../domain/schema'
import { validateProjectWithRows } from '../domain/validator'
import { deserializeDocument, serializeDocument } from '../infrastructure/projectPersistence'
import { serializeTableRowsToCsv } from './csvImportExport'

const csvByTableName: Readonly<Record<string, string>> = {
  CaseDifficultyTable: caseDifficultyTableCsv,
  CaseFlowTable: caseFlowTableCsv,
  CaseRewardTable: caseRewardTableCsv,
  CaseTable: caseTableCsv,
  CaseUnlockTable: caseUnlockTableCsv,
  ScenarioCommandTable: scenarioCommandTableCsv,
}

function loadDocument(): WorkbenchDocument {
  const result = deserializeDocument(projectText)
  expect(result.ok, result.error).toBe(true)
  expect(result.document).toBeDefined()
  return result.document as WorkbenchDocument
}

function requireTable(document: WorkbenchDocument, name: string): SchemaTable {
  const table = document.schema.tables.find((candidate) => candidate.name === name)
  expect(table, `${name} table should exist`).toBeDefined()
  return table as SchemaTable
}

function nameKeyedRow(table: SchemaTable, row: DataRow): Record<string, unknown> {
  return Object.fromEntries(table.columns.map((column) => [column.name, row.cells[column.columnId] ?? null]))
}

function nameKeyedRows(document: WorkbenchDocument, tableName: string): readonly Record<string, unknown>[] {
  const table = requireTable(document, tableName)
  return (document.rowsByTable[table.tableId] ?? []).map((row) => nameKeyedRow(table, row))
}

describe('Astrae Oratio CASE_001 content master data', () => {
  it('opens as a complete v2 WorkbenchDocument with the compact content schema v9', () => {
    const document = loadDocument()

    expect(document.formatVersion).toBe(2)
    expect(document.schema.schemaVersion).toBe('9.0.0')
    expect(document.schema.tables.map((table) => table.name)).toEqual([
      'CaseTable',
      'CaseUnlockTable',
      'CaseFlowTable',
      'ScenarioCommandTable',
      'CaseDifficultyTable',
      'CaseRewardTable',
    ])
    expect(document.schema.relations).toHaveLength(6)
    expect(Object.values(document.rowsByTable).flat()).toHaveLength(15)

    const reopened = deserializeDocument(serializeDocument(document))
    expect(reopened.ok, reopened.error).toBe(true)
    expect(reopened.document).toEqual(document)
  })

  it('stores every cell by immutable ColumnId and passes the native validator', () => {
    const document = loadDocument()
    const allColumnIds = new Set(document.schema.tables.flatMap((table) => table.columns.map((column) => column.columnId)))

    for (const row of Object.values(document.rowsByTable).flat()) {
      expect(Object.keys(row.cells).every((columnId) => allColumnIds.has(columnId))).toBe(true)
    }

    expect(validateProjectWithRows(document.schema, document.rowsByTable)).toEqual([])
  })

  it('uses a first-column numeric id as the only PK and one-column numeric FKs', () => {
    const document = loadDocument()

    for (const table of document.schema.tables) {
      expect(table.columns[0]).toMatchObject({ name: 'id', dataType: { kind: 'int32' }, nullable: false })
      expect(table.primaryKey.columnIds).toEqual([table.columns[0]?.columnId])
    }

    for (const relation of document.schema.relations) {
      expect(relation.sourceColumnIds).toHaveLength(1)
      expect(relation.targetColumnIds).toHaveLength(1)
      const target = document.schema.tables.find((table) => table.tableId === relation.targetTableId)
      expect(relation.targetColumnIds).toEqual([target?.columns[0]?.columnId])
    }
  })

  it('preserves immutable IDs when existing concepts receive clearer names', () => {
    const document = loadDocument()
    const unlock = requireTable(document, 'CaseUnlockTable')
    const flow = requireTable(document, 'CaseFlowTable')
    const difficulty = requireTable(document, 'CaseDifficultyTable')
    const reward = requireTable(document, 'CaseRewardTable')

    expect(unlock.tableId).toBe('tbl_content_unlock_condition_entry')
    expect(unlock.columns.find((column) => column.name === 'unlockType')?.columnId).toBe('col_content_unlock_condition_entry_condition_type')
    expect(unlock.columns.find((column) => column.name === 'requiredCaseId')?.columnId).toBe('col_content_unlock_condition_entry_target_case_id')
    expect(flow.tableId).toBe('tbl_content_case_step')
    expect(flow.columns.find((column) => column.name === 'flowType')?.columnId).toBe('col_content_case_step_step_type')
    expect(difficulty.tableId).toBe('tbl_content_case_difficulty')
    expect(difficulty.columns.find((column) => column.name === 'caseFlowId')?.columnId).toBe('col_content_case_difficulty_case_step_id')
    expect(reward.tableId).toBe('tbl_content_reward_entry')
  })

  it('contains actual CASE UI text without region or documentation-only columns', () => {
    const document = loadDocument()
    const [caseRow] = nameKeyedRows(document, 'CaseTable')
    const removedColumns = new Set(['description', 'displayName', 'sourceStatus', 'designStatus', 'region'])

    expect(caseRow).toEqual({
      id: 1010001,
      name: '결투재판 효력분쟁',
      summaryText: '과거 결투재판으로 종결된 영지분쟁의 효력이 현재의 행정 기반 영지질서에 어디까지 미치는지를 둘러싼 사건.',
      issueText: '제4시대부터 이어진 결투재판과 제5시대 이후 성립한 행정 기반 영지질서가 현대에 공존하면서, 과거 판단의 효력을 현재 영지질서가 어디까지 인정할지가 쟁점이다.',
    })

    for (const table of document.schema.tables) {
      expect(table.columns.map((column) => column.name).filter((name) => removedColumns.has(name))).toEqual([])
    }
  })

  it('uses a compact unlockType and optional requiredCaseId', () => {
    const document = loadDocument()
    const [unlock] = nameKeyedRows(document, 'CaseUnlockTable')

    expect(unlock).toEqual({
      id: 1100001,
      caseId: 1010001,
      unlockType: 'MAIN_STORY_UNLOCK',
      requiredCaseId: null,
    })
  })

  it('stores SCENARIO → BATTLE → SCENARIO as the CASE progression outline', () => {
    const document = loadDocument()
    const flows = nameKeyedRows(document, 'CaseFlowTable')
      .toSorted((left, right) => Number(left.sequence) - Number(right.sequence))

    expect(flows).toEqual([
      { id: 1040001, caseId: 1010001, sequence: 1, flowType: 'SCENARIO' },
      { id: 1040002, caseId: 1010001, sequence: 2, flowType: 'BATTLE' },
      { id: 1040003, caseId: 1010001, sequence: 3, flowType: 'SCENARIO' },
    ])
    expect(new Set(flows.map((flow) => `${flow.caseId}:${flow.sequence}`)).size).toBe(flows.length)
  })

  it('links executable scenario commands directly to SCENARIO flows', () => {
    const document = loadDocument()
    const commands = nameKeyedRows(document, 'ScenarioCommandTable')

    expect(commands).toHaveLength(4)
    expect(document.schema.tables.map((table) => table.name)).not.toContain('ScenarioTable')
    expect(document.schema.tables.map((table) => table.name)).not.toContain('CaseParticipantTable')

    for (const flowId of [1040001, 1040003]) {
      const ordered = commands
        .filter((command) => command.caseFlowId === flowId)
        .toSorted((left, right) => Number(left.sequence) - Number(right.sequence))
      expect(ordered.map((command) => command.sequence)).toEqual([1, 2])
    }

    for (const command of commands) {
      if (command.commandType === 'DIALOGUE') {
        expect(command.speakerName).toBeNull()
        expect(command.text).toBe('(미정)')
        expect(command.resourceKey).toBeNull()
      } else {
        expect(command.commandType).toBe('CHARACTER')
        expect(command.resourceKey).toBe('MAMIYA_RITSU_STANDING')
        expect(command.speakerName).toBeNull()
        expect(command.text).toBeNull()
      }
    }
    expect(JSON.stringify(commands)).not.toMatch(/결국 내 선|네 선이 어디까지|판결을 없애겠다는|그어진 선/)
  })

  it('stores the three difficulty buttons directly on the BATTLE flow', () => {
    const document = loadDocument()
    const difficulties = nameKeyedRows(document, 'CaseDifficultyTable')
      .toSorted((left, right) => Number(left.sortOrder) - Number(right.sortOrder))

    expect(difficulties).toEqual([
      { id: 1050001, caseFlowId: 1040002, difficultyType: 'EASY', sortOrder: 1, isImplemented: false },
      { id: 1050002, caseFlowId: 1040002, difficultyType: 'NORMAL', sortOrder: 2, isImplemented: true },
      { id: 1050003, caseFlowId: 1040002, difficultyType: 'HARD', sortOrder: 3, isImplemented: false },
    ])
    expect(document.schema.tables.map((table) => table.name)).not.toContain('DifficultyTable')
    expect(document.schema.tables.map((table) => table.name)).not.toContain('BattleTable')
  })

  it('links the requested GOLD mock rewards directly to each CASE difficulty', () => {
    const document = loadDocument()

    expect(document.schema.tables.map((table) => table.name)).not.toContain('RewardGroupTable')
    expect(nameKeyedRows(document, 'CaseRewardTable')).toEqual([
      { id: 1090001, caseDifficultyId: 1050001, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 1 },
      { id: 1090002, caseDifficultyId: 1050002, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 2 },
      { id: 1090003, caseDifficultyId: 1050003, rewardType: 'CURRENCY', rewardCode: 'GOLD', amount: 3 },
    ])
  })

  it('matches every CSV artifact to the application ColumnId-based serializer', () => {
    const document = loadDocument()

    for (const table of document.schema.tables) {
      const expected = serializeTableRowsToCsv(table, document.rowsByTable[table.tableId] ?? [])
      const exported = csvByTableName[table.name]?.trimEnd()
      expect(exported).toBe(expected)
    }
  })
})
