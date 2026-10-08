@echo off
setlocal
cd /d "%~dp0"
echo Kreiranje administratorskog racuna za Django admin i CRM.
call npm.cmd run admin
pause
