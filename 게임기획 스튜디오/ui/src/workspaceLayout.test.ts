import { describe, expect, it } from 'vitest';
import { layoutAsGrid, layoutByCategory, layoutByConnections } from './workspaceLayout';
import type { ConnectionState, ToolDefinition, WorkspaceNodeState } from './types';

const nodes: WorkspaceNodeState[] = [
  { id: 'table', toolId: 'table-designer', x: 0, y: 0 },
  { id: 'pattern', toolId: 'pattern-designer', x: 0, y: 0 },
  { id: 'deck', toolId: 'deck-designer', x: 0, y: 0 },
];
const edge: ConnectionState = { id: 'edge', from: 'table', to: 'pattern', kind: 'game-data', status: 'connected', createdAt: '' };
const tools = [
  { id: 'table-designer', category: '데이터' },
  { id: 'pattern-designer', category: '전투' },
  { id: 'deck-designer', category: '문서' },
] as ToolDefinition[];

describe('workspace layout', () => {
  it('places downstream nodes to the right and disconnected nodes below', () => {
    const result = layoutByConnections(nodes, [edge]);
    const table = result.find((node) => node.id === 'table')!;
    const pattern = result.find((node) => node.id === 'pattern')!;
    const deck = result.find((node) => node.id === 'deck')!;
    expect(pattern.x).toBeGreaterThan(table.x);
    expect(deck.y).toBeGreaterThan(table.y);
  });

  it('creates one horizontal lane per tool category', () => {
    const result = layoutByCategory(nodes, tools);
    expect(new Set(result.map((node) => node.y)).size).toBe(3);
  });

  it('creates a deterministic grid', () => {
    const result = layoutAsGrid(nodes, 2);
    expect(result[0].y).toBe(result[1].y);
    expect(result[2].y).toBeGreaterThan(result[0].y);
  });
});
