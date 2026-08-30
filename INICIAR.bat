@echo off
title GUARD PAINEL - Iniciando

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Rode o INSTALAR.bat primeiro.
  pause
  exit /b 1
)

if not exist "%~dp0backend\.env" (
  echo [ERRO] O sistema ainda nao foi configurado.
  echo Rode o INSTALAR.bat primeiro.
  pause
  exit /b 1
)

echo Iniciando o backend...
start "GUARD PAINEL - Backend (nao feche)" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 3 /nobreak >nul

echo Iniciando o frontend...
start "GUARD PAINEL - Frontend (nao feche)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Aguardando o sistema subir...
timeout /t 6 /nobreak >nul

start http://localhost:5173

echo.
echo O sistema deve abrir automaticamente no seu navegador.
echo Se nao abrir, acesse manualmente: http://localhost:5173
echo.
echo Duas janelas pretas ficarao abertas (backend e frontend) -
echo NAO feche essas janelas enquanto estiver usando o sistema.
echo Para encerrar tudo, e so fechar as duas janelas.
echo.
pause
