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

export async function buscar(texto: string): Promise<ItemDrive[]> {
  const token = await tokenDeAcceso();
  const q = texto.replace(/'/g, "''");
  const r = await graph(
    `/me/drive/root/search(q='${encodeURIComponent(q)}')?$select=id,name,size,lastModifiedDateTime,parentReference,file&$top=25`,
    token,
  );
  const { value } = (await r.json()) as { value: ItemDrive[] };
  return value.filter((i) => i.file && /\.xls[xm]$/i.test(i.name));
}
