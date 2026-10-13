import { NextResponse } from 'next/server';
import { obtenerDatos } from '@/lib/cache';
import { sesionCon } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const sesion = await sesionCon();
  if (!sesion) return NextResponse.json({ error: 'Sesión vencida. Volvé a iniciar sesión.' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const anio = Number(params.get('anio')) || undefined;
  const { dataset, meta } = await obtenerDatos(anio);
  const admin = sesion.role === 'admin';
  const usuario = { user: sesion.user, role: sesion.role };
  const metaCliente = admin ? meta : { ...meta, error: meta.error ? 'No se pudo actualizar desde OneDrive.' : null };

  // Si el cliente ya tiene esta versión no se le reenvía el dataset (el chequeo es cada 60 s).
  const firma = dataset ? `${meta.anio}|${meta.version}|${meta.hoy}` : null;
  if (firma && params.get('v') === firma) {
    return NextResponse.json({ sinCambios: true, firma, meta: metaCliente, usuario }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // El cliente recibe solo el dataset calculado. Los avisos de Salud de datos son solo para el admin.
  const cuerpo = {
    dataset: dataset && (admin ? dataset : { ...dataset, salud: [] }),
    firma,
    meta: metaCliente,
    usuario,
  };
  return NextResponse.json(cuerpo, { headers: { 'Cache-Control': 'no-store' } });
}
