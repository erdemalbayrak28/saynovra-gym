@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SAYNOVRA siberpunk reel uretiliyor (1080x1350, 30 fps)...
node render.mjs cyber
echo.
echo Video hazir: %~dp0cikti\saynovra-instagram-video-cyberpunk.mp4
pause
