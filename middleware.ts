import { getIronSession } from 'iron-session';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionOptions, type Sesion } from './lib/session';

const PUBLICAS = ['/login', '/api/auth/login', '/api/microsoft/callback'];
const SOLO_ADMIN = ['/admin', '/api/admin', '/api/microsoft/login'];

const empiezaCon = (ruta: string, prefijos: string[]) => prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith('/api/');
  const res = NextResponse.next();
  const sesion = await getIronSession<Sesion>(req, res, sessionOptions());

  if (empiezaCon(pathname, PUBLICAS)) {
    if (pathname === '/login' && sesion.user) return NextResponse.redirect(new URL('/resumen', req.url));
    return res;
  }

  if (!sesion.user) {
    if (esApi) return NextResponse.json({ error: 'Sesión vencida. Volvé a iniciar sesión.' }, { status: 401 });
    const login = new URL('/login', req.url);
    if (pathname !== '/') login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  if (empiezaCon(pathname, SOLO_ADMIN) && sesion.role !== 'admin') {
    if (esApi) return NextResponse.json({ error: 'Solo el administrador puede hacer esto.' }, { status: 403 });
    return NextResponse.redirect(new URL('/resumen', req.url));
  }

  if (pathname === '/') return NextResponse.redirect(new URL('/resumen', req.url));
  return res;
}

export const config = {
  // Todo menos los estáticos de Next y los archivos de marca.
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|icon.svg|robots.txt).*)'],
};
