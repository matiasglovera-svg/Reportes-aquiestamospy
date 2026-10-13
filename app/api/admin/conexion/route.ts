import { NextResponse } from 'next/server';
import { obtenerDatos } from '@/lib/cache';
import { env, msConfigurado, redisConfigurado } from '@/lib/env';
import { archivos } from '@/lib/files';
import { cuentaConectada } from '@/lib/graph/msal';
import { sesionCon } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Estado de la conexión para /admin/conexion. */
export async function GET() {
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  const [cuenta, lista] = await Promise.all([cuentaConectada(), archivos()]);
  const estados = await Promise.all(lista.map(async (a) => ({ ...a, ...(await obtenerDatos(a.anio)).meta })));
  return NextResponse.json(
    {
      msConfigurado: msConfigurado(),
      redisConfigurado: redisConfigurado(),
      fuenteLocal: env.fuenteLocal(),
      redirectUri: env.msRedirectUri(),
      cuenta: cuenta && { usuario: cuenta.usuario, nombre: cuenta.nombre, conectadaEl: cuenta.conectadaEl },
      archivos: estados.map((e) => ({
        anio: e.anio,
        nombre: e.nombre,
        lastModified: e.lastModified,
        lastChecked: e.lastChecked,
        error: e.error,
        reconectar: e.reconectar,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
