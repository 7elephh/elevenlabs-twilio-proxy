import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement AES-256-GCM des jetons OAuth avant stockage.
 * La clé (32 octets, base64) vit uniquement dans les variables d'environnement.
 */
function key(b64: string): Buffer {
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("La clé de chiffrement doit faire 32 octets (base64).");
  return k;
}

export function encryptSecret(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, keyB64: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Format chiffré inconnu.");
  const decipher = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
