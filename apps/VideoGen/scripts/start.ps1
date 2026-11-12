$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Pokreni scripts\setup.ps1 prije prvog korištenja.' }
& $pythonPath manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { throw 'Priprema baze nije uspjela.' }
$runtimePath = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
foreach ($serverPort in @(8003,5176)) {
    if (Get-NetTCPConnection -LocalPort $serverPort -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $serverPort je već zauzet. Ako VideoGen radi, otvori http://127.0.0.1:5176. Inače prvo zaustavi postojeći server."
    }
}
& $pythonPath manage.py recover_demos
$backendProcess = Start-Process -FilePath $pythonPath -ArgumentList @('manage.py', 'runserver', '127.0.0.1:8003', '--noreload') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'django.log') -RedirectStandardError (Join-Path $runtimePath 'django-error.log')
$nodePath = (Get-Command node.exe).Source
$frontendProcess = Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'vite.log') -RedirectStandardError (Join-Path $runtimePath 'vite-error.log')
@{ backend = $backendProcess.Id; frontend = $frontendProcess.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimePath 'processes.json')
Write-Host 'VideoGen: http://127.0.0.1:5176'
Write-Host 'Za zaustavljanje koristi scripts\stop.ps1.'
