// Genera SESSION_SECRET y TOKEN_ENCRYPTION_KEY listos para pegar en .env.local y en Vercel.
import { randomBytes } from 'node:crypto';

console.log(`SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
console.log(`TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
