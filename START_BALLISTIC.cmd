@echo off
setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

start /min "Ballistic Backend" powershell -NoExit -Command "Set-Location -LiteralPath '%BACKEND%'; py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start /min "Ballistic Frontend" powershell -NoExit -Command "Set-Location -LiteralPath '%FRONTEND%'; npm run dev -- --host 0.0.0.0 --port 5173"
timeout /t 5 >nul
start "" http://localhost:5173
