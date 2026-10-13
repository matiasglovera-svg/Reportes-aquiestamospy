import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

function clave(): Buffer {
  const k = Buffer.from(env.tokenKey(), 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en base64 (npm run gen-secrets).');
  return k;
}

/** AES-256-GCM. Salida: base64(iv[12] | tag[16] | cifrado). */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), cifrado]).toString('base64');
}

export function descifrar(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', clave(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
