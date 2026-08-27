import type { DeckIrDocument } from '@shared/deck-ir'
import type { DeckIrExportReport } from '@shared/deck-ir'

export type { DeckIrExportReport } from '@shared/deck-ir'

const PROHIBITED_PHRASES = ['KEY SIGNAL', 'So-What', '결론적으로', '이를 통해', '압도적', '획기적']

const collectSlideInventoryIds = (
  document: DeckIrDocument,
  slideId: string
): { inventoryIds: string[]; claimIds: string[] } => {
  const slide = document.slides.find((item) => item.id === slideId)
  if (!slide) return { inventoryIds: [], claimIds: [] }
  const texts = [slide.headline, ...slide.body, ...(slide.takeaway ? [slide.takeaway] : [])]
  const claimIds = [...new Set([...slide.claimIds, ...texts.flatMap((text) => text.claimIds)])]
  const inventoryIds = new Set(texts.flatMap((text) => text.sourceItemIds))
  for (const claimId of claimIds) {
    const claim = document.claims.find((item) => item.id === claimId)
    for (const sourceItemId of claim?.sourceItemIds || []) inventoryIds.add(sourceItemId)
  }
  return { inventoryIds: [...inventoryIds], claimIds }
}

const repeatedLayoutRuns = (document: DeckIrDocument): string[] => {
  const storyboard = document.designPlan?.storyboard || []
  const families = storyboard.map((decision) => {
    const selected = decision.candidates.find(
      (candidate) => candidate.id === decision.selectedCandidateId
    )
    return selected?.family || 'unselected'
  })
  const results: string[] = []
  for (let index = 2; index < families.length; index += 1) {
    if (families[index] === families[index - 1] && families[index] === families[index - 2]) {
      results.push(`슬라이드 ${index - 1}-${index + 1}: ${families[index]}`)
    }
  }
  return results
}

export const buildDeckIrExportReport = (
  document: DeckIrDocument,
  options: {
    storyboardChanges?: DeckIrExportReport['storyboardChanges']
    warnings?: string[]
  } = {}
): DeckIrExportReport => {
  const slideOrderById = new Map(document.slides.map((slide) => [slide.id, slide.order]))
  const allVisibleText = document.slides
    .flatMap((slide) => [
      slide.headline.text,
      ...slide.body.map((item) => item.text),
      slide.takeaway?.text || ''
    ])
    .join('\n')

  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    sessionId: document.sessionId,
    revision: document.revision,
    dataRequired: document.dataRequirements
      .filter((item) => item.status === 'missing')
      .map((item) => ({
        slideOrder: item.slideId ? slideOrderById.get(item.slideId) || null : null,
        field: item.field,
        question: item.question,
        reason: item.reason
      })),
    imageSlots: document.imageSlots.map((slot) => ({
      slideOrder: slideOrderById.get(slot.slideId) || null,
      aspectRatio: slot.aspectRatio,
      minResolution: `${slot.minWidth}x${slot.minHeight}`,
      description: slot.description,
      composition: slot.composition
    })),
    contentMapping: document.slides.map((slide) => ({
      slideOrder: slide.order,
      slideId: slide.id,
      ...collectSlideInventoryIds(document, slide.id)
    })),
    aiTellAudit: {
      prohibitedPhraseHits: PROHIBITED_PHRASES.filter((phrase) =>
        allVisibleText.toLowerCase().includes(phrase.toLowerCase())
      ),
      repeatedLayoutRuns: repeatedLayoutRuns(document)
    },
    storyboardChanges: options.storyboardChanges || [],
    warnings: options.warnings || []
  }
}
