import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = TestResizeObserver
}
