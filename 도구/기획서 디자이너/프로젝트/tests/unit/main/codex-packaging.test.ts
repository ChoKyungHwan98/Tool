import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Codex desktop packaging', () => {
  it('keeps main-process transitive dependencies visible to electron-builder', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>
    }

    const packagedMainTransitiveDependencies = [
      '@cfworker/json-schema',
      'braces',
      'core-util-is',
      'data-uri-to-buffer',
      'fetch-blob',
      'fill-range',
      'formdata-polyfill',
      'has-flag',
      'immediate',
      'is-number',
      'lie',
      'longest-streak',
      'mdast-util-phrasing',
      'micromark-factory-destination',
      'micromark-factory-label',
      'micromark-factory-title',
      'micromark-factory-whitespace',
      'micromark-util-html-tag-name',
      'ms',
      'mustache',
      'node-domexception',
      'p-finally',
      'picomatch',
      'process-nextick-args',
      'setimmediate',
      'supports-color',
      'to-regex-range',
      'util-deprecate',
      'web-streams-polyfill',
      'zwitch'
    ]

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual(
      expect.arrayContaining(packagedMainTransitiveDependencies)
    )
  })

  it('ships the SDK and unpacks its native executable from app.asar', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const builderConfig = fs.readFileSync('electron-builder.yml', 'utf8')
    const afterPack = fs.readFileSync('build/after-pack.cjs', 'utf8')

    expect(packageJson.dependencies?.['@openai/codex-sdk']).toBeTruthy()
    expect(builderConfig).toContain('node_modules/@openai/codex*/**')
    expect(builderConfig).toContain('productName: 기획서 디자이너')
    expect(builderConfig).toContain('target: portable')
    expect(afterPack).toContain('optional bundled ffmpeg missing')
    expect(afterPack).not.toContain('throw new Error(`Missing bundled ffmpeg')
  })
})
