import { describe, expect, it, vi } from 'vitest'
import {
  AutoLayoutTimeoutError,
  safelyTerminateLayoutEngine,
  settleAutoLayoutFit,
  withAutoLayoutTimeout,
} from './autoLayoutLifecycle'

describe('자동 배치 수명주기', () => {
  it('응답하지 않는 레이아웃 계산을 시간 초과로 종료한다', async () => {
    await expect(withAutoLayoutTimeout(new Promise(() => undefined), 'layout', 5)).rejects.toEqual(
      new AutoLayoutTimeoutError('layout'),
    )
  })

  it('화면 맞춤 Promise가 끝나지 않아도 완료 대기를 해제한다', async () => {
    await expect(settleAutoLayoutFit(new Promise(() => undefined), 5)).resolves.toBe('timed-out')
  })

  it('worker 종료 오류를 UI 작업 밖으로 전파하지 않는다', () => {
    const terminateWorker = vi.fn(() => {
      throw new TypeError('worker.terminate is not a function')
    })

    expect(() => safelyTerminateLayoutEngine({ terminateWorker })).not.toThrow()
    expect(terminateWorker).toHaveBeenCalledOnce()
  })
})
