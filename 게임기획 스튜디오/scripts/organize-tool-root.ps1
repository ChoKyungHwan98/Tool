param(
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Split-Path -Parent $studioRoot
$toolsRoot = Join-Path $toolRoot '도구'

if ((Split-Path -Leaf $studioRoot) -ne '게임기획 스튜디오') {
  throw "예상하지 못한 통합 셸 위치입니다: $studioRoot"
}

function Assert-InToolRoot([string]$Path) {
  $rootPrefix = [System.IO.Path]::GetFullPath($toolRoot).TrimEnd('\') + '\'
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "게임기획 툴 폴더 밖의 경로는 변경할 수 없습니다: $fullPath"
  }
  return $fullPath
}

function Get-PathBytes([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0L }
  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    return (Get-Item -LiteralPath $Path).Length
  }
  return [long]((Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum)
}

function Remove-ExactPath([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0L }
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  [void](Assert-InToolRoot $resolved)

  $protected = @(
    [System.IO.Path]::GetFullPath($studioRoot),
    [System.IO.Path]::GetFullPath($toolsRoot)
  )
  if ($protected -contains [System.IO.Path]::GetFullPath($resolved)) {
    throw "보호된 상위 폴더는 삭제할 수 없습니다: $resolved"
  }

  $bytes = Get-PathBytes $resolved
  if ($WhatIf) {
    Write-Host ("[삭제 예정] {0} ({1:N1} MB)" -f $resolved, ($bytes / 1MB))
  } else {
    Remove-Item -LiteralPath $resolved -Recurse -Force
    Write-Host ("[삭제 완료] {0} ({1:N1} MB)" -f $resolved, ($bytes / 1MB))
  }
  return $bytes
}

$toolNames = @('테이블 디자이너', '패턴 디자이너', '기획서 디자이너')
foreach ($toolName in $toolNames) {
  $source = Join-Path $toolRoot $toolName
  $destination = Join-Path $toolsRoot $toolName
  if (-not (Test-Path -LiteralPath $source) -and -not (Test-Path -LiteralPath $destination)) {
    throw "보존해야 할 도구 폴더를 찾을 수 없습니다: $toolName"
  }
  [void](Assert-InToolRoot $source)
  [void](Assert-InToolRoot $destination)
}

$tableSource = Join-Path $toolRoot '테이블 디자이너'
$tableExecutableSource = Join-Path $tableSource '프로그램\src-tauri\target\debug\game-schema-workbench.exe'
$tableExecutableDestination = Join-Path $tableSource '테이블 디자이너.exe'
if ((Test-Path -LiteralPath $tableExecutableSource) -and -not (Test-Path -LiteralPath $tableExecutableDestination)) {
  if ($WhatIf) {
    Write-Output "[복사 예정] $tableExecutableSource -> $tableExecutableDestination"
  } else {
    Copy-Item -LiteralPath $tableExecutableSource -Destination $tableExecutableDestination
    Write-Output "[복사 완료] 테이블 디자이너 실행 파일을 보존했습니다."
  }
}

if ($WhatIf) {
  Write-Output "[생성 예정] $toolsRoot"
} else {
  New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
}

foreach ($toolName in $toolNames) {
  $source = Join-Path $toolRoot $toolName
  $destination = Join-Path $toolsRoot $toolName
  if (Test-Path -LiteralPath $source) {
    if (Test-Path -LiteralPath $destination) {
      $sourceItems = @(Get-ChildItem -LiteralPath $source -Force -ErrorAction Stop)
      if ($sourceItems.Count -eq 0) {
        if ($WhatIf) {
          Write-Output "[빈 구형 폴더 제거 예정] $source"
        } else {
          try {
            Remove-Item -LiteralPath $source -Force
            Write-Output "[빈 구형 폴더 제거 완료] $source"
          } catch [System.IO.IOException] {
            Write-Warning "현재 작업 위치 잠금으로 빈 구형 폴더를 남겼습니다: $source"
          }
        }
        continue
      }
      throw "도구가 양쪽 위치에 모두 존재해 자동 이동할 수 없습니다: $source / $destination"
    }
    if ($WhatIf) {
      Write-Output "[이동 예정] $source -> $destination"
    } else {
      try {
        Move-Item -LiteralPath $source -Destination $destination
        Write-Output "[이동 완료] $toolName"
      } catch [System.IO.IOException] {
        # Codex가 시작된 작업 폴더는 Windows가 디렉터리 이름 변경을 잠글 수 있다.
        # 이 경우 내부 항목을 같은 볼륨의 새 위치로 이동해 원본 데이터는 보존한다.
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
          Move-Item -LiteralPath $_.FullName -Destination $destination
        }
        Write-Output "[내부 이동 완료] $toolName (기존 빈 폴더는 잠금 해제 후 제거)"
        try {
          Remove-Item -LiteralPath $source -Force
          Write-Output "[빈 폴더 제거 완료] $source"
        } catch [System.IO.IOException] {
          Write-Warning "현재 작업 위치 잠금으로 빈 폴더를 남겼습니다: $source"
        }
      }
    }
  }
}

$tableRoot = if ($WhatIf) { Join-Path $toolRoot '테이블 디자이너\프로그램' } else { Join-Path $toolsRoot '테이블 디자이너\프로그램' }
$patternRoot = if ($WhatIf) { Join-Path $toolRoot '패턴 디자이너' } else { Join-Path $toolsRoot '패턴 디자이너' }
$deckRoot = if ($WhatIf) { Join-Path $toolRoot '기획서 디자이너' } else { Join-Path $toolsRoot '기획서 디자이너' }

$cleanupTargets = @(
  (Join-Path $toolRoot '_archive'),
  (Join-Path $toolRoot '.claude'),
  (Join-Path $studioRoot 'build'),
  (Join-Path $studioRoot 'ui\dist'),
  (Join-Path $tableRoot 'src-tauri\target'),
  (Join-Path $tableRoot '.worktrees'),
  (Join-Path $tableRoot 'dist'),
  (Join-Path $tableRoot 'test-results'),
  (Join-Path $tableRoot 'review-bundle.zip'),
  (Join-Path $tableRoot 'dev-server.out.log'),
  (Join-Path $tableRoot 'dev-server.err.log'),
  (Join-Path $patternRoot 'src-tauri\target'),
  (Join-Path $patternRoot 'dist'),
  (Join-Path $deckRoot '프로젝트\dist'),
  (Join-Path $deckRoot '프로젝트\out'),
  (Join-Path $deckRoot '프로젝트\logs')
)

$reclaimed = 0L
foreach ($target in $cleanupTargets) {
  $reclaimed += Remove-ExactPath $target
}

Write-Output ("정리 대상 합계: {0:N2} GB" -f ($reclaimed / 1GB))
if ($WhatIf) {
  Write-Output 'WhatIf 모드이므로 실제 파일은 변경하지 않았습니다.'
} else {
  Write-Output "완료: $toolRoot"
}
