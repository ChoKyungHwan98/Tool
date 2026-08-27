import { describe, expect, it } from 'vitest'
import contentProjectText from '../../examples/astrae-territory-case-001/Astrae-Oratio-CASE001.gsw?raw'
import combatProjectText from '../../examples/astrae-case001-combat/Astrae-Oratio-CASE001-Combat.gsw?raw'
import battleTableCsv from '../../examples/astrae-case001-combat/export/csv/BattleTable.csv?raw'
import bossActionTableCsv from '../../examples/astrae-case001-combat/export/csv/BossActionTable.csv?raw'
import bossTableCsv from '../../examples/astrae-case001-combat/export/csv/BossTable.csv?raw'
import characterActionTableCsv from '../../examples/astrae-case001-combat/export/csv/CharacterActionTable.csv?raw'
import characterTableCsv from '../../examples/astrae-case001-combat/export/csv/CharacterTable.csv?raw'
import combatRuleTableCsv from '../../examples/astrae-case001-combat/export/csv/CombatRuleTable.csv?raw'
import type { DataRow, SchemaTable, WorkbenchDocument } from '../domain/schema'
import { validateProjectWithRows } from '../domain/validator'
import { deserializeDocument, serializeDocument } from '../infrastructure/projectPersistence'
import { serializeTableRowsToCsv } from './csvImportExport'

const csvByTableName: Readonly<Record<string, string>> = {
  BattleTable: battleTableCsv,
  BossActionTable: bossActionTableCsv,
  BossTable: bossTableCsv,
  CharacterActionTable: characterActionTableCsv,
  CharacterTable: characterTableCsv,
  CombatRuleTable: combatRuleTableCsv,
}

function loadDocument(text: string): WorkbenchDocument {
  const result = deserializeDocument(text)
  expect(result.ok, result.error).toBe(true)
  expect(result.document).toBeDefined()
  return result.document as WorkbenchDocument
}

function requireTable(document: WorkbenchDocument, name: string): SchemaTable {
  const table = document.schema.tables.find((candidate) => candidate.name === name)
  expect(table, `${name} table should exist`).toBeDefined()
  return table as SchemaTable
}

function nameKeyedRows(document: WorkbenchDocument, tableName: string): readonly Record<string, unknown>[] {
  const table = requireTable(document, tableName)
  return (document.rowsByTable[table.tableId] ?? []).map((row) => Object.fromEntries(
    table.columns.map((column) => [column.name, row.cells[column.columnId] ?? null]),
  ))
}

describe('Astrae Oratio CASE_001 combat and character data', () => {
  it('opens as a complete v2 document with normalized schema v6 and passes native validation', () => {
    const document = loadDocument(combatProjectText)

    expect(document.formatVersion).toBe(2)
    expect(document.schema.schemaVersion).toBe('6.2.0')
    expect(document.schema.tables.map((table) => table.name)).toEqual([
      'CombatRuleTable',
      'BattleTable',
      'CharacterTable',
      'CharacterActionTable',
      'BossTable',
      'BossActionTable',
    ])
    expect(document.schema.relations).toHaveLength(4)
    expect(Object.values(document.rowsByTable).flat()).toHaveLength(14)
    expect(validateProjectWithRows(document.schema, document.rowsByTable)).toEqual([])

    const reopened = deserializeDocument(serializeDocument(document))
    expect(reopened.ok, reopened.error).toBe(true)
    expect(reopened.document).toEqual(document)
  })

  it('uses a first-column numeric id as the only PK in every combat table', () => {
    const document = loadDocument(combatProjectText)

    for (const table of document.schema.tables) {
      expect(table.columns[0]).toMatchObject({ name: 'id', dataType: { kind: 'int32' }, nullable: false })
      expect(table.primaryKey.columnIds).toEqual([table.columns[0]?.columnId])
      for (const relation of document.schema.relations.filter((candidate) => candidate.targetTableId === table.tableId)) {
        expect(relation.targetColumnIds).toEqual([table.columns[0]?.columnId])
      }
    }
  })

  it('matches the analyzed AP 3 player turn and three enemy intent slots', () => {
    const document = loadDocument(combatProjectText)
    const [rule] = nameKeyedRows(document, 'CombatRuleTable')

    expect(rule).toMatchObject({
      id: 2010001,
      name: 'CASE_001 공통 전투 규칙',
      maxPartySize: 3,
      turnStartAp: 3,
      enemyIntentCount: 3,
      breakTriggerType: 'GaugeZero',
      breakEnemyActionReduction: 1,
      breakGaugeResetTiming: 'NextTurnStart',
    })
  })

  it('keeps BREAK as a common rule and the boss as a simple generic mage', () => {
    const document = loadDocument(combatProjectText)
    const [boss] = nameKeyedRows(document, 'BossTable')
    const [combatRule] = nameKeyedRows(document, 'CombatRuleTable')
    const bossActions = nameKeyedRows(document, 'BossActionTable')

    expect(boss).toMatchObject({
      id: 2060001,
      name: '영지 결정에 불복하는 마법사 A',
      hfsmControllerKey: 'BossCase001Hfsm',
    })
    expect(boss).not.toHaveProperty('hfsmBrokenStateKey')
    expect(combatRule).toMatchObject({
      id: 2010001,
      breakTriggerType: 'GaugeZero',
      breakEnemyActionReduction: 1,
      breakGaugeResetTiming: 'NextTurnStart',
    })
    expect(bossActions.map((action) => action.name)).toEqual(['마력탄', '연속 마력탄', '광역 마력 폭발'])
    expect(bossActions.map((action) => action.selectionWeight)).toEqual([50, 30, 20])
    expect(JSON.stringify(bossActions)).not.toMatch(/BOUNDARY|TERRITORY|경계|영역/i)

    const response = nameKeyedRows(document, 'CharacterActionTable')
      .find((action) => action.actionType === 'Response')
    expect(response).toMatchObject({
      name: '회피',
      apCost: 1,
      targetType: 'Self',
      cancelsCurrentEnemyAction: true,
      isImplemented: true,
    })
  })

  it('connects combat rows directly to the final content CaseDifficulty ids', () => {
    const contentDocument = loadDocument(contentProjectText)
    const combatDocument = loadDocument(combatProjectText)
    const combatBattles = nameKeyedRows(combatDocument, 'BattleTable')
      .toSorted((left, right) => Number(left.id) - Number(right.id))

    const contentDifficulties = nameKeyedRows(contentDocument, 'CaseDifficultyTable')
      .toSorted((left, right) => Number(left.id) - Number(right.id))

    expect(contentDocument.schema.tables.map((table) => table.name)).not.toContain('BattleTable')
    expect(combatBattles.map((row) => row.caseDifficultyId)).toEqual(contentDifficulties.map((row) => row.id))
    expect(contentDifficulties.filter((row) => row.isImplemented).map((row) => row.id)).toEqual([1050002])
    expect(combatBattles.find((row) => row.caseDifficultyId === 1050002)?.id).toBe(2030002)
  })

  it('uses three prototype tuning rows while reusing one combat rule, boss, and HFSM', () => {
    const document = loadDocument(combatProjectText)
    const battles = nameKeyedRows(document, 'BattleTable')
      .toSorted((left, right) => Number(left.id) - Number(right.id))

    expect(battles.map((row) => [row.bossHpMultiplier, row.bossDamageMultiplier, row.breakGaugeMultiplier])).toEqual([
      [0.8, 0.85, 0.85],
      [1, 1, 1],
      [1.35, 1.25, 1.2],
    ])
    expect(new Set(battles.map((row) => row.combatRuleId))).toEqual(new Set([2010001]))
    expect(new Set(battles.map((row) => row.bossId))).toEqual(new Set([2060001]))
  })

  it('keeps EASY and HARD as expansion data while only NORMAL is currently playable', () => {
    const contentDocument = loadDocument(contentProjectText)
    const combatDocument = loadDocument(combatProjectText)
    const difficulties = nameKeyedRows(contentDocument, 'CaseDifficultyTable')
    const battles = nameKeyedRows(combatDocument, 'BattleTable')

    expect(battles.map((row) => row.caseDifficultyId)).toEqual([1050001, 1050002, 1050003])
    expect(difficulties.map((row) => [row.difficultyType, row.isImplemented])).toEqual([
      ['EASY', false],
      ['NORMAL', true],
      ['HARD', false],
    ])
  })

  it('uses direct prototype damage values and disables swap until another character exists', () => {
    const document = loadDocument(combatProjectText)
    const actions = nameKeyedRows(document, 'CharacterActionTable')
    const [boss] = nameKeyedRows(document, 'BossTable')

    expect(requireTable(document, 'CharacterActionTable').columns.map((column) => column.name)).toEqual([
      'id', 'characterId', 'name', 'actionType', 'targetType', 'apCost', 'cooldownRound',
      'hpDamage', 'breakDamage', 'ultimateGaugeGain', 'cancelsCurrentEnemyAction',
      'isImplemented', 'unityActionKey',
    ])
    expect(actions.find((row) => row.actionType === 'SwapAttack')?.isImplemented).toBe(false)
    expect(actions.filter((row) => row.actionType !== 'SwapAttack').every((row) => row.isImplemented)).toBe(true)
    expect(boss.hpPerBar).toBe(1000)
  })

  it('keeps NORMAL prototype values internally coherent for a short vertical slice', () => {
    const document = loadDocument(combatProjectText)
    const [boss] = nameKeyedRows(document, 'BossTable')
    const normalBattle = nameKeyedRows(document, 'BattleTable')
      .find((row) => row.caseDifficultyId === 1050002)
    const bossActions = nameKeyedRows(document, 'BossActionTable')
    const characterActions = nameKeyedRows(document, 'CharacterActionTable')

    const normalBossHp = Number(boss.hpPerBar) * Number(boss.hpBarCount) * Number(normalBattle?.bossHpMultiplier)
    expect(normalBossHp).toBe(2000)
    expect(bossActions.reduce((sum, row) => sum + Number(row.selectionWeight), 0)).toBe(100)
    expect(bossActions.every((row) => Number(row.hpDamage) > 0 && Number(row.responseWindowMs) > 0)).toBe(true)
    expect(characterActions.filter((row) => row.isImplemented).every((row) => Number(row.apCost) >= 0)).toBe(true)
  })

  it('removes explanatory, provenance, and duplicate identity columns from combat data', () => {
    const document = loadDocument(combatProjectText)
    const removedColumns = new Set([
      'description', 'displayName', 'sourceStatus', 'designStatus', 'difficultyCode',
      'ruleCode', 'breakRuleCode', 'characterCode', 'actionCode', 'bossCode',
      'battleCode', 'partySize', 'defaultActionApCost', 'hpPower', 'breakPower', 'conditionKey',
      'breakRuleId',
    ])

    for (const table of document.schema.tables) {
      expect(table.columns.map((column) => column.name).filter((name) => removedColumns.has(name))).toEqual([])
    }
    expect(requireTable(document, 'BossActionTable').columns.map((column) => column.name)).toEqual([
      'id', 'bossId', 'name', 'telegraphType', 'targetType', 'hpDamage',
      'responseWindowMs', 'selectionWeight', 'unityActionKey',
    ])
  })

  it('keeps every authored id unique across both projects, not only inside each table', () => {
    const documents = [loadDocument(contentProjectText), loadDocument(combatProjectText)]
    const ids = documents.flatMap((document) => document.schema.tables.flatMap((table) => {
      const idColumn = table.columns.find((column) => column.name === 'id')
      expect(idColumn).toBeDefined()
      return (document.rowsByTable[table.tableId] ?? []).map((row) => row.cells[idColumn?.columnId ?? ''])
    }))

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('matches every CSV artifact to the application ColumnId-based serializer', () => {
    const document = loadDocument(combatProjectText)

    for (const table of document.schema.tables) {
      const rows = document.rowsByTable[table.tableId] ?? []
      const expected = serializeTableRowsToCsv(table, rows as readonly DataRow[])
      expect(csvByTableName[table.name]?.trimEnd()).toBe(expected)
    }
  })
})
