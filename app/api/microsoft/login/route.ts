import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env, msConfigurado } from '@/lib/env';
import { urlDeAutorizacion } from '@/lib/graph/msal';
import { sesionCon } from '@/lib/session';

export const runtime = 'nodejs';

/** Inicia el flujo OAuth (solo admin). */
export async function GET(req: Request) {
  const sesion = await sesionCon('admin');
  if (!sesion) return NextResponse.redirect(new URL('/login', req.url));
  if (env.esPreview()) return NextResponse.redirect(new URL('/admin/conexion?error=preview', req.url));
  if (!msConfigurado()) return NextResponse.redirect(new URL('/admin/conexion?error=config', req.url));

  sesion.oauthState = randomBytes(24).toString('base64url');
  await sesion.save();
  return NextResponse.redirect(await urlDeAutorizacion(sesion.oauthState));
}
