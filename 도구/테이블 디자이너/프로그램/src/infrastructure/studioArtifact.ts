import type { WorkbenchDocument } from '../domain/schema'

const CHANNEL = 'gds:tool'

export function tableArtifactRecords(document: WorkbenchDocument) {
  return document.schema.tables.map((table) => ({
    artifactId: table.tableId,
    kind: 'data-table',
    title: table.displayName || table.name,
    revision: document.revision,
    fingerprint: `${document.revision}:${table.columns.length}:${document.rowsByTable[table.tableId]?.length || 0}`,
    summary: table.description || `${table.columns.length}개 열 · ${document.rowsByTable[table.tableId]?.length || 0}개 행`,
    data: {
      projectId: document.schema.projectId,
      projectName: document.schema.name,
      tableId: table.tableId,
      name: table.name,
      displayName: table.displayName,
      description: table.description,
      columns: table.columns.map((column) => ({
        columnId: column.columnId, name: column.name, displayName: column.displayName,
        description: column.description, dataType: column.dataType, nullable: column.nullable
      })),
      rows: (document.rowsByTable[table.tableId] || []).slice(0, 20)
    }
  }))
}

export function publishTableArtifacts(document: WorkbenchDocument): void {
  if (new URLSearchParams(window.location.search).get('host') !== 'studio' || window.parent === window) return
  tableArtifactRecords(document).forEach((record) => {
    window.parent.postMessage({
      channel: CHANNEL, type: 'artifact:publish', requestId: `table-publish-${crypto.randomUUID()}`, record
    }, window.location.origin)
  })
}
