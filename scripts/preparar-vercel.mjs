// Arma el archivo .env.vercel.local con las variables para pegar en Vercel
// (Settings → Environment Variables → pegar todo el contenido en el campo Key).
// Pide el secreto de Azure y las contraseñas sin mostrarlos; nada se imprime en pantalla.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DESTINO = '.env.vercel.local';
const MS_CLIENT_ID = '49d2515f-b36e-480d-aa54-902afa9bae29';
const DOMINIO = 'https://reportes-aquiestamospy.vercel.app';

function preguntar(texto) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error('Ejecutá este comando en una terminal (en VS Code: Terminal → Nueva terminal).'));
    stdout.write(texto);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let valor = '';
    const alRecibir = (trozo) => {
      // Al pegar llegan varios caracteres juntos: se procesan de a uno.
      for (const ch of trozo) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', alRecibir);
          stdout.write('\n');
          return resolve(valor.trim());
        }
        if (ch === '\u0003') {
          stdout.write('\n');
          process.exit(1);
        }
        if (ch === '\u007f' || ch === '\b') valor = valor.slice(0, -1);
        else if (ch >= ' ') valor += ch;
      }
    };
    stdin.on('data', alRecibir);
  });
}

async function contrasena(quien) {
  for (;;) {
    const a = await preguntar(`Contraseña para ${quien} (mínimo 10 caracteres, no se ve al escribir): `);
    if (a.length < 10) {
      console.log('  Muy corta. Probá de nuevo.');
      continue;
    }
    if (a === (await preguntar(`Repetí la contraseña de ${quien}: `))) return a;
    console.log('  No coinciden. Probá de nuevo.');
  }
}

console.log('\nPreparar variables para Vercel\n');
let secreto = '';
while (secreto.length < 20) {
  secreto = await preguntar('Pegá el Valor del secreto de Azure (MS_CLIENT_SECRET) y Enter (no se ve): ');
  if (secreto.length < 20) console.log('  Parece incompleto. Copialo de nuevo desde Azure.');
}
const claveMatias = await contrasena('matias');
const claveAriel = await contrasena('ariel');

console.log('\nGenerando…');
const usuarios = [
  { user: 'matias', hash: bcrypt.hashSync(claveMatias, 12), role: 'admin' },
  { user: 'ariel', hash: bcrypt.hashSync(claveAriel, 12), role: 'viewer' },
];

const lineas = [
  `MS_CLIENT_ID=${MS_CLIENT_ID}`,
  `MS_CLIENT_SECRET=${secreto}`,
  `MS_REDIRECT_URI=${DOMINIO}/api/microsoft/callback`,
  'APP_TIMEZONE=America/Asuncion',
  `SESSION_SECRET=${randomBytes(48).toString('base64url')}`,
  `TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  // Comillas simples: Vercel toma el contenido tal cual, con los $ del hash.
  `APP_USERS='${JSON.stringify(usuarios)}'`,
];
writeFileSync(DESTINO, `${lineas.join('\n')}\n`);

console.log(`
Listo. Se creó el archivo ${DESTINO} (no se sube a GitHub).

1. Abrilo en VS Code, seleccioná todo (Ctrl+A) y copiá (Ctrl+C).
2. En Vercel → Environment Variables → "Add Environment Variable".
3. Hacé clic en el campo Key y pegá (Ctrl+V): se cargan las 7 variables juntas.
4. Guardá y después hacé Redeploy.
5. Cuando la app funcione, borrá el archivo ${DESTINO}.
`);
