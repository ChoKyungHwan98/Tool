import { describe, expect, it } from 'vitest'
import { findTable } from '../domain/projectQueries'
import { crowdProject, sampleIds } from '../domain/sampleProject'
import { importCsvForTable, parseCsv, serializeTableRowsToCsv } from './csvImportExport'

describe('csvImportExport', () => {
  it('parses quoted CSV cells', () => {
    const parsed = parseCsv('Id,Name\n1,"A, B"\n2,"He said ""go"""')

    expect(parsed.headers).toEqual(['Id', 'Name'])
    expect(parsed.rows[0]?.Name).toBe('A, B')
    expect(parsed.rows[1]?.Name).toBe('He said "go"')
  })

  it('accepts UTF-8 BOM and common tab-delimited exports', () => {
    const parsed = parseCsv('\uFEFFId\tName\n9007199254740993\tHero')

    expect(parsed.headers).toEqual(['Id', 'Name'])
    expect(parsed.rows[0]?.Id).toBe('9007199254740993')
    expect(parsed.rows[0]?.Name).toBe('Hero')
  })

  it('imports CSV rows through the schema validator', () => {
    const result = importCsvForTable(
      crowdProject,
      sampleIds.rule,
      [
        'RuleId,ProfileId,EventTypeId,AudienceSide,ParticipationRate,DelayMin,DelayMax,DurationMin,DurationMax,Priority',
        'goal_home_high,profile_home_default,goal,Home,0.95,0.1,0.6,5,8,100',
        'bad_priority,profile_home_default,goal,Home,0.5,0,1,2,3,urgent',
      ].join('\n'),
    )

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.cells.column_priority).toBe(100)
    expect(result.issues.some((issue) => issue.columnIds.includes('column_priority') && issue.severity === 'error')).toBe(true)
  })

  it('blocks duplicate CSV headers instead of silently choosing one', () => {
    const result = importCsvForTable(
      crowdProject,
      sampleIds.rule,
      [
        'RuleId,RuleId,ProfileId,EventTypeId,AudienceSide,ParticipationRate,DelayMin,DelayMax,DurationMin,DurationMax,Priority',
        'a,b,profile_home_default,goal,Home,0.95,0.1,0.6,5,8,100',
      ].join('\n'),
    )

    expect(result.rows).toHaveLength(0)
    expect(result.issues.some((issue) => issue.title === 'Duplicate CSV header')).toBe(true)
  })

  it('exports table rows with CSV escaping and formula guards', () => {
    const table = findTable(crowdProject, sampleIds.rule)

    expect(table).toBeTruthy()

    const csv = serializeTableRowsToCsv(table!, [
      {
        rowId: 'row_test',
        cells: {
          column_rule_id: '=cmd',
          column_rule_profile_id: 'profile',
          column_event_type_id: 'goal',
          column_audience_side: 'Home',
          column_participation_rate: 0.9,
          column_delay_min: 0,
          column_delay_max: 1,
          column_duration_min: 2,
          column_duration_max: 3,
          column_priority: 10,
        },
      },
    ])

    expect(csv).toContain("'=cmd")
  })
})
