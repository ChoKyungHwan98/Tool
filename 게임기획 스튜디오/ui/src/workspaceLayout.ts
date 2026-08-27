import type { ConnectionState, ToolDefinition, WorkspaceNodeState } from './types';

const ORIGIN_X = 180;
const ORIGIN_Y = 150;
const COLUMN_GAP = 340;
const ROW_GAP = 178;

function copyAt(node: WorkspaceNodeState, column: number, row: number): WorkspaceNodeState {
  return { ...node, x: ORIGIN_X + column * COLUMN_GAP, y: ORIGIN_Y + row * ROW_GAP };
}

export function layoutByConnections(
  nodes: WorkspaceNodeState[],
  connections: ConnectionState[],
): WorkspaceNodeState[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of connections) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const connectedIds = new Set(connections.flatMap((edge) => [edge.from, edge.to]));
  const layerById = new Map<string, number>();
  const queue = nodes.filter((node) => connectedIds.has(node.id) && (indegree.get(node.id) ?? 0) === 0);
  queue.forEach((node) => layerById.set(node.id, 0));
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    const nextLayer = (layerById.get(node.id) ?? 0) + 1;
    for (const targetId of outgoing.get(node.id) ?? []) {
      layerById.set(targetId, Math.max(layerById.get(targetId) ?? 0, nextLayer));
      indegree.set(targetId, (indegree.get(targetId) ?? 1) - 1);
      if (indegree.get(targetId) === 0) queue.push(nodeById.get(targetId)!);
    }
  }

  // Cycles still get a deterministic lane instead of disappearing from layout.
  let cycleLayer = Math.max(0, ...layerById.values());
  nodes.filter((node) => connectedIds.has(node.id) && !layerById.has(node.id)).forEach((node) => {
    layerById.set(node.id, cycleLayer);
    cycleLayer += 1;
  });

  const rowsByLayer = new Map<number, number>();
  const connected = nodes.filter((node) => connectedIds.has(node.id)).map((node) => {
    const layer = layerById.get(node.id) ?? 0;
    const row = rowsByLayer.get(layer) ?? 0;
    rowsByLayer.set(layer, row + 1);
    return copyAt(node, layer, row);
  });
  const disconnectedStart = Math.max(1, ...rowsByLayer.values()) + 1;
  const disconnected = nodes.filter((node) => !connectedIds.has(node.id))
    .map((node, index) => copyAt(node, index % 3, disconnectedStart + Math.floor(index / 3)));
  return [...connected, ...disconnected];
}

export function layoutByCategory(nodes: WorkspaceNodeState[], tools: ToolDefinition[]): WorkspaceNodeState[] {
  const categoryByTool = new Map(tools.map((tool) => [tool.id, tool.category]));
  const categories = [...new Set(nodes.map((node) => categoryByTool.get(node.toolId) ?? '기타'))].sort();
  const rowByCategory = new Map(categories.map((category, index) => [category, index]));
  const columnByCategory = new Map<string, number>();
  return nodes.map((node) => {
    const category = categoryByTool.get(node.toolId) ?? '기타';
    const column = columnByCategory.get(category) ?? 0;
    columnByCategory.set(category, column + 1);
    return copyAt(node, column, rowByCategory.get(category) ?? 0);
  });
}

export function layoutAsGrid(nodes: WorkspaceNodeState[], columns = 3): WorkspaceNodeState[] {
  const safeColumns = Math.max(1, Math.floor(columns));
  return nodes.map((node, index) => copyAt(node, index % safeColumns, Math.floor(index / safeColumns)));
}
