@echo off
setlocal enabledelayedexpansion
title GUARD PAINEL - Instalacao

echo ================================================
echo   GUARD PAINEL - Instalacao automatica
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Node.js nao foi encontrado no seu computador.
  echo.
  echo 1. Acesse https://nodejs.org
  echo 2. Baixe e instale a versao LTS.
  echo 3. Feche esta janela, abra o Prompt de Comando de novo e rode
  echo    o INSTALAR.bat novamente.
  echo.
  pause
  exit /b 1
)

echo Node.js encontrado. Continuando...
echo.

cd backend

echo [1/6] Instalando dependencias do backend (pode levar 1-2 minutos)...
call npm install
if errorlevel 1 goto :erro
echo.

if not exist .env (
  copy .env.example .env >nul
)

echo [2/6] Gerando chaves secretas automaticamente...
for /f %%i in ('node scripts\gen-secret.js 32') do set SESSION_SECRET=%%i
for /f %%i in ('node scripts\gen-secret.js 32') do set CRED_KEY=%%i
echo Chaves geradas.
echo.

echo [3/6] Configuracao dos dois usuarios
echo.
set /p ADMIN_EMAIL="E-mail do administrador: "
set /p ADMIN_PASSWORD="Senha do administrador: "
echo.
set /p SECOND_EMAIL="E-mail do usuario comum: "
set /p SECOND_PASSWORD="Senha do usuario comum: "
echo.

(
  echo SESSION_SECRET=!SESSION_SECRET!
  echo CREDENTIALS_ENCRYPTION_KEY=!CRED_KEY!
  echo ADMIN_EMAIL=!ADMIN_EMAIL!
  echo ADMIN_PASSWORD=!ADMIN_PASSWORD!
  echo SECONDARY_USER_EMAIL=!SECOND_EMAIL!
  echo SECONDARY_USER_PASSWORD=!SECOND_PASSWORD!
) > temp-env-input.txt

node scripts\set-env.js --from-file temp-env-input.txt
del temp-env-input.txt
echo.

echo [4/6] Preparando o banco de dados...
call npx prisma generate
if errorlevel 1 goto :erro
call npx prisma migrate dev --name init
if errorlevel 1 goto :erro
echo.

echo [5/6] Criando os usuarios iniciais...
call npm run seed
if errorlevel 1 goto :erro
echo.

cd ..

echo [6/6] Instalando dependencias do frontend (pode levar 1-2 minutos)...
cd frontend
call npm install
if errorlevel 1 goto :erro
cd ..

echo.
echo ================================================
echo   Instalacao concluida com sucesso!
echo.
echo   Para abrir o sistema, de agora em diante,
echo   basta clicar duas vezes em INICIAR.bat
echo ================================================
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] Algo deu errado durante a instalacao. Leia a mensagem
echo acima para entender o que falhou.
echo.
pause
exit /b 1
