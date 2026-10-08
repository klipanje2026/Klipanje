@echo off
cd /d "%~dp0"
echo Promjena lozinke lokalnog edita.ba racuna
echo.
node scripts/change-password.mjs
echo.
pause
