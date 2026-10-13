import { ReconectarError, tokenDeAcceso } from './msal';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface ItemDrive {
  id: string;
  name: string;
  cTag?: string;
  eTag?: string;
  lastModifiedDateTime?: string;
  size?: number;
  parentReference?: { path?: string };
  file?: { mimeType?: string };
  folder?: { childCount?: number };
}

async function graph(ruta: string, token: string): Promise<Response> {
  const r = await fetch(`${GRAPH}${ruta}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (r.status === 401) throw new ReconectarError('Microsoft rechazó el acceso a OneDrive.');
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const detalle = cuerpo?.error?.code ?? r.statusText;
    throw new Error(r.status === 404 ? 'No se encontró el archivo en OneDrive (¿se eliminó?).' : `Microsoft Graph respondió ${r.status} (${detalle}).`);
  }
  return r;
}

/** Metadatos livianos: con el cTag se sabe si el contenido cambió sin descargar el archivo. */
export async function metadatos(itemId: string): Promise<ItemDrive> {
  const token = await tokenDeAcceso();
  const r = await graph(`/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,cTag,eTag,lastModifiedDateTime,size`, token);
  return (await r.json()) as ItemDrive;
}

export async function descargar(itemId: string): Promise<Uint8Array> {
  const token = await tokenDeAcceso();
  const r = await graph(`/me/drive/items/${encodeURIComponent(itemId)}/content`, token);
  return new Uint8Array(await r.arrayBuffer());
}

const CAMPOS = '$select=id,name,size,lastModifiedDateTime,parentReference,file,folder';
const esPlanilla = (i: ItemDrive) => /\.xls[xm]$/i.test(i.name ?? '');
const palabras = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

async function listar(ruta: string, token: string): Promise<ItemDrive[]> {
  try {
    const r = await graph(ruta, token);
    return ((await r.json()) as { value?: ItemDrive[] }).value ?? [];
  } catch (e) {
    if (e instanceof ReconectarError) throw e;
    return [];
  }
}

/**
 * Recorre las carpetas del OneDrive (hasta 5 niveles y 400 carpetas) juntando las planillas de Excel.
 * Es el respaldo para cuando el buscador de Microsoft no tiene indexado el archivo.
 */
async function recorrer(token: string, hasta: (hallados: ItemDrive[]) => boolean): Promise<ItemDrive[]> {
  const planillas: ItemDrive[] = [];
  let nivel = [`/me/drive/root/children?${CAMPOS}&$top=200`];
  let visitadas = 0;
  for (let profundidad = 0; profundidad < 5 && nivel.length && visitadas < 400; profundidad++) {
    const tanda = nivel.slice(0, 400 - visitadas);
    visitadas += tanda.length;
    const siguiente: string[] = [];
    // De a 8 carpetas a la vez para no saturar a Graph.
    for (let i = 0; i < tanda.length; i += 8) {
      const listas = await Promise.all(tanda.slice(i, i + 8).map((ruta) => listar(ruta, token)));
      for (const item of listas.flat()) {
        if (item.folder) siguiente.push(`/me/drive/items/${encodeURIComponent(item.id)}/children?${CAMPOS}&$top=200`);
        else if (esPlanilla(item)) planillas.push(item);
      }
      if (hasta(planillas)) return planillas;
    }
    nivel = siguiente;
  }
  return planillas;
}

/**
 * Busca planillas por nombre. El buscador de OneDrive no siempre encuentra nombres con guiones bajos o
 * números ("03_07_26"), así que se prueba con el texto completo, con las palabras sueltas y, si nada
 * aparece, con los archivos recientes y recorriendo las carpetas. Primero van los que contienen todas las palabras.
 */
export async function buscar(texto: string): Promise<ItemDrive[]> {
  const token = await tokenDeAcceso();
  const pedidas = palabras(texto);
  const letras = pedidas.filter((p) => /[A-Z]/.test(p));
  const consultas = [...new Set([texto.trim(), pedidas.join(' '), letras.join(' '), letras[0] ?? '', '.xlsx'].filter((c) => c.length >= 3))];

  const hallados = new Map<string, ItemDrive>();
  const sumar = (items: ItemDrive[]) => items.filter(esPlanilla).forEach((i) => hallados.has(i.id) || hallados.set(i.id, i));
  const coincidencias = (i: ItemDrive) => {
    const nombre = palabras(i.name).join(' ');
    return pedidas.filter((p) => nombre.includes(p)).length;
  };
  const hayExacto = () => [...hallados.values()].some((i) => coincidencias(i) === pedidas.length);

  for (const c of consultas) {
    sumar(await listar(`/me/drive/root/search(q='${encodeURIComponent(c.replace(/'/g, "''"))}')?${CAMPOS}&$top=50`, token));
    if (hayExacto()) break;
  }
  if (!hayExacto()) {
    sumar(await listar(`/me/drive/recent?${CAMPOS}&$top=50`, token));
  }
  if (!hayExacto()) {
    sumar(await recorrer(token, (vistas) => vistas.some((i) => coincidencias(i) === pedidas.length)));
  }

  return [...hallados.values()]
    .map((i) => ({ i, n: coincidencias(i) }))
    .filter((x) => x.n > 0 || !pedidas.length)
    .sort((a, b) => b.n - a.n || (b.i.lastModifiedDateTime ?? '').localeCompare(a.i.lastModifiedDateTime ?? ''))
    .slice(0, 25)
    .map((x) => x.i);
}
