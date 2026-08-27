import { z } from 'zod'
import {
  DesignDirectionSchema,
  planDeckStoryboard,
  type DesignDirection
} from '@shared/design-engine'
import { assertDeckIrIntegrity, migrateDeckIrDocument, type DeckIrDocument } from '@shared/deck-ir'
import type { StructuredJsonGenerator } from './content-service'

const DirectionProposalSchema = DesignDirectionSchema.omit({ id: true })
const DirectionSetProposalSchema = z
  .object({ directions: z.array(DirectionProposalSchema).min(2).max(3) })
  .strict()

type DirectionSetProposal = z.infer<typeof DirectionSetProposalSchema>

export class DeckIrDesignOutputError extends Error {
  readonly code = 'DECK_IR_DESIGN_OUTPUT_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'DeckIrDesignOutputError'
  }
}

const defaultIdFactory = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16)
]

const luminance = (hex: string): number => {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export const colorContrastRatio = (left: string, right: string): number => {
  const brighter = Math.max(luminance(left), luminance(right))
  const darker = Math.min(luminance(left), luminance(right))
  return (brighter + 0.05) / (darker + 0.05)
}

const normalizeSignature = (value: string): string => value.toLowerCase().replace(/\s+/g, '')

const validateDirectionSet = (document: DeckIrDocument, directions: DesignDirection[]): void => {
  const signalIds = new Set(document.brief.contextSignals.map((signal) => signal.id))
  const slideIds = new Set(document.slides.map((slide) => slide.id))
  const names = new Set<string>()
  const motifs = new Set<string>()
  const accents = new Set<string>()
  for (const direction of directions) {
    if (colorContrastRatio(direction.palette.canvas, direction.palette.ink) < 4.5) {
      throw new DeckIrDesignOutputError(
        `Direction ${direction.name} does not provide readable canvas/ink contrast.`
      )
    }
    const name = normalizeSignature(direction.name)
    const motif = normalizeSignature(`${direction.motif.name}|${direction.motif.description}`)
    const accent = direction.palette.accent.toLowerCase()
    if (names.has(name) || motifs.has(motif) || accents.has(accent)) {
      throw new DeckIrDesignOutputError(
        'Design directions must differ in name, motif, and accent rather than being cosmetic variants.'
      )
    }
    names.add(name)
    motifs.add(motif)
    accents.add(accent)
    if (document.brief.contextSignals.length > 0 && direction.sourceSignalIds.length === 0) {
      throw new DeckIrDesignOutputError(
        `Direction ${direction.name} must cite at least one context signal.`
      )
    }
    if (direction.sourceSignalIds.some((id) => !signalIds.has(id))) {
      throw new DeckIrDesignOutputError(
        `Direction ${direction.name} cites an unknown context signal.`
      )
    }
    if (direction.heroSlideIds.some((id) => !slideIds.has(id))) {
      throw new DeckIrDesignOutputError(`Direction ${direction.name} cites an unknown hero slide.`)
    }
    const requiredHeroCount = document.slides.length >= 6 ? 2 : document.slides.length > 0 ? 1 : 0
    if (direction.heroSlideIds.length > 4 || direction.heroSlideIds.length < requiredHeroCount) {
      throw new DeckIrDesignOutputError(
        `Direction ${direction.name} must identify ${requiredHeroCount} to 4 hero slides for this deck.`
      )
    }
  }
}

const designDirectionPrompt = (document: DeckIrDocument): string =>
  `
Propose 2 or 3 genuinely different art directions for this exact planning deck.

The goal is not to pick a generic presentation style. Translate the document's subject, audience,
argument, evidence types, and emotional register into visual language. A cute live-service game
content proposal and a severe combat-system analysis should naturally produce different directions,
but those examples are not categories or required fields.

Hard rules:
- Use only the supplied context signals and inventory. Do not invent facts about a company or product.
- sourceSignalIds and heroSlideIds must use only the supplied IDs.
- Each direction needs a distinct motif, accent, spatial character, and evidence treatment.
- The canvas and ink colors must meet readable text contrast. Use six-digit hex colors.
- Choose 2 to 4 spaced hero slides when the deck has at least 6 slides; otherwise choose 1 if possible.
- A motif is a reusable visual behavior, not a colored header bar or generic underline.
- Do not prescribe one repeated card layout. The layout engine handles each slide semantically.

Context signals:
${JSON.stringify(document.brief.contextSignals)}

Inventory:
${JSON.stringify(document.inventory.map(({ id, originalText, type, tags }) => ({ id, originalText, type, tags })))}

Slides:
${JSON.stringify(document.slides.map(({ id, order, role, logicalStructure, headline }) => ({ id, order, role, logicalStructure, headline: headline.text })))}
`.trim()

export class DeckIrDesignService {
  constructor(
    private readonly ai: StructuredJsonGenerator,
    private readonly idFactory: (prefix: string) => string = defaultIdFactory,
    private readonly now: () => number = Date.now
  ) {}

  async proposeDirections(input: unknown): Promise<DeckIrDocument> {
    const document = migrateDeckIrDocument(input)
    const result = await this.ai.generateJson<DirectionSetProposal>({
      purpose: 'design-direction',
      prompt: designDirectionPrompt(document),
      outputSchema: z.toJSONSchema(DirectionSetProposalSchema, {
        target: 'draft-7'
      }) as Record<string, unknown>,
      reasoningEffort: 'high'
    })
    const proposal = DirectionSetProposalSchema.parse(result.value)
    const directions: DesignDirection[] = proposal.directions.map((direction) => ({
      id: this.idFactory('direction'),
      ...direction
    }))
    validateDirectionSet(document, directions)
    const next: DeckIrDocument = {
      ...document,
      designPlan: {
        directions,
        selectedDirectionId: null,
        storyboard: [],
        generatedAt: this.now()
      }
    }
    assertDeckIrIntegrity(next)
    return next
  }

  selectDirection(input: unknown, directionId: string): DeckIrDocument {
    const document = migrateDeckIrDocument(input)
    const plan = document.designPlan
    const direction = plan?.directions.find((item) => item.id === directionId)
    if (!plan || !direction)
      throw new DeckIrDesignOutputError('Selected design direction not found.')
    const next: DeckIrDocument = {
      ...document,
      designPlan: {
        ...plan,
        selectedDirectionId: direction.id,
        storyboard: planDeckStoryboard(document, direction)
      }
    }
    assertDeckIrIntegrity(next)
    return next
  }
}
