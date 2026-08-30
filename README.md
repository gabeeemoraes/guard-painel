# GUARD PAINEL

Plataforma privada de análise e gestão multi-marketplace (**Shopee, Mercado
Livre e TikTok Shop**). Frontend + backend + banco de dados reais,
autenticação de 2 usuários, integração real via OAuth com cada marketplace,
e sincronização de dados reais (produtos, pedidos, financeiro). **Nenhum
dado fictício é gerado em nenhum momento** — antes de conectar e sincronizar
pelo menos um marketplace, todas as páginas ficam vazias.

O Dashboard tem duas visões: **Consolidado** (os três marketplaces somados)
e **Separado** (comparativo lado a lado de cada um). As demais páginas
(Faturamento, Pedidos, Produtos, Curva ABC, Financeiro, Publicidade) também
têm um filtro para ver "Todos" ou um marketplace específico por vez.

## Aviso importante antes de começar

Este projeto **não roda "pronto" sem configuração** — e isso é proposital,
não uma limitação: os dados só existem depois que você conecta suas próprias
contas de vendedor. Para cada marketplace que quiser usar, você precisa de:

1. **Um app criado na plataforma de desenvolvedores daquele marketplace**
   (veja os links na seção 2), que fornece as credenciais de API.
2. **Uma URL pública HTTPS para o backend** (ex.: um domínio de um provedor
   como Railway/Render/VPS próprio) — todo marketplace exige isso para o
   callback do OAuth. Rodando só em `localhost`, o botão "Conectar" funciona,
   mas o marketplace não conseguirá chamar de volta o seu computador.
3. **Um banco de dados** — por padrão o projeto já vem configurado com
   SQLite (arquivo local, zero configuração) para você testar tudo
   localmente antes de publicar. Para produção, recomenda-se Postgres.

Você não precisa configurar os três marketplaces — pode ativar só o(s) que
usa. O que não for configurado simplesmente aparece como "Não configurado"
em Integrações, sem quebrar o resto do sistema.

A especificação de endpoints de cada marketplace usada aqui
(`shopeeClient.ts`, `mercadoLivreClient.ts`, `tiktokShopClient.ts`) segue a
documentação pública vigente na criação deste projeto. Marketplaces
ocasionalmente ajustam nomes de campos e endpoints — se algo retornar erro
inesperado, confira a documentação atual de cada um e ajuste o arquivo
correspondente conforme necessário.

## Estrutura do projeto

```
guard-painel/
├── backend/     # API Node + Express + TypeScript + Prisma
└── frontend/    # React + TypeScript + Vite
```

## 1. Instalação

### Pré-requisito único: Node.js

Instale o Node.js (versão LTS) em https://nodejs.org — é ele que traz o
`npm`/`npx` junto. Sem isso, nenhum comando abaixo funciona. Depois de
instalar, **feche e abra o terminal de novo** antes de continuar.

### Opção A — Instalação automática (recomendada)

Depois de instalar o Node.js:

- **Windows:** dê duplo clique em `INSTALAR.bat`. Ele instala tudo sozinho,
  gera as chaves secretas automaticamente, e só pergunta o e-mail/senha do
  administrador e do usuário comum. O sistema sempre usa exatamente esses dois perfis. Ao final, use
  `INICIAR.bat` sempre que quiser abrir o sistema — ele sobe o backend, o
  frontend e abre o navegador automaticamente.
- **Mac/Linux:** rode `./instalar.sh` no terminal, dentro da pasta do
  projeto. Depois, use `./iniciar.sh` para abrir o sistema.

Isso substitui todos os passos manuais das seções abaixo. Pule direto para
a seção **"2. Configurando cada marketplace"**.

### Opção B — Instalação manual (passo a passo, caso prefira controlar cada etapa)

#### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra `.env` e preencha, no mínimo:

```env
SESSION_SECRET="uma-string-aleatoria-bem-longa"
CREDENTIALS_ENCRYPTION_KEY="32-caracteres-aleatorios-aqui"
ADMIN_EMAIL="seu-email@exemplo.com"
ADMIN_PASSWORD="uma-senha-forte"
SECONDARY_USER_EMAIL="usuario@exemplo.com"
SECONDARY_USER_PASSWORD="outra-senha-forte"
```

As credenciais dos marketplaces não precisam ser colocadas no `.env`. Depois do login como administrador, abra **Integrações** e salve Partner ID/Key, Client ID/Secret ou App Key/Secret diretamente na interface. Elas ficam criptografadas no banco. Variáveis antigas no `.env` continuam funcionando apenas como retaguarda de compatibilidade.

Gere o banco e o cliente Prisma:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Crie os 2 usuários iniciais (administrador + usuário comum):

```bash
npm run seed
```

Inicie o backend:

```bash
npm run dev
```

O backend sobe em `http://localhost:4000`.

#### Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O frontend sobe em `http://localhost:5173` e já está configurado (via proxy
no `vite.config.ts`) para falar com o backend em `http://localhost:4000`.

Acesse `http://localhost:5173`, faça login com o e-mail/senha do
administrador definidos no `.env`, e o sistema abrirá completamente vazio,
como esperado.

## 2. Configurando cada marketplace

Antes de configurar qualquer marketplace, preencha estas duas variáveis
compartilhadas no `.env` do backend (usadas no callback de OAuth de todos):

```env
BACKEND_PUBLIC_URL=https://url-publica-do-seu-backend
FRONTEND_URL=https://url-do-seu-frontend
```

### Shopee

1. Crie uma conta e um app em https://open.shopee.com (ambiente "test"/sandbox
   para começar, "live" quando estiver pronto para produção).
2. Copie o **Partner ID** e a **Partner Key** do seu app.
3. No **Guard Painel → Integrações → Shopee**, preencha o Partner ID e a Partner Key e clique em **Salvar credenciais**.
4. No painel do app, cadastre a URL de redirecionamento:
   `https://url-publica-do-seu-backend/api/integrations/shopee/callback`

### Mercado Livre

1. Crie uma conta e uma aplicação em https://developers.mercadolivre.com.br
   → "Minhas aplicações" → "Criar nova aplicação".
2. Copie o **App ID (Client ID)** e a **Secret Key (Client Secret)**.
3. No **Guard Painel → Integrações → Mercado Livre**, preencha o Client ID e o Client Secret e clique em **Salvar credenciais**.
4. No painel da aplicação, cadastre a URL de redirecionamento:
   `https://url-publica-do-seu-backend/api/integrations/mercadolivre/callback`
5. **Atenção:** o "ID" que um vendedor te passa normalmente é o **User ID**
   dele (identifica a loja), não a credencial de API. A credencial de API
   (Client ID/Secret) é sua, do aplicativo — o vendedor só precisa autorizar
   seu app clicando em "Conectar" dentro do sistema.

### TikTok Shop

1. Crie uma conta de desenvolvedor e um app em https://partner.tiktokshop.com
2. Copie o **App Key** e o **App Secret**.
3. No **Guard Painel → Integrações → TikTok Shop**, preencha App Key e App Secret e clique em **Salvar credenciais**.
4. No painel do app, cadastre a URL de redirecionamento:
   `https://url-publica-do-seu-backend/api/integrations/tiktokshop/callback`

### Conectando e sincronizando

Depois de salvar as credenciais desejadas diretamente na tela de **Integrações**:

1. No sistema, vá em **Integrações**. Cada marketplace aparece em seu
   próprio card.
2. Clique em **Conectar** no card do marketplace desejado. Você será
   redirecionado para autorizar o acesso à sua loja e voltará
   automaticamente para o sistema.
3. Clique em **Sincronizar** naquele card. Acompanhe o progresso em tempo
   real. Ao final, Dashboard, Faturamento, Pedidos, Produtos e Curva ABC
   passam a mostrar os dados reais daquele marketplace — tanto na visão
   "Consolidado" quanto em "Separado".
4. Repita para os demais marketplaces que quiser conectar. Não é
   obrigatório conectar os três.

### Sobre a página de Publicidade

Cada marketplace expõe dados de anúncios através de um escopo de API de
Marketing separado, que precisa ser solicitado e aprovado especificamente
para o seu app de parceiro. Este projeto não inventa esses números: enquanto
essa integração específica não estiver habilitada para um marketplace, a
página Publicidade mostra "Dado não disponível" para ele, exatamente como
pedido.

## 3. Custos e cálculo de lucro/margem

Produtos importados de qualquer marketplace não trazem custo de aquisição
(nenhum marketplace tem essa informação). Cadastre o custo de cada produto em **Custos**: custo
do produto, embalagem, imposto e outros custos. A partir disso, o sistema
recalcula automaticamente lucro e margem de todos os pedidos já
sincronizados daquele produto, e passa a calcular corretamente os novos
pedidos sincronizados.

## 4. Usuários e permissões

- O **administrador** (criado a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`) tem
  acesso total e não pode ser desativado por esta interface.
- O **usuário comum** (criado a partir de `SECONDARY_USER_EMAIL`/
  `SECONDARY_USER_PASSWORD`) só é criado se essas variáveis estiverem
  preenchidas no `.env` no momento do `npm run seed`.
- Em **Configurações**, o administrador pode ativar/desativar o usuário
  comum, escolher quais páginas ele enxerga, redefinir a senha dele, e
  qualquer usuário pode trocar a própria senha.
- Não existe cadastro público — os únicos dois usuários possíveis são
  criados via variáveis de ambiente e o script de seed.

## 5. Build e publicação

### Backend
```bash
cd backend
npm run build
npm run prisma:deploy   # aplica migrations em produção
npm start
```
Para produção, troque o `provider` do `datasource` em `prisma/schema.prisma`
de `sqlite` para `postgresql` e aponte `DATABASE_URL` para seu banco Postgres
antes de rodar as migrations. Publique atrás de HTTPS (é exigência de todos
os marketplaces para o callback OAuth).

### Frontend
```bash
cd frontend
npm run build
```
Isso gera a pasta `frontend/dist` com os arquivos estáticos, prontos para
publicar em qualquer hospedagem estática (Vercel, Netlify, Nginx, etc.) —
configure o proxy/reverse proxy dela para encaminhar `/api/*` ao backend.

## 6. Segurança

- Tokens de acesso/refresh de todos os marketplaces são armazenados
  criptografados (AES-256-GCM) no banco — nunca em texto puro, nunca no
  frontend.
- Sessão via cookie `httpOnly`, `sameSite=lax`, JWT assinado com
  `SESSION_SECRET`.
- Rotas de API protegidas por autenticação + verificação de permissão por
  página.
- Rate limiting no endpoint de login.
- Logs de auditoria (login, logout, troca de senha, alterações de usuário,
  conectar/desconectar cada marketplace, atualização de custos) na tabela
  `AuditLog`.

## 7. Solução de problemas

| Sintoma | Causa provável |
|---|---|
| "Não configurado" no card de um marketplace | O administrador ainda não salvou as credenciais daquele marketplace em **Integrações** |
| Callback do OAuth não volta para o sistema | `BACKEND_PUBLIC_URL` não é uma URL pública HTTPS acessível pelo marketplace, ou não foi cadastrada no painel do app |
| "Falha ao renovar token: reconecte a loja" | O refresh token expirou/foi revogado — desconecte e conecte novamente aquele marketplace em Integrações |
| Todas as páginas mostram "Sem dados disponíveis" mesmo após conectar | Clique em "Sincronizar" no card daquele marketplace; se persistir, veja o histórico de sincronização (`SyncHistory`) para a mensagem de erro exata |
| Erro ao rodar `prisma generate` | Verifique conexão com a internet — o Prisma baixa um binário de engine na primeira geração |

## Escopo desta entrega

O projeto cobre a especificação completa pedida: autenticação de 2 usuários,
tema claro/escuro, dashboard com visão consolidada e separada por
marketplace, faturamento, pedidos, produtos, curva ABC,
financeiro/conciliação, custos, relatórios com exportação CSV, publicidade
(honesta sobre indisponibilidade), integração e sincronização real com
Shopee, Mercado Livre e TikTok Shop, e banco de dados real com todas as
tabelas pedidas. Ajustes finos de nomes de campos de cada API podem ser
necessários conforme sua conta de parceiro e a versão vigente da
documentação de cada marketplace.
