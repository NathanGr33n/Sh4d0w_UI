# install-shell.ps1
# Installs Shadow UI as the current user's Windows shell (per-user, HKCU only).
#
# Usage (from a NON-elevated PowerShell):
#     pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-shell.ps1 -ShellExe 'C:\path\to\ShadowUI-Watchdog.exe'
#
# What it does:
#   1. Refuses to run elevated (per-user install only).
#   2. Validates the target executable exists.
#   3. Backs up any existing HKCU shell value to ShellBackup.
#   4. Sets HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon\Shell
#      to the provided executable.
#
# You must sign out and sign back in for the change to take effect.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ShellExe
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-IsElevated {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object System.Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (Test-IsElevated) {
    Write-Error "This script must be run as a standard (non-elevated) user. Per-user shell install writes only to HKCU."
    exit 2
}

if (-not (Test-Path -LiteralPath $ShellExe -PathType Leaf)) {
    Write-Error "Target executable does not exist: $ShellExe"
    exit 3
}

# Canonicalize the path so the registry value is unambiguous.
$ResolvedExe = (Resolve-Path -LiteralPath $ShellExe).ProviderPath

$WinlogonKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon'

if (-not (Test-Path -LiteralPath $WinlogonKey)) {
    New-Item -Path $WinlogonKey -Force | Out-Null
}

# Back up existing value (if present) unless we already have a backup.
$existing = (Get-ItemProperty -LiteralPath $WinlogonKey -Name Shell -ErrorAction SilentlyContinue).Shell
$hasBackup = $null -ne (Get-ItemProperty -LiteralPath $WinlogonKey -Name ShellBackup -ErrorAction SilentlyContinue)

if (-not $hasBackup) {
    if ($existing) {
        Write-Host "Backing up existing Shell value to ShellBackup: $existing"
        New-ItemProperty -LiteralPath $WinlogonKey -Name 'ShellBackup' -PropertyType String -Value $existing -Force | Out-Null
    } else {
        Write-Host "No existing Shell value; backup marker set to empty."
        New-ItemProperty -LiteralPath $WinlogonKey -Name 'ShellBackup' -PropertyType String -Value '' -Force | Out-Null
    }
}

New-ItemProperty -LiteralPath $WinlogonKey -Name 'Shell' -PropertyType String -Value $ResolvedExe -Force | Out-Null

Write-Host ""
Write-Host "Installed Shadow UI as the per-user shell." -ForegroundColor Green
Write-Host "  Shell       = $ResolvedExe"
Write-Host "  ShellBackup = $(if ($existing) { $existing } else { '(none)' })"
Write-Host ""
Write-Host "Sign out and sign back in for this change to take effect."
Write-Host "To revert, run: uninstall-shell.ps1"
