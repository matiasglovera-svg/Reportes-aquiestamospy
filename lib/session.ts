import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { env } from './env';

export type Rol = 'admin' | 'viewer';

export interface Sesion {
  user?: string;
  role?: Rol;
  /** Anti-CSRF del flujo OAuth de Microsoft. */
  oauthState?: string;
}

export const DURACION_SESION = 12 * 60 * 60;

export function sessionOptions(): SessionOptions {
  const password = env.sessionSecret();
  if (password.length < 32) throw new Error('SESSION_SECRET debe tener 32+ caracteres (npm run gen-secrets).');
  return {
    password,
    cookieName: 'ae_sesion',
    ttl: DURACION_SESION,
    cookieOptions: { httpOnly: true, secure: env.produccion(), sameSite: 'lax', path: '/' },
  };
}

export async function getSesion(): Promise<IronSession<Sesion>> {
  return getIronSession<Sesion>(await cookies(), sessionOptions());
}

/** Para rutas de API: devuelve la sesión si hay usuario (y rol suficiente); si no, null. */
export async function sesionCon(rol?: Rol): Promise<IronSession<Sesion> | null> {
  const s = await getSesion();
  if (!s.user) return null;
  if (rol === 'admin' && s.role !== 'admin') return null;
  return s;
}

/** Las peticiones que modifican estado deben venir de la propia app. */
export function mismoOrigen(req: Request): boolean {
  const origen = req.headers.get('origin');
  if (!origen) return false;
  try {
    return new URL(origen).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  } catch {
    return false;
  }
}
