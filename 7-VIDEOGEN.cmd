@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "apps\VideoGen\scripts\start.ps1"
if errorlevel 1 pause
