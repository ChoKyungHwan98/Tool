import { CreateTableCommand, ModifyExportViewCommand, type SchemaCommand } from '../domain/commands'
import { makeId } from '../domain/ids'
import { findColumn, findTable } from '../domain/projectQueries'
import { createTable } from '../domain/schemaFactories'
import type { EntityId, SchemaProject } from '../domain/schema'
import type { AiCommandDraft, SchemaProposal } from './mockAiProvider'

export interface AiCommandCandidate {
  readonly draft: AiCommandDraft
  readonly command: SchemaCommand
}

export function compileAiProposalCommands(project: SchemaProject, proposal: SchemaProposal): readonly AiCommandCandidate[] {
  const candidates: AiCommandCandidate[] = []

  for (const draft of proposal.commandDrafts) {
    const command = draft.kind === 'create_table'
      ? createTableCommand(project, draft)
      : createExportColumnCommand(project, draft)

    if (command && command.validate(project).ok) candidates.push({ draft, command })
  }

  return candidates
}

function createTableCommand(project: SchemaProject, draft: Extract<AiCommandDraft, { readonly kind: 'create_table' }>): SchemaCommand | null {
  const name = draft.name.trim()
  const columns = draft.columns.slice(0, 64)
  if (!isIdentifier(name) || columns.length === 0 || project.tables.some((table) => table.name.toLowerCase() === name.toLowerCase())) return null
  if (new Set(columns.map((column) => column.name.trim().toLowerCase())).size !== columns.length) return null
  if (columns.some((column) => !isIdentifier(column.name.trim()))) return null

  const tableId = makeId('table')
  const preparedColumns = columns.map((column) => ({ ...column, columnId: makeId('column') }))
  const primaryKeyColumnIds = preparedColumns.filter((column) => column.primaryKey).map((column) => column.columnId)
  const table = createTable({
    tableId,
    name,
    description: draft.description?.trim().slice(0, 500) ?? '',
    columns: preparedColumns.map((column, index) => ({
      columnId: column.columnId,
      name: column.name.trim(),
      dataType: { kind: column.dataType },
      nullable: primaryKeyColumnIds.length === 0 ? index !== 0 && (column.nullable ?? true) : column.primaryKey ? false : column.nullable ?? true,
    })),
    primaryKeyColumnIds: primaryKeyColumnIds.length > 0 ? primaryKeyColumnIds : [preparedColumns[0]!.columnId],
  })

  return new CreateTableCommand({ table })
}

function createExportColumnCommand(project: SchemaProject, draft: Extract<AiCommandDraft, { readonly kind: 'add_export_column' }>): SchemaCommand | null {
  const view = project.exportViews.find((candidate) => candidate.viewId === draft.viewId)
  const table = findTable(project, draft.tableId)
  const column = table ? findColumn(table, draft.columnId) : undefined
  if (!view || !table || !column || view.columns.some((candidate) => candidate.sourceColumnId === column.columnId)) return null
  if (!isReachable(project, view.rootTableId, table.tableId)) return null

  const requestedHeader = draft.header?.trim()
  const baseHeader = requestedHeader && isIdentifier(requestedHeader) ? requestedHeader : column.name
  const existingHeaders = new Set(view.columns.map((candidate) => candidate.header.toLowerCase()))
  let header = baseHeader
  let suffix = 2
  while (existingHeaders.has(header.toLowerCase())) header = `${baseHeader}_${suffix++}`

  return new ModifyExportViewCommand({
    viewId: view.viewId,
    nextView: {
      ...view,
      columns: [...view.columns, {
        exportColumnId: makeId('export_column'),
        sourceTableId: table.tableId,
        sourceColumnId: column.columnId,
        header,
        transform: 'copy',
      }],
    },
  })
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)
}

function isReachable(project: SchemaProject, rootTableId: EntityId, targetTableId: EntityId): boolean {
  if (rootTableId === targetTableId) return true
  const visited = new Set<EntityId>([rootTableId])
  const queue = [rootTableId]
  for (let index = 0; index < queue.length; index += 1) {
    for (const relation of project.relations.filter((candidate) => candidate.sourceTableId === queue[index])) {
      if (relation.targetTableId === targetTableId) return true
      if (!visited.has(relation.targetTableId)) {
        visited.add(relation.targetTableId)
        queue.push(relation.targetTableId)
      }
    }
  }
  return false
}
