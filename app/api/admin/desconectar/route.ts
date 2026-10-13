import { NextResponse } from 'next/server';
import { desconectar } from '@/lib/graph/msal';
import { mismoOrigen, sesionCon } from '@/lib/session';

export const runtime = 'nodejs';

/** Borra el token de Microsoft guardado. Los últimos datos cacheados se siguen mostrando. */
export async function POST(req: Request) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  await desconectar();
  return NextResponse.json({ ok: true });
}
