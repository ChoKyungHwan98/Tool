import { BrowserWindow, dialog, ipcMain } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  assertDeckIrIntegrity,
  extractNumericTokens,
  migrateDeckIrDocument,
  validateDeckIrIntegrity,
  type DeckIrDocument,
  type DeckIrIntegrityIssue
} from '@shared/deck-ir'
import type { IpcContext } from '../ipc/context'
import type { DeckIrRevisionActor } from '../db/database'
import { DeckIrRepository, type DeckIrRevisionSummary } from './repository'
import { DeckIrContentService } from './content-service'
import { DeckIrDesignService } from './design-service'
import { createStructuredAiRuntime } from '../ipc/runtime/structured-ai-runtime'
import { createSessionMasterIfMissing } from '../session/master-service'
import { planDeckStoryboard } from '@shared/design-engine'
import { exportDeckIrDocx, exportDeckIrPptx } from '../io/deck-ir-export'

const sanitizeExportName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || '기획서'

const requireRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DeckIR payload must be an object.')
  }
  return value as Record<string, unknown>
}

const requireString = (value: unknown, field: string): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`DeckIR ${field} is required.`)
  return text
}

const requireRevision = (value: unknown): number => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error('DeckIR revision must be a non-negative integer.')
  }
  return Number(value)
}

const requireActor = (value: unknown): DeckIrRevisionActor => {
  if (value === 'user' || value === 'ai' || value === 'system') return value
  throw new Error('DeckIR actor must be user, ai, or system.')
}

export interface DeckIrValidationResult {
  valid: boolean
  issues: DeckIrIntegrityIssue[]
}

export function registerDeckIrHandlers(ctx: IpcContext): void {
  const repository = new DeckIrRepository(ctx.db)

  ipcMain.handle(
    'deckIr:createWorkspace',
    async (_event, payload: unknown): Promise<DeckIrDocument> => {
      const input = requireRecord(payload)
      const title = requireString(input.title, 'title')
      const rawBrief = requireString(input.rawBrief, 'rawBrief')
      const sessionId = crypto.randomUUID()
      const storagePath = await ctx.resolveStoragePath()
      const projectDir = path.join(storagePath, sessionId)
      await fs.promises.mkdir(projectDir, { recursive: true })
      await ctx.ensureSessionAssets(projectDir)
      await createSessionMasterIfMissing(projectDir)
      await ctx.db.createSession({
        id: sessionId,
        title,
        topic: title,
        slideSizeId: 'wide-16-9',
        slideWidth: 1600,
        slideHeight: 900,
        provider: 'codex-local',
        model: 'account-default'
      })
      await ctx.db.updateSessionMetadata(sessionId, { source: 'deck-designer' })
      await ctx.db.createProject({
        session_id: sessionId,
        title,
        output_path: projectDir,
        root_path: projectDir
      })
      return repository.create({ sessionId, title, rawBrief })
    }
  )

  ipcMain.handle('deckIr:get', async (_event, payload: unknown) => {
    const input = requireRecord(payload)
    return repository.get(requireString(input.sessionId, 'sessionId'))
  })

  ipcMain.handle('deckIr:listWorkspaces', async () => {
    const documents = await repository.list()
    return documents
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((document) => ({
        sessionId: document.sessionId,
        title: document.title,
        revision: document.revision,
        slideCount: document.slides.length,
        inventoryCount: document.inventory.length,
        dataRequirementCount: document.dataRequirements.length,
        selectedDirectionName:
          document.designPlan?.directions.find(
            (direction) => direction.id === document.designPlan?.selectedDirectionId
          )?.name || null,
        updatedAt: document.updatedAt
      }))
  })

  ipcMain.handle('deckIr:create', async (_event, payload: unknown): Promise<DeckIrDocument> => {
    const input = requireRecord(payload)
    return repository.create({
      sessionId: requireString(input.sessionId, 'sessionId'),
      title: requireString(input.title, 'title'),
      rawBrief: typeof input.rawBrief === 'string' ? input.rawBrief : ''
    })
  })

  ipcMain.handle('deckIr:save', async (_event, payload: unknown): Promise<DeckIrDocument> => {
    const input = requireRecord(payload)
    return repository.save(input.document, {
      expectedRevision: requireRevision(input.expectedRevision),
      actor: requireActor(input.actor),
      reason: requireString(input.reason, 'reason')
    })
  })

  ipcMain.handle(
    'deckIr:validate',
    async (_event, payload: unknown): Promise<DeckIrValidationResult> => {
      const input = requireRecord(payload)
      const document = migrateDeckIrDocument(input.document)
      const issues = validateDeckIrIntegrity(document)
      return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
    }
  )

  ipcMain.handle(
    'deckIr:listRevisions',
    async (_event, payload: unknown): Promise<DeckIrRevisionSummary[]> => {
      const input = requireRecord(payload)
      return repository.listRevisions(requireString(input.sessionId, 'sessionId'))
    }
  )

  ipcMain.handle('deckIr:getRevision', async (_event, payload: unknown) => {
    const input = requireRecord(payload)
    return repository.getRevision(
      requireString(input.sessionId, 'sessionId'),
      requireRevision(input.revision)
    )
  })

  ipcMain.handle('deckIr:runStage', async (_event, payload: unknown): Promise<DeckIrDocument> => {
    const input = requireRecord(payload)
    const sessionId = requireString(input.sessionId, 'sessionId')
    const stage = requireString(input.stage, 'stage')
    const document = await repository.get(sessionId)
    if (!document) throw new Error(`DeckIR not found for session: ${sessionId}`)

    if (stage === 'select-direction') {
      const service = new DeckIrDesignService({
        generateJson: async () => {
          throw new Error('AI is not used while selecting a direction.')
        }
      })
      const next = service.selectDirection(
        document,
        requireString(input.directionId, 'directionId')
      )
      return repository.save(next, {
        expectedRevision: document.revision,
        actor: 'user',
        reason: 'Design direction selected'
      })
    }

    const runtime = await createStructuredAiRuntime(ctx)
    let next: DeckIrDocument
    if (stage === 'extract-inventory') {
      next = await new DeckIrContentService(runtime).extractInventory(document)
    } else if (stage === 'propose-outline') {
      next = await new DeckIrContentService(runtime).proposeOutline(document)
    } else if (stage === 'propose-directions') {
      next = await new DeckIrDesignService(runtime).proposeDirections(document)
    } else {
      throw new Error(`Unknown DeckIR stage: ${stage}`)
    }
    return repository.save(next, {
      expectedRevision: document.revision,
      actor: 'ai',
      reason: stage
    })
  })

  ipcMain.handle(
    'deckIr:updateBrief',
    async (_event, payload: unknown): Promise<DeckIrDocument> => {
      const input = requireRecord(payload)
      const sessionId = requireString(input.sessionId, 'sessionId')
      const rawBrief = requireString(input.rawBrief, 'rawBrief')
      const document = await repository.get(sessionId)
      if (!document) throw new Error(`DeckIR not found for session: ${sessionId}`)
      const sourceId = `source-${crypto.randomUUID()}`
      const inventoryId = `inventory-${crypto.randomUUID()}`
      const next: DeckIrDocument = {
        ...document,
        brief: { ...document.brief, rawText: rawBrief },
        sources: [
          ...document.sources,
          {
            id: sourceId,
            kind: 'user-input',
            name: 'Brief revision',
            rawText: rawBrief,
            createdAt: Date.now()
          }
        ],
        inventory: [
          ...document.inventory,
          {
            id: inventoryId,
            sourceId,
            originalText: rawBrief,
            type: 'reference',
            locator: { note: 'User-edited freeform brief' },
            verbatimNumbers: extractNumericTokens(rawBrief),
            tags: [],
            userConfirmed: true
          }
        ]
      }
      return repository.save(next, {
        expectedRevision: document.revision,
        actor: 'user',
        reason: 'Freeform brief edited'
      })
    }
  )

  ipcMain.handle(
    'deckIr:updateSlide',
    async (_event, payload: unknown): Promise<DeckIrDocument> => {
      const input = requireRecord(payload)
      const sessionId = requireString(input.sessionId, 'sessionId')
      const slideId = requireString(input.slideId, 'slideId')
      const headline = requireString(input.headline, 'headline')
      const body = Array.isArray(input.body)
        ? input.body.map((item) => String(item).trim()).filter(Boolean)
        : []
      const document = await repository.get(sessionId)
      if (!document) throw new Error(`DeckIR not found for session: ${sessionId}`)
      const slideIndex = document.slides.findIndex((slide) => slide.id === slideId)
      if (slideIndex < 0) throw new Error(`DeckIR slide not found: ${slideId}`)
      const sourceText = [headline, ...body].join('\n')
      const sourceId = `source-${crypto.randomUUID()}`
      const inventoryId = `inventory-${crypto.randomUUID()}`
      const slide = document.slides[slideIndex]
      const nextSlides = [...document.slides]
      nextSlides[slideIndex] = {
        ...slide,
        headline: {
          id: slide.headline.id,
          text: headline,
          sourceItemIds: [inventoryId],
          claimIds: [],
          transform: 'user-authored'
        },
        body: body.map((text) => ({
          id: `text-${crypto.randomUUID()}`,
          text,
          sourceItemIds: [inventoryId],
          claimIds: [],
          transform: 'user-authored' as const
        })),
        claimIds: []
      }
      const next: DeckIrDocument = {
        ...document,
        sources: [
          ...document.sources,
          {
            id: sourceId,
            kind: 'user-input',
            name: `User edit for slide ${slide.order}`,
            rawText: sourceText,
            createdAt: Date.now()
          }
        ],
        inventory: [
          ...document.inventory,
          {
            id: inventoryId,
            sourceId,
            originalText: sourceText,
            type: 'reference',
            locator: { note: `User edit for slide ${slide.order}` },
            verbatimNumbers: extractNumericTokens(sourceText),
            tags: [],
            userConfirmed: true
          }
        ],
        slides: nextSlides
      }
      return repository.save(next, {
        expectedRevision: document.revision,
        actor: 'user',
        reason: `Slide ${slide.order} content edited`
      })
    }
  )

  ipcMain.handle(
    'deckIr:selectLayout',
    async (_event, payload: unknown): Promise<DeckIrDocument> => {
      const input = requireRecord(payload)
      const sessionId = requireString(input.sessionId, 'sessionId')
      const slideId = requireString(input.slideId, 'slideId')
      const candidateId = requireString(input.candidateId, 'candidateId')
      const document = await repository.get(sessionId)
      const plan = document?.designPlan
      if (!document || !plan) throw new Error('DeckIR design plan not found.')
      const decision = plan.storyboard.find((item) => item.slideId === slideId)
      if (!decision?.candidates.some((candidate) => candidate.id === candidateId)) {
        throw new Error('DeckIR layout candidate not found.')
      }
      const next: DeckIrDocument = {
        ...document,
        designPlan: {
          ...plan,
          storyboard: plan.storyboard.map((item) =>
            item.slideId === slideId
              ? {
                  ...item,
                  selectedCandidateId: candidateId,
                  selectionReason: 'User-selected layout candidate.'
                }
              : item
          )
        }
      }
      assertDeckIrIntegrity(next)
      return repository.save(next, {
        expectedRevision: document.revision,
        actor: 'user',
        reason: `Layout selected for ${slideId}`
      })
    }
  )

  ipcMain.handle(
    'deckIr:regenerateSlideLayout',
    async (_event, payload: unknown): Promise<DeckIrDocument> => {
      const input = requireRecord(payload)
      const sessionId = requireString(input.sessionId, 'sessionId')
      const slideId = requireString(input.slideId, 'slideId')
      const document = await repository.get(sessionId)
      const plan = document?.designPlan
      const direction = plan?.directions.find((item) => item.id === plan.selectedDirectionId)
      if (!document || !plan || !direction) throw new Error('Selected design direction not found.')
      const regenerated = planDeckStoryboard(document, direction).find(
        (item) => item.slideId === slideId
      )
      if (!regenerated) throw new Error(`DeckIR slide not found: ${slideId}`)
      const next: DeckIrDocument = {
        ...document,
        designPlan: {
          ...plan,
          storyboard: plan.storyboard.map((item) => (item.slideId === slideId ? regenerated : item))
        }
      }
      return repository.save(next, {
        expectedRevision: document.revision,
        actor: 'system',
        reason: `Layout candidates regenerated for ${slideId}`
      })
    }
  )

  const registerDeckExport = (
    channel: 'deckIr:exportPptx' | 'deckIr:exportDocx',
    extension: 'pptx' | 'docx'
  ): void => {
    ipcMain.handle(channel, async (event, payload: unknown) => {
      const input = requireRecord(payload)
      const sessionId = requireString(input.sessionId, 'sessionId')
      const document = await repository.get(sessionId)
      if (!document) throw new Error(`DeckIR not found for session: ${sessionId}`)
      assertDeckIrIntegrity(document)
      if (document.slides.length === 0) throw new Error('내보낼 슬라이드가 없습니다.')
      const project = await ctx.db.getProject(sessionId)
      const storagePath = await ctx.resolveStoragePath()
      const baseDir = project?.output_path ? path.dirname(project.output_path) : storagePath
      const baseName = sanitizeExportName(document.title)
      const ownerWindow =
        BrowserWindow.fromWebContents(event.sender) ??
        BrowserWindow.getFocusedWindow() ??
        ctx.mainWindow
      const result = await dialog.showSaveDialog(ownerWindow, {
        title: extension === 'pptx' ? '편집 가능한 PPTX 내보내기' : 'Word 기획서 내보내기',
        defaultPath: path.join(baseDir, `${baseName}.${extension}`),
        filters: [
          extension === 'pptx'
            ? { name: 'PowerPoint', extensions: ['pptx'] }
            : { name: 'Word', extensions: ['docx'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })
      if (result.canceled || !result.filePath) return { success: false, cancelled: true }
      const exported =
        extension === 'pptx'
          ? await exportDeckIrPptx(result.filePath, document)
          : await exportDeckIrDocx(result.filePath, document)
      return { success: true, cancelled: false, ...exported }
    })
  }

  registerDeckExport('deckIr:exportPptx', 'pptx')
  registerDeckExport('deckIr:exportDocx', 'docx')
}
