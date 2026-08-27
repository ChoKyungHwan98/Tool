import { createWorkbenchDocument, migrateLegacyRowsByTable } from '../application/workbenchDocument'
import { parseProject, parseWorkbenchDocument, safeParseProject, safeParseWorkbenchDocument } from '../domain/schemaValidation'
import type { SchemaProject, WorkbenchDocument } from '../domain/schema'

export interface ProjectPersistenceResult {
  readonly ok: boolean
  readonly project?: SchemaProject
  readonly error?: string
}

export interface DocumentPersistenceResult {
  readonly ok: boolean
  readonly document?: WorkbenchDocument
  readonly error?: string
  readonly migrationIssues?: readonly string[]
}

export function serializeProject(project: SchemaProject): string {
  return JSON.stringify(project, null, 2)
}

export function deserializeProject(text: string): ProjectPersistenceResult {
  try {
    return {
      ok: true,
      project: parseProject(JSON.parse(text)),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Project file could not be parsed.',
    }
  }
}

export function serializeDocument(document: WorkbenchDocument): string {
  return JSON.stringify(document, null, 2)
}

export function deserializeDocument(text: string): DocumentPersistenceResult {
  try {
    const value = JSON.parse(text) as unknown
    const documentResult = safeParseWorkbenchDocument(value)

    if (documentResult.success) {
      return {
        ok: true,
        document: parseWorkbenchDocument(value),
      }
    }

    const legacyResult = parseLegacyValue(value)

    if (!legacyResult.ok) {
      return legacyResult
    }

    return {
      ok: true,
      document: legacyResult.document,
      migrationIssues: legacyResult.migrationIssues,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Project file could not be parsed.',
    }
  }
}

function parseLegacyValue(value: unknown): DocumentPersistenceResult {
  const schemaOnly = safeParseProject(value)

  if (schemaOnly.success) {
    return {
      ok: true,
      document: createWorkbenchDocument(parseProject(value)),
      migrationIssues: ['Opened legacy schema-only project; no row data was present.'],
    }
  }

  if (!isObject(value)) {
    return {
      ok: false,
      error: 'Project file is not a recognized object.',
    }
  }

  const maybeSchema = 'schema' in value ? value.schema : 'project' in value ? value.project : undefined
  const maybeRows = 'rowsByTable' in value ? value.rowsByTable : undefined
  const schemaResult = safeParseProject(maybeSchema)

  if (!schemaResult.success) {
    return {
      ok: false,
      error: 'Project file does not contain a valid schema.',
    }
  }

  if (maybeRows === undefined) {
    return {
      ok: true,
      document: createWorkbenchDocument(parseProject(maybeSchema)),
      migrationIssues: ['Opened legacy schema wrapper without row data.'],
    }
  }

  if (!isLegacyRowsByTable(maybeRows)) {
    return {
      ok: false,
      error: 'Legacy rowsByTable payload is not a recognized name-keyed row map.',
    }
  }

  const schema = parseProject(maybeSchema)
  const migration = migrateLegacyRowsByTable(schema, maybeRows)

  if (!migration.ok) {
    return {
      ok: false,
      error: 'Legacy row migration requires manual mapping.',
      migrationIssues: migration.issues.map((issue) => issue.message),
    }
  }

  return {
    ok: true,
    document: createWorkbenchDocument(schema, migration.rowsByTable),
    migrationIssues: ['Migrated legacy name-keyed rows to ColumnId-keyed rows.'],
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLegacyRowsByTable(value: unknown): value is Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> {
  return isObject(value) &&
    Object.values(value).every((rows) =>
      Array.isArray(rows) &&
      rows.every((row) => isObject(row) && !('cells' in row)),
    )
}
