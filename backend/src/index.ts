import app from "./app";

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`GUARD PAINEL backend rodando na porta ${port}`));
