export const AUTO_LAYOUT_ENGINE_TIMEOUT_MS = 8_000
export const AUTO_LAYOUT_FIT_TIMEOUT_MS = 1_600

export class AutoLayoutTimeoutError extends Error {
  readonly phase: 'layout' | 'fit'

  constructor(phase: 'layout' | 'fit') {
    super(phase === 'layout' ? '자동 배치 계산 시간이 초과되었습니다.' : '자동 배치 화면 맞춤 시간이 초과되었습니다.')
    this.name = 'AutoLayoutTimeoutError'
    this.phase = phase
  }
}

export async function withAutoLayoutTimeout<T>(
  task: Promise<T>,
  phase: 'layout' | 'fit',
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AutoLayoutTimeoutError(phase)), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function settleAutoLayoutFit(
  task: Promise<unknown> | undefined,
  timeoutMs = AUTO_LAYOUT_FIT_TIMEOUT_MS,
): Promise<'completed' | 'timed-out' | 'failed'> {
  if (!task) return 'completed'

  try {
    await withAutoLayoutTimeout(task, 'fit', timeoutMs)
    return 'completed'
  } catch (error) {
    return error instanceof AutoLayoutTimeoutError ? 'timed-out' : 'failed'
  }
}

export function safelyTerminateLayoutEngine(engine: { terminateWorker(): void }): void {
  try {
    engine.terminateWorker()
  } catch {
    // Some browser worker adapters do not expose terminate(). Cleanup must not
    // leave the visible layout operation stuck or turn a completed layout into an error.
  }
}
