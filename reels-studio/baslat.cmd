@echo off
chcp 65001 >nul
cd /d "%~dp0.."

start "SAYNOVRA - Instagram Video Stüdyosu" cmd /k "cd /d %~dp0..\web && npm run dev"
timeout /t 2 >nul
start "" "http://localhost:5173/#/reel"

