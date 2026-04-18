# uninstall-shell.ps1
# Restores the user's previous Windows shell by reverting changes made by
# install-shell.ps1. Writes only to HKCU and refuses to run elevated.
#
# Usage (from a NON-elevated PowerShell):
#     pwsh -NoProfile -ExecutionPolicy Bypass -File .\uninstall-shell.ps1
#
# What it does:
#   1. Refuses to run elevated.
#   2. Reads ShellBackup under HKCU\...\Winlogon.
#      - If the backup value is non-empty, restores Shell to it.
#      - If the backup value is empty OR missing, DELETES the Shell value so
#        Windows falls back to the default (explorer.exe).
#   3. Deletes the ShellBackup marker.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-IsElevated {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object System.Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (Test-IsElevated) {
    Write-Error "This script must be run as a standard (non-elevated) user."
    exit 2
}

$WinlogonKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon'

if (-not (Test-Path -LiteralPath $WinlogonKey)) {
    Write-Host "Nothing to do: HKCU Winlogon key does not exist."
    exit 0
}

$backup = Get-ItemProperty -LiteralPath $WinlogonKey -Name ShellBackup -ErrorAction SilentlyContinue

if ($null -ne $backup -and -not [string]::IsNullOrWhiteSpace($backup.ShellBackup)) {
    Write-Host "Restoring previous Shell value: $($backup.ShellBackup)"
    New-ItemProperty -LiteralPath $WinlogonKey -Name 'Shell' -PropertyType String -Value $backup.ShellBackup -Force | Out-Null
} else {
    Write-Host "No non-empty backup found; removing Shell value so Windows uses explorer.exe."
    Remove-ItemProperty -LiteralPath $WinlogonKey -Name 'Shell' -ErrorAction SilentlyContinue
}

Remove-ItemProperty -LiteralPath $WinlogonKey -Name 'ShellBackup' -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Per-user shell registration removed." -ForegroundColor Green
Write-Host "Sign out and sign back in to return to the default shell."
