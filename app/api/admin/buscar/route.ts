import { NextResponse } from 'next/server';
import { buscar } from '@/lib/graph/drive';
import { ReconectarError } from '@/lib/graph/msal';
import { sesionCon } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Busca planillas por nombre en el OneDrive conectado. */
export async function GET(req: Request) {
  if (!(await sesionCon('admin'))) return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ error: 'Escribí al menos 3 letras del nombre.' }, { status: 400 });
  try {
    const items = await buscar(q);
    return NextResponse.json({
      resultados: items.map((i) => ({
        itemId: i.id,
        nombre: i.name,
        carpeta: decodeURIComponent(i.parentReference?.path?.replace(/^\/drive\/root:?/, '') || '/'),
        lastModified: i.lastModifiedDateTime ?? null,
        size: i.size ?? null,
      })),
    });
  } catch (e) {
    const reconectar = e instanceof ReconectarError;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo buscar.', reconectar }, { status: reconectar ? 409 : 502 });
  }
}
