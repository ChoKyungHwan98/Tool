import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('independent product boundary', () => {
  it('does not contact or render the upstream update channel', () => {
    const lifecycle = fs.readFileSync('src/main/app/lifecycle.ts', 'utf8')
    const application = fs.readFileSync('src/main/app/application.ts', 'utf8')
    const rendererApp = fs.readFileSync('src/renderer/src/App.tsx', 'utf8')

    expect(lifecycle).not.toContain('ohmyppt.cc/version.json')
    expect(application).not.toContain('scheduleUpdateNotification')
    expect(rendererApp).not.toContain('UpdateAvailableDialog')
    expect(fs.existsSync('src/renderer/src/components/UpdateAvailableDialog.tsx')).toBe(false)
  })

  it('uses independent package, app, executable, and data identifiers', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      name: string
      version: string
    }
    const builder = fs.readFileSync('electron-builder.yml', 'utf8')
    const product = fs.readFileSync('src/shared/product.ts', 'utf8')

    expect(packageJson.name).toBe('deck-designer')
    expect(packageJson.version).toBe('0.1.0')
    expect(builder).toContain('appId: com.deckdesigner.desktop')
    expect(builder).toContain('productName: 기획서 디자이너')
    expect(builder).toContain('executableName: deck-designer')
    expect(product).toContain("PRODUCT_DATA_DIRECTORY = 'deck-designer'")
    expect(product).toContain("PRODUCT_DATABASE_FILE = 'deck-designer.db'")
  })

  it('makes the designer the default and keeps the upstream studio secondary', () => {
    const rendererApp = fs.readFileSync('src/renderer/src/App.tsx', 'utf8')
    const sidebar = fs.readFileSync('src/renderer/src/components/layout/Sidebar.tsx', 'utf8')

    expect(rendererApp).toContain('<Navigate to="/designer" replace />')
    expect(rendererApp).toContain('path="/studio" element={<HomePage />}')
    expect(sidebar).toContain("label: '새 기획서'")
    expect(sidebar).toContain("label: '슬라이드 작업실'")
    expect(sidebar).not.toContain('Oh My PPT')
  })
})
