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
$nsisRoots = @()
if ($env:ELECTRON_BUILDER_CACHE) {
  $nsisRoots += (Join-Path $env:ELECTRON_BUILDER_CACHE "nsis")
}
if ($env:LOCALAPPDATA) {
  $nsisRoots += (Join-Path $env:LOCALAPPDATA "electron-builder\Cache\nsis")
  $nsisRoots += (Join-Path $env:LOCALAPPDATA "electron-builder\cache\nsis")
}
$makensis = $null
foreach ($root in ($nsisRoots | Select-Object -Unique)) {
  if (Test-Path -LiteralPath $root) {
    $makensis = Get-ChildItem -LiteralPath $root -Recurse -File -Filter "makensis.exe" |
      Select-Object -First 1
    if ($makensis) { break }
  }
}
if (-not $makensis) {
  $command = Get-Command "makensis.exe" -ErrorAction SilentlyContinue
  if ($command) { $makensis = Get-Item $command.Source }
}
if (-not $makensis) {
  # Runner Windows can discard the Electron Builder cache after packaging.
  # Download exactly the open-source NSIS archive electron-builder v26 uses.
  # SHA-512 below is the published electron-builder customNsisBinary checksum.
  $tag = "nsis-3.0.4.1"
  $archiveName = "nsis-3.0.4.1.7z"
  $expectedSha512 = "54a3228b361d98d749396a511b3e2dae5e250fef81bd83f68ab017a4c8a585e50fd2973dde22a5580a0ff38dd596b6a3f181b5f42567d23f9d0a8fe1511cfdf9"
  $archiveDir = Join-Path $env:RUNNER_TEMP "pdv-nsis-archive"
  $unpackDir = Join-Path $env:RUNNER_TEMP "pdv-nsis-unpack"
  New-Item -ItemType Directory -Force -Path $archiveDir, $unpackDir | Out-Null
  & gh release download $tag --repo "electron-userland/electron-builder-binaries" --pattern $archiveName --dir $archiveDir
  if ($LASTEXITCODE -ne 0) { throw "Could not download pinned NSIS from public GitHub Release" }
  $archive = Join-Path $archiveDir $archiveName
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash.ToLowerInvariant() -ne $expectedSha512) {
    throw "Downloaded NSIS bundle SHA-512 mismatch"
  }
  $sevenZip = Get-Command "7z.exe" -ErrorAction SilentlyContinue
  if (-not $sevenZip) {
    foreach ($candidate in @("C:\Program Files\7-Zip\7z.exe", "C:\Program Files (x86)\7-Zip\7z.exe")) {
      if (Test-Path -LiteralPath $candidate) {
        $sevenZip = Get-Item $candidate
        break
      }
    }
  }
  if (-not $sevenZip) { throw "7-Zip executable unavailable on Windows runner" }
  & $sevenZip.Source x "-o$unpackDir" -y $archive
  if ($LASTEXITCODE -ne 0) { throw "Cannot extract verified NSIS bundle" }
  $makensis = Get-ChildItem -LiteralPath $unpackDir -Recurse -File -Filter "makensis.exe" |
    Select-Object -First 1
}
if (-not $makensis) { throw "NSIS makensis.exe missing after verified extraction" }

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
