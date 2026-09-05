Unicode True
Name "PDV Nexus"
OutFile "dist-desktop\pdv-demo\PDV-Nexus-Setup-0.1.4-CORRIGIDO.exe"
InstallDir "$LOCALAPPDATA\Programs\PDV Nexus"
InstallDirRegKey HKCU "Software\PDV Nexus" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "0.1.4.0"
VIAddVersionKey "ProductName" "PDV Nexus"
VIAddVersionKey "ProductVersion" "0.1.4"
VIAddVersionKey "FileDescription" "Instalador do PDV Nexus"
VIAddVersionKey "FileVersion" "0.1.4"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Instalar PDV Nexus" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "dist-desktop\pdv-demo\win-unpacked\*.*"

  WriteRegStr HKCU "Software\PDV Nexus" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "DisplayName" "PDV Nexus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "DisplayVersion" "0.1.4"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "Publisher" "Nexus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "DisplayIcon" "$INSTDIR\PDV Nexus.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "UninstallString" "$INSTDIR\Desinstalar PDV Nexus.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Desinstalar PDV Nexus.exe"
  CreateDirectory "$SMPROGRAMS\PDV Nexus"
  CreateShortcut "$SMPROGRAMS\PDV Nexus\PDV Nexus.lnk" "$INSTDIR\PDV Nexus.exe"
  CreateShortcut "$SMPROGRAMS\PDV Nexus\Desinstalar PDV Nexus.lnk" "$INSTDIR\Desinstalar PDV Nexus.exe"
  CreateShortcut "$DESKTOP\PDV Nexus.lnk" "$INSTDIR\PDV Nexus.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\PDV Nexus.lnk"
  Delete "$SMPROGRAMS\PDV Nexus\PDV Nexus.lnk"
  Delete "$SMPROGRAMS\PDV Nexus\Desinstalar PDV Nexus.lnk"
  RMDir "$SMPROGRAMS\PDV Nexus"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDV Nexus"
  DeleteRegKey HKCU "Software\PDV Nexus"
SectionEnd
