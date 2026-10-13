import { NextResponse } from 'next/server';
import { obtenerDatos } from '@/lib/cache';
import { mismoOrigen, sesionCon } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Fuerza una lectura inmediata de OneDrive, sin esperar el intervalo. */
export async function POST(req: Request) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  const anio = Number(new URL(req.url).searchParams.get('anio')) || undefined;
  const { meta } = await obtenerDatos(anio, { forzar: true });
  return NextResponse.json({ ok: !meta.error, error: meta.error });
}
