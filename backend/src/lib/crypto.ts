import crypto from "crypto";
import { env } from "../env";

// Deriva uma chave de 32 bytes a partir do segredo configurado.
function getKey(): Buffer {
  return crypto.createHash("sha256").update(env.credentialsEncryptionKey).digest();
}

/**
 * Criptografa um texto (ex.: access_token / refresh_token da Shopee) antes de
 * armazenar no banco de dados. Nunca armazene tokens em texto puro.
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(".");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Formato de credencial criptografada inválido.");
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
