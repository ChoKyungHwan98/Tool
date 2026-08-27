export function contextMenuPosition(x: number, y: number, width = 196, height = 64) {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - width)),
    y: Math.max(8, Math.min(y, window.innerHeight - height)),
  }
}
