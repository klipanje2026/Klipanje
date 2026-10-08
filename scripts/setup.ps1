$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instaliraj Node.js 22.13 ili noviji.' }
    node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || (a===22 && b>=13) ? 0 : 1)"
    if ($LASTEXITCODE -ne 0) { throw 'Potreban je Node.js 22.13 ili noviji.' }
    if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
        $pythonReady = $false
        if ($env:TITLOVI_PYTHON -and (Test-Path -LiteralPath $env:TITLOVI_PYTHON)) {
            & $env:TITLOVI_PYTHON -m venv .venv
            $pythonReady = $LASTEXITCODE -eq 0
        }
        if (-not $pythonReady -and (Get-Command py -ErrorAction SilentlyContinue)) {
            py -3 -m venv .venv
            $pythonReady = $LASTEXITCODE -eq 0
        }
        if (-not $pythonReady -and (Get-Command python -ErrorAction SilentlyContinue)) {
            python -m venv .venv
            $pythonReady = $LASTEXITCODE -eq 0
        }
        if (-not $pythonReady) { throw 'Instaliraj Python 3.12 ili noviji sa python.org, pa ponovi instalaciju.' }
    }
    & ./.venv/Scripts/python.exe -c 'import sys; assert sys.version_info >= (3, 12), "Potreban je Python 3.12 ili noviji"'
    if ($LASTEXITCODE -ne 0) { throw 'Python okruzenje nije ispravno.' }
    & ./.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Instalacija Python biblioteka nije uspjela.' }
    & npm.cmd ci --include=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Instalacija React biblioteka nije uspjela.' }
    node scripts/init-env.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Lokalne postavke nisu pripremljene.' }
    node scripts/backend.mjs migrate
    if ($LASTEXITCODE -ne 0) { throw 'Priprema baze nije uspjela.' }
    node scripts/backend.mjs bootstrap_local_users
    if ($LASTEXITCODE -ne 0) { throw 'Priprema lokalnih korisnika nije uspjela.' }
    Write-Host 'Instalacija zavrsena. Za novog administratora pokreni 4-ADMIN.cmd. Aplikaciju pokreni sa 3-POKRENI.cmd.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
