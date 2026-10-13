import { store } from './store';

/** Un archivo de planilla por año. Se guarda el itemId: si se renombra o mueve en OneDrive sigue funcionando. */
export interface ArchivoAnio {
  anio: number;
  itemId: string;
  nombre: string;
}

const CLAVE = 'cfg:archivos';

export async function archivos(): Promise<ArchivoAnio[]> {
  return ((await store().get<ArchivoAnio[]>(CLAVE)) ?? []).sort((a, b) => a.anio - b.anio);
}

export async function guardarArchivo(a: ArchivoAnio): Promise<ArchivoAnio[]> {
  const lista = [...(await archivos()).filter((x) => x.anio !== a.anio), a].sort((x, y) => x.anio - y.anio);
  await store().set(CLAVE, lista);
  return lista;
}

export async function quitarArchivo(anio: number): Promise<ArchivoAnio[]> {
  const lista = (await archivos()).filter((x) => x.anio !== anio);
  await store().set(CLAVE, lista);
  return lista;
}

/** Año por defecto: el actual si tiene archivo; si no, el más reciente configurado. */
export function anioPorDefecto(lista: ArchivoAnio[], anioActual: number): number | null {
  if (!lista.length) return null;
  return lista.some((a) => a.anio === anioActual) ? anioActual : lista[lista.length - 1].anio;
}
