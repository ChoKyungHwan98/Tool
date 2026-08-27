import { z } from 'zod'
import {
  assertDeckIrIntegrity,
  extractNumericTokens,
  migrateDeckIrDocument,
  type DeckIrDocument,
  type DeckIrInventoryItem,
  type DeckIrSlide,
  type DeckIrTraceableText
} from '@shared/deck-ir'
import type { StructuredAiRequest, StructuredAiResult } from '../agent-runtime/model'

export interface StructuredJsonGenerator {
  generateJson<T>(request: StructuredAiRequest): Promise<StructuredAiResult<T>>
}

export class DeckIrAiOutputError extends Error {
  readonly code = 'DECK_IR_AI_OUTPUT_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'DeckIrAiOutputError'
  }
}

const InventoryProposalSchema = z
  .object({
    contextSignals: z.array(
      z
        .object({
          label: z.string().min(1),
          value: z.string().min(1)
        })
        .strict()
    ),
    inventory: z.array(
      z
        .object({
          sourceId: z.string().min(1),
          originalText: z.string().min(1),
          type: z.enum([
            'claim',
            'number',
            'measurement',
            'example',
            'image',
            'table',
            'reference'
          ]),
          tags: z.array(z.string().min(1))
        })
        .strict()
    )
  })
  .strict()

const TraceableProposalSchema = z
  .object({
    text: z.string().min(1),
    sourceItemIds: z.array(z.string().min(1)).min(1)
  })
  .strict()

const OutlineProposalSchema = z
  .object({
    slides: z.array(
      z
        .object({
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
          customStructure: z.string().min(1).nullable(),
          headline: TraceableProposalSchema,
          body: z.array(TraceableProposalSchema),
          takeaway: TraceableProposalSchema.nullable(),
          notes: z.string()
        })
        .strict()
    )
  })
  .strict()

type InventoryProposal = z.infer<typeof InventoryProposalSchema>
type OutlineProposal = z.infer<typeof OutlineProposalSchema>
type TraceableProposal = z.infer<typeof TraceableProposalSchema>

const toOutputSchema = (schema: z.ZodType): Record<string, unknown> =>
  z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>

const sourceText = (document: DeckIrDocument, sourceId: string): string | undefined =>
  document.sources.find((source) => source.id === sourceId)?.rawText

const inventoryPrompt = (document: DeckIrDocument): string =>
  `
You are extracting a content inventory for a planning document. Do not design slides yet.

Hard rules:
- originalText must be an exact, contiguous substring copied from the matching source rawText.
- Never add a number, name, feature, company, project, or job-role fact.
- Context signals are freeform observations, not fixed form fields. Marking confidence happens later.
- If the source does not contain useful evidence, return an empty inventory array.

Sources:
${JSON.stringify(document.sources.map(({ id, name, rawText }) => ({ id, name, rawText })))}
`.trim()

const outlinePrompt = (document: DeckIrDocument): string =>
  `
Build a logical slide outline from the supplied inventory. The deck is one argument, not a template.

Hard rules:
- Every headline, body line, and takeaway must cite one or more supplied inventory IDs.
- Do not introduce any fact or number that is absent from the cited originalText.
- Use logicalStructure as a semantic description, not as a fixed visual template.
- Use custom only when the listed structures genuinely do not fit, and explain it in customStructure.
- Vary the argument rhythm where the content calls for it; do not invent variety without content support.
- Company, project, and role examples are context only when they occur in inventory; they are never required fields.

Title: ${JSON.stringify(document.title)}
Freeform brief: ${JSON.stringify(document.brief.rawText)}
Inventory:
${JSON.stringify(
  document.inventory.map(({ id, originalText, type, tags }) => ({ id, originalText, type, tags }))
)}
`.trim()

export interface DeckIrContentServiceOptions {
  idFactory?: (prefix: string) => string
}

const defaultIdFactory = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

export class DeckIrContentService {
  private readonly idFactory: (prefix: string) => string

  constructor(
    private readonly ai: StructuredJsonGenerator,
    options: DeckIrContentServiceOptions = {}
  ) {
    this.idFactory = options.idFactory || defaultIdFactory
  }

  async extractInventory(input: unknown): Promise<DeckIrDocument> {
    const document = migrateDeckIrDocument(input)
    const result = await this.ai.generateJson<InventoryProposal>({
      purpose: 'content-inventory',
      prompt: inventoryPrompt(document),
      outputSchema: toOutputSchema(InventoryProposalSchema),
      reasoningEffort: 'medium'
    })
    const proposal = InventoryProposalSchema.parse(result.value)
    const additions: DeckIrInventoryItem[] = proposal.inventory.map((item) => {
      const rawText = sourceText(document, item.sourceId)
      if (rawText === undefined || !rawText.includes(item.originalText)) {
        throw new DeckIrAiOutputError(
          `Inventory excerpt is not present verbatim in source ${item.sourceId}.`
        )
      }
      return {
        id: this.idFactory('inventory'),
        sourceId: item.sourceId,
        originalText: item.originalText,
        type: item.type,
        locator: { note: 'AI-extracted verbatim excerpt' },
        verbatimNumbers: extractNumericTokens(item.originalText),
        tags: item.tags,
        userConfirmed: false
      }
    })
    const existingKeys = new Set(
      document.inventory.map((item) => `${item.sourceId}\u0000${item.originalText}`)
    )
    const next: DeckIrDocument = {
      ...document,
      brief: {
        ...document.brief,
        contextSignals: [
          ...document.brief.contextSignals,
          ...proposal.contextSignals.map((signal) => ({
            id: this.idFactory('context'),
            label: signal.label,
            value: signal.value,
            origin: 'inferred' as const,
            confirmed: false
          }))
        ]
      },
      inventory: [
        ...document.inventory,
        ...additions.filter(
          (item) => !existingKeys.has(`${item.sourceId}\u0000${item.originalText}`)
        )
      ]
    }
    assertDeckIrIntegrity(next)
    return next
  }

  async proposeOutline(input: unknown): Promise<DeckIrDocument> {
    const document = migrateDeckIrDocument(input)
    if (document.inventory.length === 0) {
      throw new DeckIrAiOutputError('An outline cannot be generated without inventory evidence.')
    }
    const result = await this.ai.generateJson<OutlineProposal>({
      purpose: 'outline',
      prompt: outlinePrompt(document),
      outputSchema: toOutputSchema(OutlineProposalSchema),
      reasoningEffort: 'high'
    })
    const proposal = OutlineProposalSchema.parse(result.value)
    const toTraceableText = (item: TraceableProposal): DeckIrTraceableText => ({
      id: this.idFactory('text'),
      text: item.text,
      sourceItemIds: item.sourceItemIds,
      claimIds: [],
      transform: 'compressed'
    })
    const generatedClaimIds: string[] = []
    const generatedClaims = proposal.slides.map((slide) => {
      const id = this.idFactory('claim')
      generatedClaimIds.push(id)
      return {
        id,
        text: slide.headline.text,
        sourceItemIds: slide.headline.sourceItemIds,
        kind: 'compressed' as const,
        status: 'supported' as const,
        createdBy: 'ai' as const
      }
    })
    const slides: DeckIrSlide[] = proposal.slides.map((slide, index) => ({
      id: this.idFactory('slide'),
      order: index + 1,
      role: slide.role,
      logicalStructure: slide.logicalStructure,
      ...(slide.customStructure ? { customStructure: slide.customStructure } : {}),
      headline: {
        ...toTraceableText(slide.headline),
        claimIds: [generatedClaimIds[index]]
      },
      body: slide.body.map(toTraceableText),
      ...(slide.takeaway ? { takeaway: toTraceableText(slide.takeaway) } : {}),
      claimIds: [generatedClaimIds[index]],
      dataRequirementIds: [],
      imageSlotIds: [],
      notes: slide.notes
    }))
    const next: DeckIrDocument = {
      ...document,
      claims: [...document.claims, ...generatedClaims],
      slides
    }
    assertDeckIrIntegrity(next)
    return next
  }
}
