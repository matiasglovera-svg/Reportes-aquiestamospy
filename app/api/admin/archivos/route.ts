import { NextResponse } from 'next/server';
import { obtenerDatos } from '@/lib/cache';
import { guardarArchivo, quitarArchivo } from '@/lib/files';
import { mismoOrigen, sesionCon } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function autorizado(req: Request): Promise<NextResponse | null> {
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  return null;
}

/** Asigna el archivo de un año (2026, 2027, …) y hace la primera lectura. */
export async function POST(req: Request) {
  const no = await autorizado(req);
  if (no) return no;
  const c = (await req.json().catch(() => null)) as { anio?: unknown; itemId?: unknown; nombre?: unknown } | null;
  const anio = Number(c?.anio);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100 || typeof c?.itemId !== 'string' || typeof c?.nombre !== 'string') {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
  }
  await guardarArchivo({ anio, itemId: c.itemId, nombre: c.nombre.slice(0, 200) });
  const { dataset, meta } = await obtenerDatos(anio, { forzar: true });
  return NextResponse.json({ ok: !!dataset && !meta.error, error: meta.error });
}

export async function DELETE(req: Request) {
  const no = await autorizado(req);
  if (no) return no;
  const anio = Number(new URL(req.url).searchParams.get('anio'));
  if (!Number.isInteger(anio)) return NextResponse.json({ error: 'Falta el año.' }, { status: 400 });
  await quitarArchivo(anio);
  return NextResponse.json({ ok: true });
}
