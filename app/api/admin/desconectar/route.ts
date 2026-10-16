import { NextResponse } from 'next/server';
import { desconectar } from '@/lib/graph/msal';
import { env } from '@/lib/env';
import { mismoOrigen, sesionCon } from '@/lib/session';

export const runtime = 'nodejs';

/** Borra el token de Microsoft guardado. Los últimos datos cacheados se siguen mostrando. */
export async function POST(req: Request) {
  if (env.esPreview()) return NextResponse.json({ error: 'En la vista previa no se puede cambiar la configuración. Hacelo desde producción.' }, { status: 403 });
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  await desconectar();
  return NextResponse.json({ ok: true });
}
