@echo off
rem NOVRA GYM: sunucu, kapı ekranı ve mobil geliştirme sunucusunu üç ayrı pencerede başlatır.
rem Çift tıklayın ya da terminalde .\baslat.cmd yazın.
chcp 65001 >nul
cd /d "%~dp0"

if not exist "server\.env" (
  echo server\.env bulunamadi. README.md icindeki "Ilk kurulum" adimlarini uygulayin.
  pause
  exit /b 1
)

if not exist "server\data\novra.db" (
  echo Ornek veritabani olusturuluyor...
  call npm --prefix server run seed
)

start "NOVRA GYM - Sunucu" cmd /k "cd /d %~dp0server && npm run dev"
start "NOVRA GYM - Kapi ekrani" cmd /k "cd /d %~dp0web && npm run dev"
start "NOVRA GYM - Mobil (Expo)" cmd /k "cd /d %~dp0mobile && npx expo start"

echo.
echo Kapi ekrani:  http://localhost:5173  (Chrome ile acin, kamera izni verin)
echo Telefon:      "Mobil (Expo)" penceresindeki QR kodunu Expo Go ile okutun
echo.
timeout /t 4 >nul
start "" http://localhost:5173
