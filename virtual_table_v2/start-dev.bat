@echo off
echo ========================================
echo Virtual Data Poker Manager v2.0
echo 개발 모드
echo ========================================
echo.

echo 의존성 설치 중...
call npm install

echo.
echo 개발 서버 시작 중...
echo 서버: http://localhost:3000
echo.
npm run dev

pause