@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SAYNOVRA Instagram 1080x1350 (4:5) MP4 Video Uretiliyor...
node render.mjs
echo.
echo Video hazir: %~dp0cikti\saynovra-instagram-video.mp4
pause

