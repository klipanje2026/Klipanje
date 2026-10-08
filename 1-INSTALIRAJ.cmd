@echo off
setlocal
cd /d "%~dp0"
echo Instalacija Django backenda i React frontenda.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
set "setup_result=%errorlevel%"
pause
exit /b %setup_result%
