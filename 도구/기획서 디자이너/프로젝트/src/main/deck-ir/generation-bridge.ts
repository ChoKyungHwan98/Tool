import type { DesignDirection, StoryboardDecision } from '@shared/design-engine'
import { migrateDeckIrDocument } from '@shared/deck-ir'
import type { DeckIrDocumentRow } from '../db/schema'
import { formatAdaptiveLayoutPrompt, formatDesignDirectionPrompt } from './layout-bridge'
import { DeckIrChecksumMismatchError } from './repository'
import { sha256Text } from './stable-json'

export interface AdaptiveDeckDesign {
  direction: DesignDirection
  storyboard: StoryboardDecision[]
}

export const loadAdaptiveDeckDesign = async (
  db: {
    getDeckIrDocumentRow(sessionId: string): Promise<DeckIrDocumentRow | undefined>
  },
  sessionId: string
): Promise<AdaptiveDeckDesign | null> => {
  const row = await db.getDeckIrDocumentRow(sessionId)
  if (!row) return null
  if (sha256Text(row.documentJson) !== row.checksum) {
    throw new DeckIrChecksumMismatchError(row.sessionId, row.revision)
  }
  const document = migrateDeckIrDocument(JSON.parse(row.documentJson))
  if (document.sessionId !== row.sessionId || document.revision !== row.revision) {
    throw new DeckIrChecksumMismatchError(row.sessionId, row.revision)
  }
  const plan = document?.designPlan
  if (!plan?.selectedDirectionId || plan.storyboard.length === 0) return null
  const direction = plan.directions.find((item) => item.id === plan.selectedDirectionId)
  if (!direction) return null
  return { direction, storyboard: plan.storyboard }
}

export const resolveAdaptivePageLayout = (
  design: AdaptiveDeckDesign | null | undefined,
  pageId: string,
  pageNumber: number
): { layoutId: string; layoutPrompt: string } | null => {
  if (!design) return null
  const decision =
    design.storyboard.find((item) => item.slideId === pageId) || design.storyboard[pageNumber - 1]
  const candidate = decision?.candidates.find((item) => item.id === decision.selectedCandidateId)
  if (!candidate) return null
  return {
    layoutId: candidate.id,
    layoutPrompt: [
      formatDesignDirectionPrompt(design.direction),
      formatAdaptiveLayoutPrompt(candidate)
    ].join('\n\n')
  }
}
