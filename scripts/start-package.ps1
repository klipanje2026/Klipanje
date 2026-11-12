$ErrorActionPreference = 'Stop'
$bundleRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $bundleRoot
function Test-Port([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
foreach ($pair in @(@(5175,8002), @(5176,8003))) {
    if ((Test-Port $pair[0]) -ne (Test-Port $pair[1])) {
        throw "Samo dio aplikacije radi na portovima $($pair -join ', '). Zatvori njeno prethodno pokretanje pa ponovi."
    }
}
foreach ($required in @('.venv/Scripts/python.exe', 'node_modules/vite/package.json', 'apps/VideoGen/.venv/Scripts/python.exe', 'apps/VideoGen/frontend/node_modules/vite/package.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $bundleRoot $required))) { throw 'Prvo pokreni 1-INSTALIRAJ.cmd.' }
}
if (-not (Test-Port 5176)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $bundleRoot 'apps/VideoGen/scripts/start.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'VideoGen nije pokrenut.' }
}
if (-not (Test-Port 5175)) {
    & node (Join-Path $bundleRoot 'scripts/init-env.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Postavke Klipanja nisu spremne.' }
    $logRoot = Join-Path $bundleRoot '.local/package'
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('scripts/dev.mjs') -WorkingDirectory $bundleRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'klipanje.log') -RedirectStandardError (Join-Path $logRoot 'klipanje-error.log')
    $process.Id | Set-Content -LiteralPath (Join-Path $logRoot 'process.txt')
}
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline -and (-not (Test-Port 5175) -or -not (Test-Port 8002) -or -not (Test-Port 5176) -or -not (Test-Port 8003))) { Start-Sleep -Milliseconds 500 }
foreach ($port in @(5175,8002,5176,8003)) {
    if (-not (Test-Port $port)) { throw "Server na portu $port nije spreman. Provjeri .local/package i apps/VideoGen/.runtime logove." }
}
Write-Host 'Klipanje: http://127.0.0.1:5175'
Write-Host 'EffectCraft: http://127.0.0.1:5175/slike-s-pokretima'
Write-Host 'VideoGen: http://127.0.0.1:5176'
Write-Host 'Postojeci serveri nisu ponovo pokrenuti. Suno se ne pokrece.'
