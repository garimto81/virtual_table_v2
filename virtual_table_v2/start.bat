@echo off
echo ========================================
echo Virtual Data Poker Manager v2.0 시작
echo ========================================
echo.

echo 의존성 설치 중...
call npm install

echo.
echo 서버 시작 중...
npm start

pause