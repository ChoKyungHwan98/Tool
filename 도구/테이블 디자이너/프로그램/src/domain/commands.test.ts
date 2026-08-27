import { describe, expect, it } from 'vitest'
import {
  AddForeignKeyCommand,
  AddColumnCommand,
  AddFunctionalDependencyCommand,
  AddSurrogateKeyCommand,
  AddUniqueConstraintCommand,
  BackfillColumnCommand,
  ChangeColumnDescriptionCommand,
  ChangeNullableCommand,
  ChangeTableDescriptionCommand,
  ChangeColumnTypeCommand,
  ChangePrimaryKeyCommand,
  CreateExportViewCommand,
  CreateJunctionTableCommand,
  CreateTableCommand,
  DeleteColumnCommand,
  DeleteTableCommand,
  ExtractLookupTableCommand,
  MergeTableCommand,
  ModifyExportViewCommand,
  MoveTableLayoutCommand,
  MoveTablesLayoutCommand,
  ReorderColumnCommand,
  RenameColumnCommand,
  RenameTableCommand,
  SplitTableCommand,
} from './commands'
import { requireColumn, requireTable } from './projectQueries'
import { crowdProject, sampleIds } from './sampleProject'
import { createColumn, createRelation, createTable, createUniqueConstraint } from './schemaFactories'

describe('schema commands', () => {
  it('renames a column without breaking ID-based relations', () => {
    const animation = requireTable(crowdProject, sampleIds.animation)
    const animationId = requireColumn(animation, 'column_animation_pk')
    const command = new RenameColumnCommand({
      tableId: animation.tableId,
      columnId: animationId.columnId,
      nextName: 'AnimationKey',
    })

    const nextProject = command.execute(crowdProject)
    const nextAnimation = requireTable(nextProject, sampleIds.animation)
    const nextColumn = requireColumn(nextAnimation, animationId.columnId)
    const actionRelation = nextProject.relations.find((relation) => relation.relationId === 'relation_action_animation')

    expect(nextColumn.name).toBe('AnimationKey')
    expect(actionRelation?.targetColumnIds).toContain(animationId.columnId)
  })

  it('blocks nullable primary key changes', () => {
    const table = requireTable(crowdProject, sampleIds.rule)
    const command = new ChangeNullableCommand({
      tableId: table.tableId,
      columnId: table.primaryKey.columnIds[0],
      nullable: true,
    })

    expect(command.validate(crowdProject).ok).toBe(false)
  })

  it('creates and removes a table through command undo', () => {
    const table = createTable({
      tableId: 'table_reward',
      name: 'Reward',
      columns: [{ columnId: 'column_reward_id', name: 'RewardId', dataType: { kind: 'string' }, nullable: false }],
      primaryKeyColumnIds: ['column_reward_id'],
    })
    const command = new CreateTableCommand({ table })
    const nextProject = command.execute(crowdProject)
    const undone = command.undo(nextProject)

    expect(nextProject.tables.some((candidate) => candidate.tableId === table.tableId)).toBe(true)
    expect(undone.tables.some((candidate) => candidate.tableId === table.tableId)).toBe(false)
  })

  it('moves table layout without changing table IDs', () => {
    const before = crowdProject.layout.nodes.find((node) => node.entityId === sampleIds.rule)
    const command = new MoveTableLayoutCommand({
      tableId: sampleIds.rule,
      x: 420,
      y: 180,
      previousX: before?.x,
      previousY: before?.y,
      previousHadLayout: Boolean(before),
    })
    const nextProject = command.execute(crowdProject)
    const restored = command.undo(nextProject)

    expect(requireTable(nextProject, sampleIds.rule).tableId).toBe(sampleIds.rule)
    expect(nextProject.layout.nodes.find((node) => node.entityId === sampleIds.rule)).toMatchObject({ x: 420, y: 180 })
    expect(restored.layout.nodes.find((node) => node.entityId === sampleIds.rule)).toMatchObject({ x: before?.x, y: before?.y })
  })

  it('replaces the full auto layout as one command and restores every previous position', () => {
    const positions = crowdProject.tables.map((table, index) => ({
      entityId: table.tableId,
      x: 32 + (index % 3) * 280,
      y: 32 + Math.floor(index / 3) * 220,
    }))
    const command = new MoveTablesLayoutCommand({
      positions,
      previousNodes: crowdProject.layout.nodes,
    })
    const nextProject = command.execute(crowdProject)
    const restored = command.undo(nextProject)

    expect(nextProject.layout.nodes).toEqual(positions)
    expect(restored.layout.nodes).toEqual(crowdProject.layout.nodes)
    expect(nextProject.commandHistory.at(-1)?.type).toBe('MoveTablesLayout')
  })

  it('requires approval before deleting a table', () => {
    const command = new DeleteTableCommand({ tableId: sampleIds.animation })

    expect(command.validate(crowdProject).ok).toBe(false)
  })

  it('inserts a new column at a requested position while legacy commands append', () => {
    const table = requireTable(crowdProject, sampleIds.rule)
    const inserted = createColumn({
      tableId: table.tableId,
      name: 'InsertedColumn',
      dataType: { kind: 'string' },
      nullable: true,
    })
    const appended = createColumn({
      tableId: table.tableId,
      name: 'AppendedColumn',
      dataType: { kind: 'string' },
      nullable: true,
    })

    const insertedProject = new AddColumnCommand({ tableId: table.tableId, column: inserted, targetIndex: 1 }).execute(crowdProject)
    const appendedProject = new AddColumnCommand({ tableId: table.tableId, column: appended }).execute(crowdProject)

    expect(requireTable(insertedProject, table.tableId).columns[1]?.columnId).toBe(inserted.columnId)
    expect(requireTable(appendedProject, table.tableId).columns.at(-1)?.columnId).toBe(appended.columnId)
  })

  it('changes primary keys and makes key columns required', () => {
    const table = requireTable(crowdProject, sampleIds.action)
    const returnState = requireColumn(table, 'column_return_state_id')
    const command = new ChangePrimaryKeyCommand({
      tableId: table.tableId,
      nextColumnIds: [returnState.columnId],
    })
    const nextProject = command.execute(crowdProject)
    const nextTable = requireTable(nextProject, table.tableId)

    expect(nextTable.primaryKey.columnIds).toEqual([returnState.columnId])
    expect(requireColumn(nextTable, returnState.columnId).nullable).toBe(false)
  })

  it('adds foreign keys and constraints through commands', () => {
    const sourceTable = requireTable(crowdProject, sampleIds.zone)
    const targetTable = requireTable(crowdProject, sampleIds.eventType)
    const relation = createRelation({
      relationId: 'relation_zone_default_state_event',
      name: 'Zone default state uses event type',
      sourceTableId: sourceTable.tableId,
      sourceColumnIds: ['column_default_state_id'],
      targetTableId: targetTable.tableId,
      targetColumnIds: ['column_event_type_pk'],
      kind: 'soft_ref',
    })
    const unique = createUniqueConstraint('uq_zone_support_team', ['column_support_team'])
    const withRelation = new AddForeignKeyCommand({ relation }).execute(crowdProject)
    const withConstraint = new AddUniqueConstraintCommand({
      tableId: sourceTable.tableId,
      constraint: unique,
    }).execute(withRelation)

    expect(withRelation.relations.some((candidate) => candidate.relationId === relation.relationId)).toBe(true)
    expect(requireTable(withConstraint, sourceTable.tableId).uniqueConstraints).toContainEqual(unique)
  })

  it('renames tables without changing relation table IDs', () => {
    const command = new RenameTableCommand({
      tableId: sampleIds.animation,
      nextName: 'AnimationCatalog',
    })
    const nextProject = command.execute(crowdProject)
    const relation = nextProject.relations.find((candidate) => candidate.relationId === 'relation_action_animation')

    expect(requireTable(nextProject, sampleIds.animation).name).toBe('AnimationCatalog')
    expect(relation?.targetTableId).toBe(sampleIds.animation)
  })

  it('changes table and column descriptions without changing IDs or relations', () => {
    const table = requireTable(crowdProject, sampleIds.animation)
    const column = table.columns[0]!
    const withTableDescription = new ChangeTableDescriptionCommand({
      tableId: table.tableId,
      description: '애니메이션 리소스 규격',
    }).execute(crowdProject)
    const nextProject = new ChangeColumnDescriptionCommand({
      tableId: table.tableId,
      columnId: column.columnId,
      description: '런타임에서 사용하는 안정적인 식별자',
    }).execute(withTableDescription)

    expect(requireTable(nextProject, table.tableId)).toMatchObject({
      tableId: table.tableId,
      description: '애니메이션 리소스 규격',
    })
    expect(requireColumn(requireTable(nextProject, table.tableId), column.columnId)).toMatchObject({
      columnId: column.columnId,
      description: '런타임에서 사용하는 안정적인 식별자',
    })
    expect(nextProject.relations).toEqual(crowdProject.relations)
  })

  it('requires approval before deleting a column', () => {
    const command = new DeleteColumnCommand({
      tableId: sampleIds.rule,
      columnId: 'column_rule_id',
    })

    expect(command.validate(crowdProject).ok).toBe(false)
  })

  it('reorders a column without changing its ID or relations', () => {
    const table = requireTable(crowdProject, sampleIds.rule)
    const columnId = 'column_priority'
    const previousIndex = table.columns.findIndex((column) => column.columnId === columnId)
    const command = new ReorderColumnCommand({
      tableId: table.tableId,
      columnId,
      targetIndex: 1,
      previousIndex,
    })

    const nextProject = command.execute(crowdProject)
    const reordered = requireTable(nextProject, table.tableId)
    const restored = command.undo(nextProject)

    expect(reordered.columns[1]?.columnId).toBe(columnId)
    expect(nextProject.relations).toEqual(crowdProject.relations)
    expect(requireTable(restored, table.tableId).columns.map((column) => column.columnId)).toEqual(
      table.columns.map((column) => column.columnId),
    )
  })

  it('changes column type with undo metadata', () => {
    const command = new ChangeColumnTypeCommand({
      tableId: sampleIds.rule,
      columnId: 'column_priority',
      nextDataType: { kind: 'int64' },
    })
    const nextProject = command.execute(crowdProject)
    const nextTable = requireTable(nextProject, sampleIds.rule)

    expect(requireColumn(nextTable, 'column_priority').dataType).toEqual({ kind: 'int64' })
  })

  it('adds functional dependencies for normalization analysis', () => {
    const command = new AddFunctionalDependencyCommand({
      dependency: {
        dependencyId: 'dependency_rule_profile_event',
        tableId: sampleIds.rule,
        determinantColumnIds: ['column_rule_id'],
        dependentColumnIds: ['column_rule_profile_id', 'column_event_type_id'],
        note: 'Rule determines profile and event type.',
      },
    })
    const nextProject = command.execute(crowdProject)

    expect(nextProject.functionalDependencies.some((dependency) => dependency.dependencyId === 'dependency_rule_profile_event')).toBe(true)
  })

  it('splits a table into a new table after approval', () => {
    const source = requireTable(crowdProject, sampleIds.rule)
    const movedColumn = requireColumn(source, 'column_participation_rate')
    const newTable = createTable({
      tableId: 'table_rule_timing',
      name: 'CrowdReactionRuleTiming',
      columns: [{ columnId: movedColumn.columnId, name: movedColumn.name, dataType: movedColumn.dataType, nullable: movedColumn.nullable }],
      primaryKeyColumnIds: [movedColumn.columnId],
    })
    const command = new SplitTableCommand({
      sourceTableId: source.tableId,
      movedColumnIds: [movedColumn.columnId],
      newTable,
      approved: true,
    })
    const nextProject = command.execute(crowdProject)

    expect(requireTable(nextProject, source.tableId).columns.some((column) => column.columnId === movedColumn.columnId)).toBe(false)
    expect(requireTable(nextProject, newTable.tableId).columns[0]?.columnId).toBe(movedColumn.columnId)
  })

  it('merges a source table into a target table after approval', () => {
    const command = new MergeTableCommand({
      sourceTableId: sampleIds.eventType,
      targetTableId: sampleIds.action,
      approved: true,
    })
    const nextProject = command.execute(crowdProject)
    const target = requireTable(nextProject, sampleIds.action)

    expect(nextProject.tables.some((table) => table.tableId === sampleIds.eventType)).toBe(false)
    expect(target.columns.some((column) => column.name === 'EventTypeId')).toBe(true)
  })

  it('creates lookup and junction tables', () => {
    const lookup = createTable({
      tableId: 'table_support_team',
      name: 'SupportTeam',
      columns: [{ columnId: 'column_support_team_id', name: 'SupportTeamId', dataType: { kind: 'string' }, nullable: false }],
      primaryKeyColumnIds: ['column_support_team_id'],
      tags: ['lookup'],
    })
    const lookupRelation = createRelation({
      relationId: 'relation_zone_support_team',
      name: 'Zone uses support team',
      sourceTableId: sampleIds.zone,
      sourceColumnIds: ['column_support_team'],
      targetTableId: lookup.tableId,
      targetColumnIds: ['column_support_team_id'],
    })
    const withLookup = new ExtractLookupTableCommand({
      sourceTableId: sampleIds.zone,
      lookupTable: lookup,
      relation: lookupRelation,
    }).execute(crowdProject)
    const junction = createTable({
      tableId: 'table_zone_event',
      name: 'ZoneEvent',
      columns: [
        { columnId: 'column_zone_event_zone_id', name: 'ZoneId', dataType: { kind: 'string' }, nullable: false },
        { columnId: 'column_zone_event_event_id', name: 'EventTypeId', dataType: { kind: 'string' }, nullable: false },
      ],
      primaryKeyColumnIds: ['column_zone_event_zone_id', 'column_zone_event_event_id'],
    })
    const withJunction = new CreateJunctionTableCommand({ table: junction, relations: [] }).execute(withLookup)

    expect(requireTable(withLookup, lookup.tableId).tags).toContain('lookup')
    expect(requireTable(withJunction, junction.tableId).tags).toContain('junction')
  })

  it('adds surrogate keys and backfill defaults', () => {
    const surrogateColumn = {
      columnId: 'column_rule_surrogate_id',
      tableId: sampleIds.rule,
      name: 'InternalId',
      displayName: 'InternalId',
      description: '',
      dataType: { kind: 'string' as const },
      nullable: false,
      validationRules: [],
      deprecated: false,
    }
    const withKey = new AddSurrogateKeyCommand({
      tableId: sampleIds.rule,
      column: surrogateColumn,
    }).execute(crowdProject)
    const withBackfill = new BackfillColumnCommand({
      tableId: sampleIds.rule,
      columnId: surrogateColumn.columnId,
      strategy: 'fixed_default',
      value: 'auto',
    }).execute(withKey)

    expect(requireTable(withKey, sampleIds.rule).primaryKey.columnIds).toEqual([surrogateColumn.columnId])
    expect(requireColumn(requireTable(withBackfill, sampleIds.rule), surrogateColumn.columnId).defaultValue).toBe('auto')
  })

  it('creates and modifies export views', () => {
    const view = {
      viewId: 'export_rule_debug',
      name: 'RuleDebug',
      displayName: 'Rule Debug',
      description: '',
      format: 'csv' as const,
      rootTableId: sampleIds.rule,
      columns: [
        {
          exportColumnId: 'export_rule_debug_rule_id',
          sourceTableId: sampleIds.rule,
          sourceColumnId: 'column_rule_id',
          header: 'RuleId',
          transform: 'copy' as const,
        },
      ],
    }
    const withView = new CreateExportViewCommand({ view }).execute(crowdProject)
    const modified = new ModifyExportViewCommand({
      viewId: view.viewId,
      nextView: {
        ...view,
        columns: [...view.columns, {
          exportColumnId: 'export_rule_debug_priority',
          sourceTableId: sampleIds.rule,
          sourceColumnId: 'column_priority',
          header: 'Priority',
          transform: 'copy' as const,
        }],
      },
    }).execute(withView)

    expect(modified.exportViews.find((candidate) => candidate.viewId === view.viewId)?.columns).toHaveLength(2)
  })
})
