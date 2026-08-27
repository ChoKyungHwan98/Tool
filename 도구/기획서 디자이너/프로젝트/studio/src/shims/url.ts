export const pathToFileURL = (value: string): { toString: () => string } => ({
  toString: () => value
})
