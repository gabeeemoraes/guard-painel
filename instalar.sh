#!/bin/bash
set -e

echo "================================================"
echo "  GUARD PAINEL - Instalacao automatica"
echo "================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js nao foi encontrado."
  echo "Acesse https://nodejs.org, instale a versao LTS e rode este script novamente."
  exit 1
fi

cd "$(dirname "$0")/backend"

echo "[1/6] Instalando dependencias do backend..."
npm install

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "[2/6] Gerando chaves secretas automaticamente..."
SESSION_SECRET=$(node scripts/gen-secret.js 32)
CRED_KEY=$(node scripts/gen-secret.js 32)

echo
echo "[3/6] Configuracao dos dois usuarios"
read -p "E-mail do administrador: " ADMIN_EMAIL
read -s -p "Senha do administrador: " ADMIN_PASSWORD
echo
read -p "E-mail do usuario comum: " SECOND_EMAIL
read -s -p "Senha do usuario comum: " SECOND_PASSWORD
echo

cat > /tmp/guard-painel-env-input.txt <<EOF
SESSION_SECRET=$SESSION_SECRET
CREDENTIALS_ENCRYPTION_KEY=$CRED_KEY
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
SECONDARY_USER_EMAIL=$SECOND_EMAIL
SECONDARY_USER_PASSWORD=$SECOND_PASSWORD
EOF

node scripts/set-env.js --from-file /tmp/guard-painel-env-input.txt
rm /tmp/guard-painel-env-input.txt

echo
echo "[4/6] Preparando o banco de dados..."
npx prisma generate
npx prisma migrate dev --name init

echo
echo "[5/6] Criando os usuarios iniciais..."
npm run seed

cd ..

echo
echo "[6/6] Instalando dependencias do frontend..."
cd frontend
npm install
cd ..

echo
echo "================================================"
echo "  Instalacao concluida com sucesso!"
echo "  Para abrir o sistema, rode: ./iniciar.sh"
echo "================================================"
