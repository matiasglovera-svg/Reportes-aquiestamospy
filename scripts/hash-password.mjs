// Genera un hash bcrypt sin mostrar la contraseña en pantalla ni guardarla en el historial.
import bcrypt from 'bcryptjs';

function ask(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error('Ejecutá este script en una terminal interactiva.'));
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        stdout.write('\n');
        process.exit(1);
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await ask('Contraseña: ');
const repeat = await ask('Repetir contraseña: ');
if (password !== repeat) {
  console.error('Las contraseñas no coinciden.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Usá al menos 10 caracteres.');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log('\nPara Vercel (campo "hash" de APP_USERS, tal cual):\n');
console.log(hash);
// En .env.local Next interpreta cada $ como una variable: hay que escaparlos.
console.log('\nPara .env.local (con cada $ escapado):\n');
console.log(hash.replaceAll('$', '\\$'));
