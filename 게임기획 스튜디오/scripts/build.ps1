param(
  [ValidateSet('Debug', 'Release')]
  [string]$Configuration = 'Release',

  # 무엇을 다시 만들지 고른다. 여러 개를 함께 줄 수 있다.
  #   shell  = 스튜디오 본체 UI
  #   table  = 테이블 디자이너
  #   pattern= 패턴 디자이너
  #   deck   = PPT 디자이너
  #   review = AI 리뷰데이터 분석(파이썬 문법 검사)
  #   native = C++ 실행 파일
  #   all    = 전부 (기본값)
  # 예) .\scripts\build.ps1 -Only table
  #     .\scripts\build.ps1 -Only shell,native -SkipTests
  [ValidateSet('all', 'shell', 'table', 'pattern', 'deck', 'review', 'native')]
  [string[]]$Only = @('all'),

  # 테스트를 건너뛴다. 화면만 고쳤을 때 쓴다.
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'

function Want([string]$name) { return ($Only -contains 'all') -or ($Only -contains $name) }
$runTests = -not $SkipTests
Write-Output "[build] 대상: $($Only -join ', ') / 테스트: $(if ($runTests) { '실행' } else { '건너뜀' })"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Split-Path -Parent $projectRoot
$uiRoot = Join-Path $projectRoot 'ui'
$tableRoot = Join-Path $toolRoot '도구\테이블 디자이너\프로그램'
$tableDist = Join-Path $tableRoot 'dist-studio'
$patternRoot = Join-Path $toolRoot '도구\패턴 디자이너'
$patternDist = Join-Path $patternRoot 'dist-studio'
$deckRoot = Join-Path $toolRoot '도구\PPT 디자이너\game-ppt-designer-next'
$deckDist = Join-Path $deckRoot 'apps\workbench\dist'
$reviewRoot = Join-Path $toolRoot '도구\AI 리뷰데이터 분석\프로그램'
$buildRoot = Join-Path $projectRoot 'build'
# 도구 빌드 결과는 스튜디오 UI 빌드 폴더(ui\dist) 밖에 둔다.
# ui\dist는 셸을 빌드할 때마다 통째로 비워지므로, 그 안에 두면 셸만 다시 만들 때 도구가 사라진다.
$toolStage = Join-Path $buildRoot 'ui-tools'
$hostedTools = [ordered]@{ table = '테이블 디자이너'; pattern = '패턴 디자이너'; deck = 'PPT 디자이너' }
# 도구 안의 스크립트가 pnpm을 직접 부른다. PATH에 pnpm이 없으면 corepack으로 이어준다.
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  $shimDir = Join-Path $buildRoot 'bin'
  New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $shimDir 'pnpm.cmd') -Value '@corepack pnpm %*' -Encoding ascii
  $env:PATH = "$shimDir;$env:PATH"
}
$bundledCMake ='C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$cmake = if (Test-Path -LiteralPath $bundledCMake) { $bundledCMake } else { 'cmake' }

if (Want 'shell') {
  Push-Location $uiRoot
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $uiRoot 'node_modules'))) {
      npm install
      if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    }
    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
    if ($runTests) {
      npm run test
      if ($LASTEXITCODE -ne 0) { throw 'UI tests failed.' }
    }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'UI build failed.' }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $tableRoot 'package.json'))) {
  throw "Table Designer source was not found: $tableRoot"
}

if (Want 'table') {
  Push-Location $tableRoot
  try {
    npm run build:studio
    if ($LASTEXITCODE -ne 0) { throw 'Table Designer hosted build failed.' }
  }
  finally {
    Pop-Location
  }

  $hostedTableUi = Join-Path $toolStage 'table'
  if (Test-Path -LiteralPath $hostedTableUi) {
    Remove-Item -LiteralPath $hostedTableUi -Recurse -Force
  }
  New-Item -ItemType Directory -Path $hostedTableUi -Force | Out-Null
  Copy-Item -Path (Join-Path $tableDist '*') -Destination $hostedTableUi -Recurse -Force
  Remove-Item -LiteralPath $tableDist -Recurse -Force
}

if (-not (Test-Path -LiteralPath (Join-Path $patternRoot 'package.json'))) {
  throw "Pattern Designer source was not found: $patternRoot"
}

if (Want 'pattern') {
  Push-Location $patternRoot
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $patternRoot 'node_modules'))) {
      npm install
      if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer npm install failed.' }
    }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer TypeScript check failed.' }
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer lint failed.' }
    if ($runTests) {
      npm test
      if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer tests failed.' }
    }
    npm run build:studio
    if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer hosted build failed.' }
  }
  finally {
    Pop-Location
  }

  $hostedPatternUi = Join-Path $toolStage 'pattern'
  if (Test-Path -LiteralPath $hostedPatternUi) {
    Remove-Item -LiteralPath $hostedPatternUi -Recurse -Force
  }
  New-Item -ItemType Directory -Path $hostedPatternUi -Force | Out-Null
  Copy-Item -Path (Join-Path $patternDist '*') -Destination $hostedPatternUi -Recurse -Force
  Remove-Item -LiteralPath $patternDist -Recurse -Force
}

if (-not (Test-Path -LiteralPath (Join-Path $deckRoot 'package.json'))) {
  throw "Deck Designer source was not found: $deckRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $reviewRoot 'main.py'))) {
  throw "AI Review Analytics source was not found: $reviewRoot"
}

$reviewPython = Join-Path $reviewRoot 'venv\Scripts\python.exe'
if ((Want 'review') -and (Test-Path -LiteralPath $reviewPython)) {
  Push-Location $reviewRoot
  try {
    $reviewSources = Get-ChildItem -LiteralPath $reviewRoot -File -Filter '*.py' |
      Select-Object -ExpandProperty FullName
    & $reviewPython -m py_compile $reviewSources
    if ($LASTEXITCODE -ne 0) { throw 'AI Review Analytics Python compile failed.' }
  }
  finally {
    Pop-Location
  }
}

if (Want 'deck') {
  Push-Location $deckRoot
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $deckRoot 'node_modules'))) {
      corepack pnpm install --frozen-lockfile
      if ($LASTEXITCODE -ne 0) { throw 'Deck Designer dependency install failed.' }
    }
    # verify = check + test. 테스트를 건너뛸 때는 타입 검사만 돌린다.
    if ($runTests) { corepack pnpm verify } else { corepack pnpm check }
    if ($LASTEXITCODE -ne 0) { throw 'Deck Designer verification failed.' }
    corepack pnpm build:studio
    if ($LASTEXITCODE -ne 0) { throw 'Deck Designer hosted build failed.' }
  }
  finally {
    Pop-Location
  }

  $hostedDeckUi = Join-Path $toolStage 'deck'
  if (Test-Path -LiteralPath $hostedDeckUi) {
    Remove-Item -LiteralPath $hostedDeckUi -Recurse -Force
  }
  New-Item -ItemType Directory -Path $hostedDeckUi -Force | Out-Null
  Copy-Item -Path (Join-Path $deckDist '*') -Destination $hostedDeckUi -Recurse -Force
}

if (Want 'native') {
  & $cmake -S $projectRoot -B $buildRoot -G 'Visual Studio 17 2022' -A x64
  if ($LASTEXITCODE -ne 0) { throw 'CMake configure failed.' }
  & $cmake --build $buildRoot --config $Configuration --parallel
  if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
  if ($runTests) {
    & $cmake --build $buildRoot --config $Configuration --target GameDesignStudioStoreTests --parallel
    if ($LASTEXITCODE -ne 0) { throw 'Native test build failed.' }
    & (Join-Path $buildRoot "$Configuration\GameDesignStudioStoreTests.exe")
    if ($LASTEXITCODE -ne 0) { throw 'Native persistence tests failed.' }
  }
}

# 배포 단계는 무엇을 다시 만들었든 항상 돈다.
# 도구 하나만 새로 만들어도 스튜디오가 읽는 app\assets\ui를 갱신해야 하기 때문이다.
$runtimeUi = Join-Path $projectRoot 'app\assets\ui'
if (Test-Path -LiteralPath $runtimeUi) {
  Remove-Item -LiteralPath $runtimeUi -Recurse -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $uiRoot 'dist\index.html'))) {
  throw "스튜디오 UI 빌드가 없습니다. -Only shell 로 한 번 만드세요."
}
$missing = @($hostedTools.Keys | Where-Object { -not (Test-Path -LiteralPath (Join-Path $toolStage "$_\index.html")) })
if ($missing.Count -gt 0) {
  $names = ($missing | ForEach-Object { $hostedTools[$_] }) -join ', '
  throw "빌드된 도구가 없습니다: $names. -Only $($missing -join ',') 로 먼저 만드세요."
}
New-Item -ItemType Directory -Path $runtimeUi -Force | Out-Null
Copy-Item -Path (Join-Path $uiRoot 'dist\*') -Destination $runtimeUi -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $runtimeUi 'tools') -Force | Out-Null
Copy-Item -Path (Join-Path $toolStage '*') -Destination (Join-Path $runtimeUi 'tools') -Recurse -Force

$exe = Join-Path $buildRoot "$Configuration\GameDesignStudio.exe"
if (-not (Test-Path -LiteralPath $exe)) {
  if (Want 'native') { throw "Build completed without the expected executable: $exe" }
  throw "실행 파일이 아직 없습니다. 한 번은 -Only native 또는 전체 빌드가 필요합니다: $exe"
}

$portableExe = Join-Path $toolRoot ((Split-Path -Leaf $projectRoot) + '.exe')
# 실행 파일이 같으면 건너뛴다. 스튜디오가 켜져 있어 잠겨 있으면 화면(UI)은 이미 배포됐으니 경고만 한다.
$sameExe = (Test-Path -LiteralPath $portableExe) -and ((Get-FileHash -LiteralPath $exe).Hash -eq (Get-FileHash -LiteralPath $portableExe).Hash)
if (-not $sameExe) {
  try {
    Copy-Item -LiteralPath $exe -Destination $portableExe -Force -ErrorAction Stop
  }
  catch {
    Write-Warning "스튜디오가 켜져 있어 실행 파일을 바꾸지 못했습니다. 스튜디오를 끈 뒤 다시 빌드하거나 build\$Configuration\GameDesignStudio.exe를 복사하세요."
  }
}

Write-Output $portableExe
