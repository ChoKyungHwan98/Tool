import { z } from 'zod'
import { DeckDesignPlanSchema } from '../design-engine/schema'

export const DECK_IR_SCHEMA_VERSION = 1 as const

export const DeckIrSourceSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['user-input', 'file', 'image', 'reference-deck']),
    name: z.string().min(1),
    rawText: z.string().optional(),
    path: z.string().optional(),
    checksum: z.string().optional(),
    createdAt: z.number().int().nonnegative()
  })
  .strict()

export const DeckIrContextSignalSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
    origin: z.enum(['user', 'inferred']),
    confirmed: z.boolean()
  })
  .strict()

export const DeckIrInventoryItemSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    originalText: z.string().min(1),
    type: z.enum(['claim', 'number', 'measurement', 'example', 'image', 'table', 'reference']),
    locator: z
      .object({
        page: z.number().int().positive().optional(),
        lineStart: z.number().int().positive().optional(),
        lineEnd: z.number().int().positive().optional(),
        heading: z.string().optional(),
        note: z.string().optional()
      })
      .strict()
      .default({}),
    verbatimNumbers: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
    userConfirmed: z.boolean().default(false)
  })
  .strict()

export const DeckIrClaimSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    sourceItemIds: z.array(z.string().min(1)).default([]),
    kind: z.enum(['user-asserted', 'compressed', 'derived']),
    status: z.enum(['supported', 'missing-evidence']),
    createdBy: z.enum(['user', 'ai', 'system'])
  })
  .strict()

export const DeckIrTraceableTextSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    sourceItemIds: z.array(z.string().min(1)).default([]),
    claimIds: z.array(z.string().min(1)).default([]),
    transform: z.enum(['verbatim', 'compressed', 'reordered', 'user-authored'])
  })
  .strict()

export const DeckIrDataRequirementSchema = z
  .object({
    id: z.string().min(1),
    slideId: z.string().min(1).optional(),
    field: z.string().min(1),
    question: z.string().min(1),
    reason: z.string().min(1),
    status: z.enum(['missing', 'provided']),
    providedSourceItemId: z.string().min(1).optional()
  })
  .strict()

export const DeckIrImageSlotSchema = z
  .object({
    id: z.string().min(1),
    slideId: z.string().min(1),
    description: z.string().min(1),
    composition: z.string().min(1),
    aspectRatio: z.string().min(1),
    minWidth: z.number().int().positive(),
    minHeight: z.number().int().positive(),
    annotations: z.array(z.string().min(1)).default([])
  })
  .strict()

export const DeckIrSlideSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().positive(),
    role: z.enum(['cover', 'divider', 'content', 'closing', 'custom']),
    logicalStructure: z.enum([
      'comparison',
      'sequence',
      'cause-effect',
      'part-whole',
      'number-focus',
      'declaration',
      'mechanism',
      'tradeoff',
      'custom'
    ]),
    customStructure: z.string().min(1).optional(),
    headline: DeckIrTraceableTextSchema,
    body: z.array(DeckIrTraceableTextSchema).default([]),
    takeaway: DeckIrTraceableTextSchema.optional(),
    claimIds: z.array(z.string().min(1)).default([]),
    dataRequirementIds: z.array(z.string().min(1)).default([]),
    imageSlotIds: z.array(z.string().min(1)).default([]),
    notes: z.string().default('')
  })
  .strict()

export const DeckIrDocumentSchema = z
  .object({
    schemaVersion: z.literal(DECK_IR_SCHEMA_VERSION),
    sessionId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    title: z.string().min(1),
    brief: z
      .object({
        rawText: z.string(),
        contextSignals: z.array(DeckIrContextSignalSchema).default([])
      })
      .strict(),
    sources: z.array(DeckIrSourceSchema).default([]),
    inventory: z.array(DeckIrInventoryItemSchema).default([]),
    claims: z.array(DeckIrClaimSchema).default([]),
    slides: z.array(DeckIrSlideSchema).default([]),
    dataRequirements: z.array(DeckIrDataRequirementSchema).default([]),
    imageSlots: z.array(DeckIrImageSlotSchema).default([]),
    designPlan: DeckDesignPlanSchema.optional(),
    extensions: z.record(z.string(), z.unknown()).default({}),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative()
  })
  .strict()

export type DeckIrSource = z.infer<typeof DeckIrSourceSchema>
export type DeckIrContextSignal = z.infer<typeof DeckIrContextSignalSchema>
export type DeckIrInventoryItem = z.infer<typeof DeckIrInventoryItemSchema>
export type DeckIrClaim = z.infer<typeof DeckIrClaimSchema>
export type DeckIrTraceableText = z.infer<typeof DeckIrTraceableTextSchema>
export type DeckIrDataRequirement = z.infer<typeof DeckIrDataRequirementSchema>
export type DeckIrImageSlot = z.infer<typeof DeckIrImageSlotSchema>
export type DeckIrSlide = z.infer<typeof DeckIrSlideSchema>
export type DeckIrDocument = z.infer<typeof DeckIrDocumentSchema>

export const parseDeckIrDocument = (value: unknown): DeckIrDocument =>
  DeckIrDocumentSchema.parse(value)
