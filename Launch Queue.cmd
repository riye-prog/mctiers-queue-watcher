@echo off
setlocal
where node.exe >nul 2>&1
if errorlevel 1 (
    echo Install Node.js 22 or newer from https://nodejs.org/ and reopen this launcher.
    pause
    exit /b 1
)
node "%~dp0launch-windows.mjs"
if errorlevel 1 (
    pause
    exit /b 1
)
