const unavailable = (): never => {
  throw new Error('스튜디오 웹 빌드에서는 Node 파일 시스템을 직접 사용할 수 없습니다.')
}

export default { promises: { mkdir: unavailable, writeFile: unavailable } }
