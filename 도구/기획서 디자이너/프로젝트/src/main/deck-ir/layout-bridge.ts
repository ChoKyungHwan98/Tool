import type { DesignDirection, LayoutCandidate } from '@shared/design-engine'

export const formatDesignDirectionPrompt = (direction: DesignDirection): string =>
  [
    `Deck-specific art direction: ${direction.name}.`,
    `Why it fits: ${direction.rationale}`,
    `Tone: ${direction.toneWords.join(', ')}.`,
    `Palette roles: canvas ${direction.palette.canvas}; surface ${direction.palette.surface}; ink ${direction.palette.ink}; muted ${direction.palette.muted}; accent ${direction.palette.accent}.`,
    `Typography behavior: titles ${direction.typography.titleCharacter}; body ${direction.typography.bodyCharacter}; emphasis ${direction.typography.emphasisRule}.`,
    `Recurring motif: ${direction.motif.name} — ${direction.motif.description}. Rule: ${direction.motif.usageRule}`,
    `Navigation: ${direction.navigation}`,
    `Evidence treatment: ${direction.evidenceTreatment}`,
    `Shape language: ${direction.shapeLanguage}`,
    'Treat this as a visual grammar derived from this deck, not as a reusable industry template.'
  ].join('\n')

export const formatAdaptiveLayoutPrompt = (candidate: LayoutCandidate): string =>
  [
    `Adaptive layout decision: ${candidate.visualForm} (${candidate.family}).`,
    `Composition: ${candidate.composition}`,
    `Dominant artifact: ${candidate.dominantArtifact}.`,
    `Reading path: ${candidate.readingPath}; information density: ${candidate.density}; anchor: ${candidate.anchorZone}.`,
    `Required component roles: ${candidate.componentRoles.join(', ')}.`,
    candidate.hero
      ? 'This is a hero slide: break the ordinary grid and let one artifact dominate.'
      : 'Keep it in the deck rhythm while avoiding the fingerprint of adjacent slides.',
    'This describes information architecture. Do not copy a pixel template or default to repeated cards.'
  ].join('\n')
