import { DECK_IR_SCHEMA_VERSION, parseDeckIrDocument, type DeckIrDocument } from './schema'

export class UnsupportedDeckIrSchemaVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Unsupported DeckIR schema version: ${String(version)}`)
    this.name = 'UnsupportedDeckIrSchemaVersionError'
  }
}

export const migrateDeckIrDocument = (value: unknown): DeckIrDocument => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return parseDeckIrDocument(value)
  }
  const version = (value as Record<string, unknown>).schemaVersion
  if (version !== DECK_IR_SCHEMA_VERSION) {
    throw new UnsupportedDeckIrSchemaVersionError(version)
  }
  return parseDeckIrDocument(value)
}
