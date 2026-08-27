import { describe, expect, it } from 'vitest'
import { commandFromToolMessage, TOOL_BRIDGE_CHANNEL } from './toolBroker'

describe('embedded tool broker', () => {
  it('uses the iframe tool identity instead of trusting a spoofed tool id', () => {
    const command = commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL,
      type: 'artifact:load',
      requestId: 'load-1',
      toolId: 'table-designer',
      artifactId: 'library',
    }, 'deck-designer')
    expect(command).toEqual({
      type: 'artifact:load', requestId: 'load-1', toolId: 'deck-designer', artifactId: 'library',
    })
  })

  it('rejects malformed save and publish requests', () => {
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'artifact:save', requestId: 'x', artifactId: 'a',
    }, 'deck-designer')).toBeNull()
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'artifact:publish', requestId: 'x', record: { title: 'missing' },
    }, 'deck-designer')).toBeNull()
  })

  it('passes explicit AI budget limits without accepting a tool supplied identity', () => {
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'ai:models', requestId: 'models', monthlyLimit: 10,
    }, 'deck-designer')).toEqual({ type: 'ai:models', requestId: 'models', monthlyLimit: 10 })
  })

  it('allows the table designer to use the shared project folder', () => {
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'tableProject:list', requestId: 'table-list',
    }, 'table-designer')).toEqual({ type: 'tableProject:list', requestId: 'table-list' })
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'tableProject:write', requestId: 'table-write',
      projectId: 'p1', name: '프로젝트', serializedDocument: '{}',
    }, 'table-designer')).toEqual({
      type: 'tableProject:write', requestId: 'table-write', projectId: 'p1', name: '프로젝트', serializedDocument: '{}',
    })
  })

  it('does not expose table project files to another embedded tool', () => {
    expect(commandFromToolMessage({
      channel: TOOL_BRIDGE_CHANNEL, type: 'tableProject:list', requestId: 'table-list',
    }, 'deck-designer')).toBeNull()
  })
})
