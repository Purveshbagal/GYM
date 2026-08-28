import fs from "fs";
import crypto from "crypto";
import { getKeyPath } from "./paths";

/**
 * Encrypts secrets (Hikvision device password, backend agent token) at
 * rest with AES-256-GCM, so config.json never holds them in plain text.
 * The key lives in a separate file (agent.key) in the same protected
 * ProgramData folder — this is "not plaintext in the config," not a full
 * OS-keychain/DPAPI integration (that would pull in a native dependency
 * just for this). Anyone with filesystem access to the gym PC's
 * ProgramData folder as an admin could still decrypt it; the real
 * boundary here is the file-level ACLs Windows already puts on
 * ProgramData for non-admin users, same as most local agent credentials.
 */
function getOrCreateKey(): Buffer {
  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function encryptSecret(plainText: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const key = getOrCreateKey();
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed encrypted secret in config");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
