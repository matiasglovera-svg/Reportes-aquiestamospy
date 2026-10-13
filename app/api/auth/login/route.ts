import { NextResponse } from 'next/server';
import { intentoPermitido, limpiarIntentos } from '@/lib/ratelimit';
import { getSesion, mismoOrigen } from '@/lib/session';
import { hayUsuarios, verificarUsuario } from '@/lib/users';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const cuerpo = (await req.json().catch(() => null)) as { user?: unknown; password?: unknown } | null;
  const user = typeof cuerpo?.user === 'string' ? cuerpo.user.trim().slice(0, 64) : '';
  const password = typeof cuerpo?.password === 'string' ? cuerpo.password.slice(0, 200) : '';
  if (!user || !password) return NextResponse.json({ error: 'Ingresá usuario y contraseña.' }, { status: 400 });
  if (!hayUsuarios()) return NextResponse.json({ error: 'No hay usuarios configurados (APP_USERS).' }, { status: 500 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  const id = `${ip}:${user.toLowerCase()}`;
  const limite = await intentoPermitido(id);
  if (!limite.ok) {
    const minutos = Math.max(1, Math.ceil(limite.reintentarEn / 60));
    return NextResponse.json(
      { error: `Demasiados intentos. Probá de nuevo en ${minutos} min.` },
      { status: 429, headers: { 'Retry-After': String(limite.reintentarEn) } },
    );
  }

  const ok = await verificarUsuario(user, password);
  if (!ok) return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });

  await limpiarIntentos(id);
  const sesion = await getSesion();
  sesion.user = ok.user;
  sesion.role = ok.role;
  await sesion.save();
  return NextResponse.json({ ok: true });
}
