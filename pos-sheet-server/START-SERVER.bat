@echo off
title POS Mini - Sheet Server
echo ============================================
echo   POS-Sheet Server  (port 3000)
echo ============================================
cd /d "C:\Users\Rin\Desktop\pos-sheet-server\server"
echo [1] Kiem tra Node.js...
node --version
if errorlevel 1 (
    echo LỖI: Chua cai Node.js. Tai tai: https://nodejs.org
    pause
    exit
)
echo [2] Kiem tra thu muc...
echo Dang o: %CD%
echo.
echo [3] Khoi dong server...
echo.
node index.js
echo.
echo Server da dung.
pause
