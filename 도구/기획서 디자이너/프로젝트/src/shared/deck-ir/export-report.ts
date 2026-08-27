export interface DeckIrExportReport {
  schemaVersion: 1
  generatedAt: number
  sessionId: string
  revision: number
  dataRequired: Array<{
    slideOrder: number | null
    field: string
    question: string
    reason: string
  }>
  imageSlots: Array<{
    slideOrder: number | null
    aspectRatio: string
    minResolution: string
    description: string
    composition: string
  }>
  contentMapping: Array<{
    slideOrder: number
    slideId: string
    inventoryIds: string[]
    claimIds: string[]
  }>
  aiTellAudit: {
    prohibitedPhraseHits: string[]
    repeatedLayoutRuns: string[]
  }
  storyboardChanges: Array<{
    slideId: string
    reason: string
  }>
  warnings: string[]
}
