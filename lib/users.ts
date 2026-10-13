import bcrypt from 'bcryptjs';
import { env } from './env';
import type { Rol } from './session';

interface Usuario {
  user: string;
  hash: string;
  role: Rol;
}

function usuarios(): Usuario[] {
  try {
    // En .env.local los $ del hash van escapados (\$); según cómo se cargue el archivo, las barras
    // o unas comillas envolventes pueden llegar hasta acá.
    const crudo = env.appUsers().trim().replace(/^'(.*)'$/s, '$1').replace(/\\\$/g, '$');
    const lista = JSON.parse(crudo) as Usuario[];
    return Array.isArray(lista) ? lista.filter((u) => u.user && u.hash) : [];
  } catch {
    return [];
  }
}

// Hash de relleno: si el usuario no existe igual se compara, para no delatarlo por tiempo de respuesta.
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', 12);

export async function verificarUsuario(user: string, password: string): Promise<{ user: string; role: Rol } | null> {
  const u = usuarios().find((x) => x.user.toLowerCase() === user.trim().toLowerCase());
  const ok = await bcrypt.compare(password, u?.hash ?? HASH_RELLENO).catch(() => false);
  return u && ok ? { user: u.user, role: u.role === 'admin' ? 'admin' : 'viewer' } : null;
}

export const hayUsuarios = () => usuarios().length > 0;
