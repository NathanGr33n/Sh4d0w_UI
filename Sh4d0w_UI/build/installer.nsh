; installer.nsh
; NSIS customization for Shadow UI.
;
; Intentionally does NOT modify the HKCU Winlogon Shell value. Flipping the
; Windows shell is a high-risk action and must be an explicit, informed
; choice the user makes *after* they've installed and tested the app. We
; instead add Start Menu shortcuts for the install / uninstall / recovery
; PowerShell scripts and for launching the app in shell mode.

!macro customInstall
  ; Create a "Shell Mode" sub-folder of the Start Menu shortcuts.
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode"

  ; Launch the app in shell (kiosk) mode directly, for testing.
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Launch Shadow UI (Shell Mode).lnk" \
    "$INSTDIR\${PRODUCT_FILENAME}.exe" "--shell" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0

  ; Shortcuts that invoke the registration scripts via PowerShell. We use
  ; -ExecutionPolicy Bypass only for this single invocation and always pass
  ; the script path with -File (no shell concatenation).
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Install as Windows Shell.lnk" \
    "powershell.exe" \
    "-NoProfile -ExecutionPolicy Bypass -File \"$INSTDIR\resources\scripts\install-shell.ps1\" -ShellExe \"$INSTDIR\${PRODUCT_FILENAME}.exe\"" \
    "powershell.exe" 0

  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Uninstall as Windows Shell.lnk" \
    "powershell.exe" \
    "-NoProfile -ExecutionPolicy Bypass -File \"$INSTDIR\resources\scripts\uninstall-shell.ps1\"" \
    "powershell.exe" 0

  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Recovery - Launch Explorer.lnk" \
    "powershell.exe" \
    "-NoProfile -ExecutionPolicy Bypass -File \"$INSTDIR\resources\scripts\recovery-explorer.ps1\"" \
    "powershell.exe" 0
!macroend

!macro customUnInstall
  ; Best-effort cleanup of the shortcuts we created. Do NOT touch the
  ; registry here: a user who uninstalls Shadow UI while it is still the
  ; registered shell needs to have explicitly run uninstall-shell.ps1 first.
  ; Removing the Shell value on their behalf, from an elevated uninstall
  ; context, could leave them with no shell at next login.
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Launch Shadow UI (Shell Mode).lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Install as Windows Shell.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Uninstall as Windows Shell.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode\Recovery - Launch Explorer.lnk"
  RMDir  "$SMPROGRAMS\${PRODUCT_NAME}\Shell Mode"
!macroend
