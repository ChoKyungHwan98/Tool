import { z } from 'zod'

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const DesignDirectionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rationale: z.string().min(1),
    toneWords: z.array(z.string().min(1)).min(2).max(6),
    palette: z
      .object({
        canvas: HexColorSchema,
        surface: HexColorSchema,
        ink: HexColorSchema,
        muted: HexColorSchema,
        accent: HexColorSchema
      })
      .strict(),
    typography: z
      .object({
        titleCharacter: z.string().min(1),
        bodyCharacter: z.string().min(1),
        emphasisRule: z.string().min(1)
      })
      .strict(),
    motif: z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        usageRule: z.string().min(1)
      })
      .strict(),
    navigation: z.string().min(1),
    evidenceTreatment: z.string().min(1),
    shapeLanguage: z.string().min(1),
    sourceSignalIds: z.array(z.string().min(1)),
    heroSlideIds: z.array(z.string().min(1))
  })
  .strict()

export const LayoutFamilySchema = z.enum([
  'statement-field',
  'editorial-axis',
  'asymmetric-split',
  'shared-criteria',
  'mirrored-evidence',
  'progression-track',
  'staged-path',
  'causal-chain',
  'before-after-hinge',
  'system-map',
  'modular-matrix',
  'metric-stage',
  'chart-argument',
  'state-machine',
  'judgement-timeline',
  'annotated-artifact',
  'tradeoff-field',
  'spectrum-balance',
  'visual-canvas',
  'custom'
])

export const LayoutCandidateSchema = z
  .object({
    id: z.string().min(1),
    slideId: z.string().min(1),
    family: LayoutFamilySchema,
    visualForm: z.string().min(1),
    composition: z.string().min(1),
    dominantArtifact: z.string().min(1),
    readingPath: z.enum(['left-right', 'right-left', 'top-bottom', 'radial', 'center-out']),
    density: z.enum(['low', 'medium', 'high']),
    anchorZone: z.enum(['left', 'right', 'top', 'bottom', 'center', 'full']),
    hero: z.boolean(),
    componentRoles: z.array(z.string().min(1)).min(1),
    fingerprint: z.string().min(1),
    fitnessReasons: z.array(z.string().min(1)).min(1),
    score: z.number().finite()
  })
  .strict()

export const StoryboardDecisionSchema = z
  .object({
    slideId: z.string().min(1),
    candidates: z.array(LayoutCandidateSchema).min(2),
    selectedCandidateId: z.string().min(1),
    selectionReason: z.string().min(1)
  })
  .strict()

export const DeckDesignPlanSchema = z
  .object({
    directions: z.array(DesignDirectionSchema).min(2).max(3),
    selectedDirectionId: z.string().min(1).nullable(),
    storyboard: z.array(StoryboardDecisionSchema),
    generatedAt: z.number().int().nonnegative()
  })
  .strict()

export type DesignDirection = z.infer<typeof DesignDirectionSchema>
export type LayoutFamily = z.infer<typeof LayoutFamilySchema>
export type LayoutCandidate = z.infer<typeof LayoutCandidateSchema>
export type StoryboardDecision = z.infer<typeof StoryboardDecisionSchema>
export type DeckDesignPlan = z.infer<typeof DeckDesignPlanSchema>
