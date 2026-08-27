import { makeId } from './ids'
import type { SchemaProject } from './schema'

export function createEmptyProject(name: string): SchemaProject {
  return {
    projectId: makeId('project'),
    name,
    schemaVersion: '0.1.0',
    tables: [],
    enums: [],
    relations: [],
    functionalDependencies: [],
    exportViews: [],
    layout: { nodes: [] },
    commandHistory: [],
  }
}
