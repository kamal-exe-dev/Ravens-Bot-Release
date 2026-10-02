param(
  [string]$SourceDirectory = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release'),
  [string]$ArchiveName = 'discord-role-bot-release.zip'
)

$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("discord-role-bot-release-" + [Guid]::NewGuid())
$archive = Join-Path $output $ArchiveName
$excludedDirectories = @('node_modules', '__MACOSX', '.git', 'release')
$excludedFiles = @('.DS_Store', '.env', 'bot.log')

try {
  New-Item -ItemType Directory -Force -Path $staging, $output | Out-Null

  Get-ChildItem -LiteralPath $source -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($source.Length).TrimStart('\', '/')
    $pathParts = $relativePath -split '[\\/]'
    $_.Name -notin $excludedFiles -and
    $_.Extension -ne '.zip' -and
    -not ($pathParts | Where-Object { $_ -in $excludedDirectories })
  } | ForEach-Object {
    $relativePath = $_.FullName.Substring($source.Length).TrimStart('\', '/')
    $destination = Join-Path $staging $relativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
  }

  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -Force
  Write-Output "Created release archive: $archive"
} finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
