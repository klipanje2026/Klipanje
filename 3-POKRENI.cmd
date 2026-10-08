@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing
if not exist "node_modules\vite\package.json" goto missing
if not exist ".venv\Scripts\python.exe" goto missing
node scripts/init-env.mjs
if errorlevel 1 goto missing
echo Otvori http://127.0.0.1:5175/titlovi nakon sto se server pokrene.
echo Prijavi se kao Naghun. Podaci ostaju na ovom racunaru.
echo Ostavi ovaj prozor otvoren. Za gasenje: Ctrl+C.
call npm.cmd run dev:all
if errorlevel 1 pause
exit /b
:missing
echo Prvo pokreni 1-INSTALIRAJ.cmd.
pause
exit /b 1
