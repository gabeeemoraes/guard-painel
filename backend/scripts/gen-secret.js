// Gera uma string hexadecimal aleatória, usada como segredo de sessão e
// chave de criptografia. Uso: node gen-secret.js <quantidade_de_bytes>
const crypto = require("crypto");
const bytes = parseInt(process.argv[2] || "32", 10);
process.stdout.write(crypto.randomBytes(bytes).toString("hex"));
