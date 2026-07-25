$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$releasePath = Join-Path $projectRoot "releases"
$archivePath = Join-Path $releasePath "compagnon-dd55-fr-0.8.0.zip"

if (-not (Test-Path -LiteralPath (Join-Path $distPath "manifest.json"))) {
  throw "Le build dist est absent. Exécutez npm run build avant l'empaquetage."
}

New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $archivePath -CompressionLevel Optimal
Write-Output $archivePath
