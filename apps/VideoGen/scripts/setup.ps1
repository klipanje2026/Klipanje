param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    & $Python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Kreiranje Python okruženja nije uspjelo.' }
}
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Instalacija Python biblioteka nije uspjela.' }
Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
try { & npm.cmd ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'Instalacija React biblioteka nije uspjela.' } } finally { Pop-Location }
& '.\.venv\Scripts\python.exe' manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { throw 'Priprema VideoGen baze nije uspjela.' }
Write-Host 'Spremno. Pokreni scripts\start.ps1.'
