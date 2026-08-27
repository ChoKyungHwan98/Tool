param(
  [ValidateSet('Debug', 'Release')]
  [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Split-Path -Parent $projectRoot
$uiRoot = Join-Path $projectRoot 'ui'
$tableRoot = Join-Path $toolRoot '도구\테이블 디자이너\프로그램'
$tableDist = Join-Path $tableRoot 'dist-studio'
$patternRoot = Join-Path $toolRoot '도구\패턴 디자이너'
$patternDist = Join-Path $patternRoot 'dist-studio'
$deckRoot = Join-Path $toolRoot '도구\기획서 디자이너\프로젝트'
$deckDist = Join-Path $deckRoot 'dist-studio'
$buildRoot = Join-Path $projectRoot 'build'
$bundledCMake = 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$cmake = if (Test-Path -LiteralPath $bundledCMake) { $bundledCMake } else { 'cmake' }

Push-Location $uiRoot
try {
  if (-not (Test-Path -LiteralPath (Join-Path $uiRoot 'node_modules'))) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  }
  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
  npm run test
  if ($LASTEXITCODE -ne 0) { throw 'UI tests failed.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'UI build failed.' }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $tableRoot 'package.json'))) {
  throw "Table Designer source was not found: $tableRoot"
}

Push-Location $tableRoot
try {
  npm run build:studio
  if ($LASTEXITCODE -ne 0) { throw 'Table Designer hosted build failed.' }
}
finally {
  Pop-Location
}

$hostedTableUi = Join-Path $uiRoot 'dist\tools\table'
if (Test-Path -LiteralPath $hostedTableUi) {
  Remove-Item -LiteralPath $hostedTableUi -Recurse -Force
}
New-Item -ItemType Directory -Path $hostedTableUi -Force | Out-Null
Copy-Item -Path (Join-Path $tableDist '*') -Destination $hostedTableUi -Recurse -Force
Remove-Item -LiteralPath $tableDist -Recurse -Force

if (-not (Test-Path -LiteralPath (Join-Path $patternRoot 'package.json'))) {
  throw "Pattern Designer source was not found: $patternRoot"
}

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
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer tests failed.' }
  npm run build:studio
  if ($LASTEXITCODE -ne 0) { throw 'Pattern Designer hosted build failed.' }
}
finally {
  Pop-Location
}

$hostedPatternUi = Join-Path $uiRoot 'dist\tools\pattern'
if (Test-Path -LiteralPath $hostedPatternUi) {
  Remove-Item -LiteralPath $hostedPatternUi -Recurse -Force
}
New-Item -ItemType Directory -Path $hostedPatternUi -Force | Out-Null
Copy-Item -Path (Join-Path $patternDist '*') -Destination $hostedPatternUi -Recurse -Force
Remove-Item -LiteralPath $patternDist -Recurse -Force

if (-not (Test-Path -LiteralPath (Join-Path $deckRoot 'package.json'))) {
  throw "Deck Designer source was not found: $deckRoot"
}

Push-Location $deckRoot
try {
  if (-not (Test-Path -LiteralPath (Join-Path $deckRoot 'node_modules'))) {
    corepack pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Deck Designer dependency install failed.' }
  }
  corepack pnpm exec tsc --noEmit -p studio/tsconfig.json
  if ($LASTEXITCODE -ne 0) { throw 'Deck Designer Studio TypeScript check failed.' }
  corepack pnpm exec vitest run tests/unit/studio/deck-studio.test.ts tests/unit/studio/preflight.test.ts tests/unit/io/deck-ir-export.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'Deck Designer Studio tests failed.' }
  corepack pnpm exec vite build --config studio/vite.config.ts
  if ($LASTEXITCODE -ne 0) { throw 'Deck Designer hosted build failed.' }
}
finally {
  Pop-Location
}

$hostedDeckUi = Join-Path $uiRoot 'dist\tools\deck'
if (Test-Path -LiteralPath $hostedDeckUi) {
  Remove-Item -LiteralPath $hostedDeckUi -Recurse -Force
}
New-Item -ItemType Directory -Path $hostedDeckUi -Force | Out-Null
Copy-Item -Path (Join-Path $deckDist '*') -Destination $hostedDeckUi -Recurse -Force
Remove-Item -LiteralPath $deckDist -Recurse -Force

& $cmake -S $projectRoot -B $buildRoot -G 'Visual Studio 17 2022' -A x64
if ($LASTEXITCODE -ne 0) { throw 'CMake configure failed.' }
& $cmake --build $buildRoot --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
& $cmake --build $buildRoot --config $Configuration --target GameDesignStudioStoreTests --parallel
if ($LASTEXITCODE -ne 0) { throw 'Native test build failed.' }
& (Join-Path $buildRoot "$Configuration\GameDesignStudioStoreTests.exe")
if ($LASTEXITCODE -ne 0) { throw 'Native persistence tests failed.' }

$exe = Join-Path $buildRoot "$Configuration\GameDesignStudio.exe"
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Build completed without the expected executable: $exe"
}

$runtimeUi = Join-Path $projectRoot 'app\assets\ui'
if (Test-Path -LiteralPath $runtimeUi) {
  Remove-Item -LiteralPath $runtimeUi -Recurse -Force
}
New-Item -ItemType Directory -Path $runtimeUi -Force | Out-Null
Copy-Item -Path (Join-Path $uiRoot 'dist\*') -Destination $runtimeUi -Recurse -Force

$portableExe = Join-Path $toolRoot ((Split-Path -Leaf $projectRoot) + '.exe')
Copy-Item -LiteralPath $exe -Destination $portableExe -Force

Write-Output $portableExe
