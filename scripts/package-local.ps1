$ErrorActionPreference = 'Stop'
$packageRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
Set-Location -LiteralPath $packageRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Potreban je Git za pregled izvornog koda.' }
$candidates = & git -c core.quotepath=false ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) { throw 'Ne mogu procitati spisak izvornog koda.' }
$rootFiles = @('.env.example','.gitignore','.gitattributes','AGENTS.md','README.md','PRIJEDLOZI.txt','CISCENJE-I-PRENOS.txt','package.json','package-lock.json','1-INSTALIRAJ.cmd','3-POKRENI.cmd','4-ADMIN.cmd','5-PROMIJENI-LOZINKU.cmd','6-PAKET-ZA-DRUGI-RACUNAR.cmd')
$files = @($candidates | Sort-Object -Unique | Where-Object {
    $name = $_
    $allowed = ($rootFiles -contains $name) -or $name -match '^(frontend/(src/|public/|[^/]+\.(json|ts|js|html))|backend/(studio/|config/|templates/|manage\.py$|requirements[^/]*\.txt$)|scripts/|docs/)'
    $blocked = $name -match '(^|/)(node_modules|__pycache__|dist|work|media|\.local|\.git)(/|$)|\.(pyc|sqlite3|zip|log)$|(^|/)\.env$' -or $name -match '^tools/'
    $allowed -and -not $blocked -and (Test-Path -LiteralPath (Join-Path $packageRoot $name) -PathType Leaf)
})
if ($files.Count -lt 20) { throw 'Spisak za paket je nepotpun.' }
# Validate every path and scan text before opening the output archive.
foreach ($name in $files) {
    $path = [IO.Path]::GetFullPath((Join-Path $packageRoot $name))
    if (-not $path.StartsWith($packageRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Putanja izvan projekta.' }
    if ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Link nije dozvoljen u paketu: $name" }
    if ($name -match '\.(tsx?|jsx?|json|py|ps1|cmd|md|txt|html|scss|css)$') {
        $body = [IO.File]::ReadAllText($path)
        if ($body -match 'sk-proj-[A-Za-z0-9_-]{20,}|sk_[a-f0-9]{35,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----') { throw "Potencijalni kljuc u $name; paket nije napravljen." }
    }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$outputDir = Join-Path $packageRoot 'outputs'
[IO.Directory]::CreateDirectory($outputDir) | Out-Null
$destination = Join-Path $outputDir ('Klipanje-prenos-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
$stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($name in $files) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $packageRoot $name), $name.Replace('\','/'), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Host "Paket: $destination"
Write-Host ('Fajlova: {0}; velicina: {1:N1} MB. Bez projekata, kljuceva, baze i instaliranih biblioteka.' -f $files.Count, ((Get-Item -LiteralPath $destination).Length / 1MB))
