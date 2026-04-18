# recovery-explorer.ps1
# Emergency recovery: starts explorer.exe so a user stuck inside Shadow UI
# (or with a broken shell registration) can get back to a normal desktop.
#
# Usage (from ANY PowerShell, including one opened via the panic hotkey):
#     pwsh -NoProfile -ExecutionPolicy Bypass -File .\recovery-explorer.ps1

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$explorer = Join-Path $env:WINDIR 'explorer.exe'
if (-not (Test-Path -LiteralPath $explorer -PathType Leaf)) {
    Write-Error "explorer.exe not found at expected path: $explorer"
    exit 1
}

# Use Start-Process with -FilePath + -ArgumentList (no shell concatenation).
Start-Process -FilePath $explorer -ArgumentList @() -WindowStyle Normal | Out-Null
Write-Host "explorer.exe launched." -ForegroundColor Green
