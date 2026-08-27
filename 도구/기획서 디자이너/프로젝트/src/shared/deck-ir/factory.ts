import { DECK_IR_SCHEMA_VERSION, type DeckIrDocument } from './schema'

export interface CreateEmptyDeckIrArgs {
  sessionId: string
  title: string
  rawBrief?: string
  now?: number
  idFactory?: (prefix: string) => string
}

const defaultIdFactory = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

export const createEmptyDeckIr = ({
  sessionId,
  title,
  rawBrief = '',
  now = Date.now(),
  idFactory = defaultIdFactory
}: CreateEmptyDeckIrArgs): DeckIrDocument => {
  const sourceId = idFactory('source')
  const inventoryId = idFactory('inventory')
  const hasBrief = rawBrief.trim().length > 0
  return {
    schemaVersion: DECK_IR_SCHEMA_VERSION,
    sessionId: sessionId.trim(),
    revision: 0,
    title: title.trim(),
    brief: {
      rawText: rawBrief,
      contextSignals: []
    },
    sources: hasBrief
      ? [
          {
            id: sourceId,
            kind: 'user-input',
            name: 'Initial brief',
            rawText: rawBrief,
            createdAt: now
          }
        ]
      : [],
    inventory: hasBrief
      ? [
          {
            id: inventoryId,
            sourceId,
            originalText: rawBrief,
            type: 'reference',
            locator: { note: 'Initial freeform input' },
            verbatimNumbers: extractNumericTokens(rawBrief),
            tags: [],
            userConfirmed: true
          }
        ]
      : [],
    claims: [],
    slides: [],
    dataRequirements: [],
    imageSlots: [],
    extensions: {},
    createdAt: now,
    updatedAt: now
  }
}

export const extractNumericTokens = (value: string): string[] =>
  Array.from(
    new Set(
      value.match(/(?<![\p{L}\p{N}_])-?\d+(?:[.,]\d+)*(?:\s?(?:%|배|초|ms|fps|원|달러|USD))?/gu) ||
        []
    )
  )

export const createDataRequiredToken = (field: string): string =>
  `[DATA REQUIRED: ${field.trim() || 'unspecified'}]`
