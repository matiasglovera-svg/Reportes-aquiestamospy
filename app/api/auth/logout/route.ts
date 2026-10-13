import { NextResponse } from 'next/server';
import { getSesion, mismoOrigen } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  (await getSesion()).destroy();
  return NextResponse.json({ ok: true });
}
