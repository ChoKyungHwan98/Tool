type BrowserRequire = ((specifier: string) => never) & { resolve: (specifier: string) => string }

export const createRequire = (): BrowserRequire => {
  const browserRequire = ((specifier: string): never => {
    throw new Error(`브라우저 빌드에서는 Node 모듈을 불러올 수 없습니다: ${specifier}`)
  }) as BrowserRequire
  browserRequire.resolve = (specifier: string): string => specifier
  return browserRequire
}
