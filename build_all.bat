@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set build_failed=false

echo [1] flask_server.exe 삭제 중...
del /f /q backend\dist\flask_server.exe 2>nul

echo [2] 가상환경 진입 및 Flask 빌드...
call backend\venv\Scripts\activate
if errorlevel 1 (
  echo ❌ 가상환경 활성화 실패
  set build_failed=true
  goto :end
)

cd backend
pyinstaller --onefile --name flask_server --hidden-import engineio.async_drivers.threading app.py
if errorlevel 1 (
  echo ❌ flask_server 빌드 실패
  cd ..
  set build_failed=true
  goto :end
)
cd ..

echo [3] frontend/dist 폴더 삭제 중...
rmdir /s /q frontend\dist 2>nul

echo [4] frontend 빌드 시작...
cd frontend
call npm run build
if errorlevel 1 (
  echo ❌ frontend 빌드 실패
  cd ..
  set build_failed=true
  goto :end
)
cd ..


echo [5] dist 폴더 삭제 중...
rmdir /s /q dist 2>nul

echo [6] Electron 배포 파일 생성 전 프로세스 정리 중...
taskkill /f /im flask_server.exe >nul 2>&1
timeout /t 1 >nul

echo [7] Electron 배포 파일 생성 중...
call npm run dist
if errorlevel 1 (
  echo ❌ Electron 배포 실패
  set build_failed=true
)

:end
echo ------------------------------

if "%build_failed%"=="true" (
  echo ❌ 빌드 중 하나 이상이 실패했습니다.
) else (
  echo 🎉 모든 빌드가 성공적으로 완료되었습니다!
)

pause

