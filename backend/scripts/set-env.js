// Atualiza (ou cria) o arquivo .env a partir de pares KEY=VALUE, sem apagar
// o restante do arquivo. Uso:
//   node set-env.js CHAVE=valor OUTRA_CHAVE=valor
//   node set-env.js --from-file caminho/para/arquivo.txt
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const examplePath = path.join(__dirname, "..", ".env.example");

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
}

const args = process.argv.slice(2);
let pairs = [];

if (args[0] === "--from-file") {
  const filePath = args[1];
  const content = fs.readFileSync(filePath, "utf8");
  pairs = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1)];
    });
} else {
  pairs = args
    .filter((arg) => arg.includes("="))
    .map((arg) => {
      const idx = arg.indexOf("=");
      return [arg.slice(0, idx), arg.slice(idx + 1)];
    });
}

const updates = new Map(pairs);

let lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
const seen = new Set();

lines = lines.map((line) => {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
  if (match && updates.has(match[1])) {
    seen.add(match[1]);
    const value = updates.get(match[1]);
    return `${match[1]}="${value}"`;
  }
  return line;
});

for (const [key, value] of updates) {
  if (!seen.has(key)) {
    lines.push(`${key}="${value}"`);
  }
}

fs.writeFileSync(envPath, lines.join("\n"));
console.log(".env atualizado com sucesso.");
