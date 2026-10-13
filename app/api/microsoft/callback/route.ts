import { NextResponse } from 'next/server';
import { completarAutorizacion } from '@/lib/graph/msal';
import { getSesion } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Vuelta de Microsoft. La ruta es pública para el middleware, pero solo se acepta si el navegador trae
 * la sesión de un admin y el mismo `state` que se generó al iniciar el flujo.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const destino = (motivo?: string) => NextResponse.redirect(new URL(`/admin/conexion${motivo ? `?error=${motivo}` : '?conectado=1'}`, req.url));

  const sesion = await getSesion();
  if (!sesion.user || sesion.role !== 'admin') return NextResponse.redirect(new URL('/login', req.url));

  const state = url.searchParams.get('state');
  const esperado = sesion.oauthState;
  sesion.oauthState = undefined;
  await sesion.save();
  if (!esperado || state !== esperado) return destino('state');

  if (url.searchParams.get('error')) return destino(url.searchParams.get('error') === 'access_denied' ? 'cancelado' : 'microsoft');
  const code = url.searchParams.get('code');
  if (!code) return destino('microsoft');

  try {
    await completarAutorizacion(code);
    return destino();
  } catch (e) {
    console.error('OAuth Microsoft:', e instanceof Error ? e.message : e);
    return destino('token');
  }
}
