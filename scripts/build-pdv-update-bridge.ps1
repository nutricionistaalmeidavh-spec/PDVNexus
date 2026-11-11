param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateSet("Windows-10", "Windows-7", "Windows-8-32bit")][string]$Channel,
  [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = "Stop"
$installer = (Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop).Path
$expectedInstaller = switch ($Channel) {
  "Windows-10" { "PDV-Nexus-Setup-$Version.exe" }
  "Windows-7" { "PDV-Nexus-Windows-7-Setup-$Version.exe" }
  "Windows-8-32bit" { "PDV-Nexus-Windows-8-32bit-Setup-$Version.exe" }
}
if ((Split-Path $installer -Leaf) -cne $expectedInstaller) {
  throw "Unexpected installer: expected $expectedInstaller"
}
if ((Get-Item -LiteralPath $installer).Length -le 0) {
  throw "Source installer is empty: $installer"
}

# electron-builder has already downloaded and verified NSIS during this same Windows build.
# Reuse that cached binary: no apt, chocolatey or new network dependency at publication time.
$nsisCache = Join-Path $env:LOCALAPPDATA "electron-builder\Cache\nsis"
$makensis = $null
if (Test-Path -LiteralPath $nsisCache) {
  $makensis = Get-ChildItem -LiteralPath $nsisCache -Recurse -File -Filter "makensis.exe" |
    Select-Object -First 1
}
if (-not $makensis) {
  $command = Get-Command "makensis.exe" -ErrorAction SilentlyContinue
  if ($command) { $makensis = Get-Item $command.Source }
}
if (-not $makensis) {
  throw "NSIS compiler not found in electron-builder cache or PATH after successful installer build"
}

$bridgeName = "PDV-Nexus-Update-Bridge-$Channel-$Version.exe"
$output = Join-Path (Split-Path -Parent $installer) $bridgeName
$scriptFile = Join-Path $env:RUNNER_TEMP "pdv-bridge-$Channel.nsi"
$escapedInstaller = $installer.Replace('$', '$$')
$escapedOutput = $output.Replace('$', '$$')

$nsi = @"
Unicode true
Name "PDV Nexus Update Bridge"
OutFile "$escapedOutput"
RequestExecutionLevel user
SilentInstall silent
ShowInstDetails nevershow
Section
  SetOutPath "`$TEMP"
  File /oname=$expectedInstaller "$escapedInstaller"
  ExecShell "runas" "`$TEMP\$expectedInstaller"
SectionEnd
"@
try {
  [System.IO.File]::WriteAllText($scriptFile, $nsi, (New-Object System.Text.UTF8Encoding($false)))
  & $makensis.FullName -V2 $scriptFile
  if ($LASTEXITCODE -ne 0) { throw "makensis failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -le 0) {
    throw "Update bridge EXE not produced: $output"
  }
  Write-Host "Bridge: $output"
  Get-FileHash -LiteralPath $output -Algorithm SHA256 | Format-List
}
finally {
  Remove-Item -LiteralPath $scriptFile -Force -ErrorAction SilentlyContinue
}
