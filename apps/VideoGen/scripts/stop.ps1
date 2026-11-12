$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $projectRoot '.runtime\processes.json'
if (Test-Path -LiteralPath $processFile) {
    $savedProcesses = Get-Content -LiteralPath $processFile | ConvertFrom-Json
    foreach ($processId in @($savedProcesses.backend, $savedProcesses.frontend)) {
        # Vite runs below npm on Windows. Terminate only the recorded launcher tree.
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if ($process -and ($process.CommandLine -match 'manage.py|node_modules/vite/bin/vite.js')) {
            & taskkill.exe /PID $processId /T /F
        }
    }
    Remove-Item -LiteralPath $processFile
}
