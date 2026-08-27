const path = {
  dirname: (value: string): string => value.replace(/[\\/][^\\/]*$/, ''),
  join: (...parts: string[]): string => parts.join('/'),
  basename: (value: string): string => value.split(/[\\/]/).at(-1) || value
}

export default path
