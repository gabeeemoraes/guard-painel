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


## Hospedagem em produção

O painel e a API rodam na Vercel. O banco PostgreSQL permanece no Neon.

- Painel: https://guard-painel-moraes-corp.vercel.app
- API: https://guard-painel-api-moraes-corp.vercel.app
- O navegador chama `/api` no domínio do painel; o rewrite encaminha à API.
- `FRONTEND_URL` e `BACKEND_PUBLIC_URL` na API devem ser `https://guard-painel-moraes-corp.vercel.app`. O callback precisa usar a mesma origem que iniciou a conexão para receber os cookies OAuth.
- Redirect URI do Mercado Livre: `https://guard-painel-moraes-corp.vercel.app/api/integrations/mercadolivre/callback`
- O fluxo do Mercado Livre envia PKCE S256 e state aleatório. Cadastre a Redirect URI exata no aplicativo do Mercado Livre.
- O build apenas gera Prisma e compila. Para uma instalação nova, execute `npm run db:setup` explicitamente contra o banco escolhido. Deploys comuns não alteram o esquema nem os usuários.
- Testes isolados do backend: `npm test`. Eles simulam a API do marketplace; a autorização real exige que o vendedor entre e autorize seu aplicativo.

Não excluir serviços anteriores antes de conferir login, autorização do vendedor e sincronização real na Vercel.

### Validação das integrações

Em Integrações, cadastre a URL de redirecionamento exibida para cada marketplace no respectivo aplicativo. Shopee usa produção por padrão, com Sandbox selecionável. TikTok Shop exige App Key, App Secret e Service ID (valor `service_id` do link de autorização do vendedor). Credenciais e opções são isoladas por empresa; alterar app ou ambiente exige reconectar.

Após autorizar a loja, use **Verificar conexão** para consultar a API real e **Sincronizar** para importar os produtos e pedidos. Os tokens são criptografados e renovados quando próximos da expiração. A importação inicial busca os últimos 90 dias, com intervalos menores na Shopee. O painel suporta uma loja por marketplace e empresa. Se o TikTok retornar várias lojas na primeira autorização, autorize somente a desejada; o sistema não escolhe uma silenciosamente.

Datas e períodos usam `America/Sao_Paulo` por padrão (configurável em `APP_TIME_ZONE`). O último dia de um período personalizado é incluído integralmente. Sincronização é manual; a função admite até 300 segundos e as chamadas externas têm limite de 25 segundos. Contas de grande volume podem exigir processamento em etapas; esta versão não implementa importação em fila nem webhooks de atualização automática. A página de publicidade depende de uma integração adicional de Ads e permanece sem dados quando não há importação de anúncios.

Os testes automatizados simulam as respostas dos provedores sem acessar contas reais. Eles não substituem a autorização do vendedor, a aprovação de escopos no aplicativo do marketplace e uma sincronização real de cada conta.
