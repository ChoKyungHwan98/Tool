import { extractNumericTokens } from './factory'
import { inspectStoryboardDiversity } from '../design-engine/layout-engine'
import type {
  DeckIrClaim,
  DeckIrDocument,
  DeckIrInventoryItem,
  DeckIrTraceableText
} from './schema'

export type DeckIrIntegrityIssueCode =
  | 'duplicate-id'
  | 'missing-source'
  | 'missing-inventory-item'
  | 'missing-claim'
  | 'missing-slide'
  | 'missing-data-requirement'
  | 'missing-image-slot'
  | 'untraceable-text'
  | 'untraceable-number'
  | 'unsupported-claim'
  | 'invalid-slide-order'
  | 'invalid-custom-structure'
  | 'invalid-data-requirement'
  | 'invalid-design-reference'
  | 'invalid-layout-selection'
  | 'layout-repetition'

export interface DeckIrIntegrityIssue {
  code: DeckIrIntegrityIssueCode
  path: string
  message: string
  severity: 'error' | 'warning'
}

const duplicateIds = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

const collectEvidenceText = (
  traceable: Pick<DeckIrTraceableText, 'sourceItemIds' | 'claimIds'>,
  inventoryById: Map<string, DeckIrInventoryItem>,
  claimById: Map<string, DeckIrClaim>
): string => {
  const sourceIds = new Set(traceable.sourceItemIds)
  for (const claimId of traceable.claimIds) {
    for (const sourceId of claimById.get(claimId)?.sourceItemIds || []) sourceIds.add(sourceId)
  }
  return [...sourceIds]
    .map((sourceId) => inventoryById.get(sourceId)?.originalText || '')
    .join('\n')
}

const validateTraceableText = (
  traceable: DeckIrTraceableText,
  path: string,
  inventoryById: Map<string, DeckIrInventoryItem>,
  claimById: Map<string, DeckIrClaim>,
  issues: DeckIrIntegrityIssue[]
): void => {
  for (const sourceId of traceable.sourceItemIds) {
    if (!inventoryById.has(sourceId)) {
      issues.push({
        code: 'missing-inventory-item',
        path: `${path}.sourceItemIds`,
        message: `Unknown inventory item: ${sourceId}`,
        severity: 'error'
      })
    }
  }
  for (const claimId of traceable.claimIds) {
    if (!claimById.has(claimId)) {
      issues.push({
        code: 'missing-claim',
        path: `${path}.claimIds`,
        message: `Unknown claim: ${claimId}`,
        severity: 'error'
      })
    }
  }
  if (
    traceable.transform !== 'user-authored' &&
    traceable.sourceItemIds.length === 0 &&
    traceable.claimIds.length === 0
  ) {
    issues.push({
      code: 'untraceable-text',
      path,
      message: 'Generated or compressed text must cite inventory items or claims.',
      severity: 'error'
    })
  }
  const evidence = collectEvidenceText(traceable, inventoryById, claimById)
  for (const token of extractNumericTokens(traceable.text)) {
    if (!evidence.includes(token)) {
      issues.push({
        code: 'untraceable-number',
        path,
        message: `Numeric token is not present in cited evidence: ${token}`,
        severity: 'error'
      })
    }
  }
}

export const validateDeckIrIntegrity = (document: DeckIrDocument): DeckIrIntegrityIssue[] => {
  const issues: DeckIrIntegrityIssue[] = []
  const sourceById = new Map(document.sources.map((source) => [source.id, source]))
  const inventoryById = new Map(document.inventory.map((item) => [item.id, item]))
  const claimById = new Map(document.claims.map((claim) => [claim.id, claim]))
  const slideById = new Map(document.slides.map((slide) => [slide.id, slide]))
  const dataRequirementById = new Map(
    document.dataRequirements.map((requirement) => [requirement.id, requirement])
  )
  const imageSlotById = new Map(document.imageSlots.map((slot) => [slot.id, slot]))

  const allIds = [
    ...document.sources.map((item) => item.id),
    ...document.brief.contextSignals.map((item) => item.id),
    ...document.inventory.map((item) => item.id),
    ...document.claims.map((item) => item.id),
    ...document.slides.map((item) => item.id),
    ...document.slides.flatMap((slide) => [
      slide.headline.id,
      ...slide.body.map((item) => item.id),
      ...(slide.takeaway ? [slide.takeaway.id] : [])
    ]),
    ...document.dataRequirements.map((item) => item.id),
    ...document.imageSlots.map((item) => item.id),
    ...(document.designPlan?.directions.map((item) => item.id) || []),
    ...(document.designPlan?.storyboard.flatMap((item) => [
      ...item.candidates.map((candidate) => candidate.id)
    ]) || [])
  ]
  for (const id of duplicateIds(allIds)) {
    issues.push({
      code: 'duplicate-id',
      path: '$',
      message: `Duplicate DeckIR id: ${id}`,
      severity: 'error'
    })
  }

  document.inventory.forEach((item, index) => {
    if (!sourceById.has(item.sourceId)) {
      issues.push({
        code: 'missing-source',
        path: `inventory.${index}.sourceId`,
        message: `Unknown source: ${item.sourceId}`,
        severity: 'error'
      })
    }
  })

  document.claims.forEach((claim, index) => {
    for (const sourceItemId of claim.sourceItemIds) {
      if (!inventoryById.has(sourceItemId)) {
        issues.push({
          code: 'missing-inventory-item',
          path: `claims.${index}.sourceItemIds`,
          message: `Unknown inventory item: ${sourceItemId}`,
          severity: 'error'
        })
      }
    }
    if (claim.status === 'supported' && claim.sourceItemIds.length === 0) {
      issues.push({
        code: 'unsupported-claim',
        path: `claims.${index}`,
        message: 'A supported claim must cite at least one inventory item.',
        severity: 'error'
      })
    }
    const evidence = claim.sourceItemIds
      .map((sourceId) => inventoryById.get(sourceId)?.originalText || '')
      .join('\n')
    for (const token of extractNumericTokens(claim.text)) {
      if (!evidence.includes(token)) {
        issues.push({
          code: 'untraceable-number',
          path: `claims.${index}.text`,
          message: `Numeric token is not present in claim evidence: ${token}`,
          severity: 'error'
        })
      }
    }
  })

  const expectedOrders = document.slides.map((_slide, index) => index + 1)
  const actualOrders = document.slides.map((slide) => slide.order)
  if (actualOrders.some((order, index) => order !== expectedOrders[index])) {
    issues.push({
      code: 'invalid-slide-order',
      path: 'slides',
      message: 'Slide order must be unique and contiguous starting at 1.',
      severity: 'error'
    })
  }

  document.slides.forEach((slide, index) => {
    if (slide.logicalStructure === 'custom' && !slide.customStructure?.trim()) {
      issues.push({
        code: 'invalid-custom-structure',
        path: `slides.${index}.customStructure`,
        message: 'Custom logical structures require a description.',
        severity: 'error'
      })
    }
    validateTraceableText(
      slide.headline,
      `slides.${index}.headline`,
      inventoryById,
      claimById,
      issues
    )
    slide.body.forEach((text, bodyIndex) =>
      validateTraceableText(
        text,
        `slides.${index}.body.${bodyIndex}`,
        inventoryById,
        claimById,
        issues
      )
    )
    if (slide.takeaway) {
      validateTraceableText(
        slide.takeaway,
        `slides.${index}.takeaway`,
        inventoryById,
        claimById,
        issues
      )
    }
    for (const claimId of slide.claimIds) {
      if (!claimById.has(claimId)) {
        issues.push({
          code: 'missing-claim',
          path: `slides.${index}.claimIds`,
          message: `Unknown claim: ${claimId}`,
          severity: 'error'
        })
      }
    }
    for (const requirementId of slide.dataRequirementIds) {
      if (!dataRequirementById.has(requirementId)) {
        issues.push({
          code: 'missing-data-requirement',
          path: `slides.${index}.dataRequirementIds`,
          message: `Unknown data requirement: ${requirementId}`,
          severity: 'error'
        })
      }
    }
    for (const slotId of slide.imageSlotIds) {
      if (!imageSlotById.has(slotId)) {
        issues.push({
          code: 'missing-image-slot',
          path: `slides.${index}.imageSlotIds`,
          message: `Unknown image slot: ${slotId}`,
          severity: 'error'
        })
      }
    }
  })

  document.dataRequirements.forEach((requirement, index) => {
    if (requirement.slideId && !slideById.has(requirement.slideId)) {
      issues.push({
        code: 'missing-slide',
        path: `dataRequirements.${index}.slideId`,
        message: `Unknown slide: ${requirement.slideId}`,
        severity: 'error'
      })
    }
    if (requirement.status === 'provided') {
      if (
        !requirement.providedSourceItemId ||
        !inventoryById.has(requirement.providedSourceItemId)
      ) {
        issues.push({
          code: 'invalid-data-requirement',
          path: `dataRequirements.${index}.providedSourceItemId`,
          message: 'Provided data must reference a valid inventory item.',
          severity: 'error'
        })
      }
    }
  })

  document.imageSlots.forEach((slot, index) => {
    if (!slideById.has(slot.slideId)) {
      issues.push({
        code: 'missing-slide',
        path: `imageSlots.${index}.slideId`,
        message: `Unknown slide: ${slot.slideId}`,
        severity: 'error'
      })
    }
  })

  if (document.designPlan) {
    const contextSignalIds = new Set(document.brief.contextSignals.map((signal) => signal.id))
    const directionIds = new Set(document.designPlan.directions.map((direction) => direction.id))
    if (
      document.designPlan.selectedDirectionId &&
      !directionIds.has(document.designPlan.selectedDirectionId)
    ) {
      issues.push({
        code: 'invalid-design-reference',
        path: 'designPlan.selectedDirectionId',
        message: 'Selected design direction does not exist.',
        severity: 'error'
      })
    }
    document.designPlan.directions.forEach((direction, index) => {
      for (const signalId of direction.sourceSignalIds) {
        if (!contextSignalIds.has(signalId)) {
          issues.push({
            code: 'invalid-design-reference',
            path: `designPlan.directions.${index}.sourceSignalIds`,
            message: `Unknown context signal: ${signalId}`,
            severity: 'error'
          })
        }
      }
      for (const slideId of direction.heroSlideIds) {
        if (!slideById.has(slideId)) {
          issues.push({
            code: 'invalid-design-reference',
            path: `designPlan.directions.${index}.heroSlideIds`,
            message: `Unknown hero slide: ${slideId}`,
            severity: 'error'
          })
        }
      }
    })
    document.designPlan.storyboard.forEach((decision, index) => {
      if (!slideById.has(decision.slideId)) {
        issues.push({
          code: 'invalid-design-reference',
          path: `designPlan.storyboard.${index}.slideId`,
          message: `Unknown storyboard slide: ${decision.slideId}`,
          severity: 'error'
        })
      }
      const selected = decision.candidates.find(
        (candidate) => candidate.id === decision.selectedCandidateId
      )
      if (!selected) {
        issues.push({
          code: 'invalid-layout-selection',
          path: `designPlan.storyboard.${index}.selectedCandidateId`,
          message: 'Selected layout candidate does not exist.',
          severity: 'error'
        })
      }
      decision.candidates.forEach((candidate, candidateIndex) => {
        if (candidate.slideId !== decision.slideId) {
          issues.push({
            code: 'invalid-design-reference',
            path: `designPlan.storyboard.${index}.candidates.${candidateIndex}.slideId`,
            message: 'Layout candidate points to a different slide.',
            severity: 'error'
          })
        }
      })
    })
    for (const violation of inspectStoryboardDiversity(document.designPlan.storyboard).violations) {
      issues.push({
        code: 'layout-repetition',
        path: 'designPlan.storyboard',
        message: violation,
        severity: 'warning'
      })
    }
  }
  return issues
}

export class DeckIrIntegrityError extends Error {
  constructor(readonly issues: DeckIrIntegrityIssue[]) {
    super(`DeckIR integrity check failed with ${issues.length} issue(s).`)
    this.name = 'DeckIrIntegrityError'
  }
}

export const assertDeckIrIntegrity = (document: DeckIrDocument): void => {
  const issues = validateDeckIrIntegrity(document).filter((issue) => issue.severity === 'error')
  if (issues.length > 0) throw new DeckIrIntegrityError(issues)
}
