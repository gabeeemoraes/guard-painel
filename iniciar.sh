#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$DIR/backend/.env" ]; then
  echo "[ERRO] O sistema ainda nao foi configurado. Rode ./instalar.sh primeiro."
  exit 1
fi

echo "Iniciando o backend..."
(cd "$DIR/backend" && npm run dev) &
BACKEND_PID=$!

sleep 2

echo "Iniciando o frontend..."
(cd "$DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

sleep 3

if command -v open >/dev/null 2>&1; then
  open http://localhost:5173
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5173
fi

echo
echo "Sistema rodando. Pressione Ctrl+C para encerrar backend e frontend."
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
