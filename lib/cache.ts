import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { construirDataset, leerLibro, type Dataset } from './engine';
import { env, prefijoCache } from './env';
import { hoyEn } from './fecha';
import { anioPorDefecto, archivos, type ArchivoAnio } from './files';
import { descargar, metadatos } from './graph/drive';
import { ReconectarError } from './graph/msal';
import { store } from './store';

/** Segundos mínimos entre dos consultas a OneDrive (el cliente pide cada 60 s). */
const INTERVALO_CHEQUEO = 55;
/** Upstash acepta ~1 MB por comando: el dataset comprimido se parte en trozos si hace falta. */
const TROZO = 800_000;

export interface MetaDatos {
  anio: number | null;
  anios: number[];
  archivo: string | null;
  fuente: 'onedrive' | 'local' | 'ninguna';
  /** Última modificación del archivo en OneDrive (ISO). */
  lastModified: string | null;
  /** Última vez que se consultó OneDrive (ISO). */
  lastChecked: string | null;
  /** Cambia cuando cambia el contenido del archivo. */
  version: string | null;
  /** Fecha (aaaa-mm-dd, America/Asuncion) para la que se calculó el dataset. */
  hoy: string;
  error: string | null;
  reconectar: boolean;
}

export interface Respuesta {
  dataset: Dataset | null;
  meta: MetaDatos;
}

interface Estado {
  cTag: string;
  lastModified: string | null;
  lastChecked: string;
  hoy: string;
  build: string;
  trozos: number;
  error: string | null;
  reconectar: boolean;
}

const memoria = new Map<number, { clave: string; dataset: Dataset }>();
const claveEstado = (anio: number) => `${prefijoCache()}datos:${anio}:estado`;
const claveTrozo = (anio: number, i: number) => `${prefijoCache()}datos:${anio}:gz:${i}`;
const firma = (e: Pick<Estado, 'cTag' | 'hoy' | 'build'>) => `${e.cTag}|${e.hoy}|${e.build}`;

async function guardarDataset(anio: number, dataset: Dataset): Promise<number> {
  const b64 = gzipSync(JSON.stringify(dataset)).toString('base64');
  const n = Math.ceil(b64.length / TROZO);
  for (let i = 0; i < n; i++) await store().set(claveTrozo(anio, i), b64.slice(i * TROZO, (i + 1) * TROZO));
  return n;
}

async function leerDataset(anio: number, trozos: number): Promise<Dataset | null> {
  const partes = await Promise.all(Array.from({ length: trozos }, (_, i) => store().get<string>(claveTrozo(anio, i))));
  if (!partes.length || partes.some((p) => !p)) return null;
  return JSON.parse(gunzipSync(Buffer.from(partes.join(''), 'base64')).toString('utf8')) as Dataset;
}

/** Consulta OneDrive y, si el archivo (o el día) cambió, lo descarga, recalcula y guarda. */
async function refrescar(archivo: ArchivoAnio, hoy: string, previo: Estado | null): Promise<Estado> {
  const ahora = new Date().toISOString();
  try {
    const item = await metadatos(archivo.itemId);
    const cTag = item.cTag ?? item.eTag ?? item.lastModifiedDateTime ?? '';
    const nuevo: Estado = {
      cTag,
      lastModified: item.lastModifiedDateTime ?? null,
      lastChecked: ahora,
      hoy,
      build: env.build(),
      trozos: previo?.trozos ?? 0,
      error: null,
      reconectar: false,
    };
    if (!previo || !previo.trozos || firma(previo) !== firma(nuevo)) {
      const dataset = construirDataset({ libro: leerLibro(await descargar(archivo.itemId)), anio: archivo.anio, hoy });
      nuevo.trozos = await guardarDataset(archivo.anio, dataset);
      memoria.set(archivo.anio, { clave: firma(nuevo), dataset });
    }
    await store().set(claveEstado(archivo.anio), nuevo);
    return nuevo;
  } catch (e) {
    // Si falla, se siguen mostrando los últimos datos guardados, con su fecha y el error a la vista.
    const fallo: Estado = {
      ...(previo ?? { cTag: '', lastModified: null, hoy, build: env.build(), trozos: 0 }),
      lastChecked: previo?.lastChecked ?? ahora,
      error: e instanceof Error ? e.message : 'Error desconocido al leer OneDrive.',
      reconectar: e instanceof ReconectarError,
    };
    await store().set(claveEstado(archivo.anio), fallo);
    return fallo;
  }
}

function datosLocales(hoy: string): Respuesta {
  const anio = Number(process.env.LOCAL_ANIO) || 2026;
  const meta: MetaDatos = { anio, anios: [anio], archivo: null, fuente: 'local', lastModified: null, lastChecked: new Date().toISOString(), version: null, hoy, error: null, reconectar: false };
  const nombre = readdirSync('fixtures').find((f) => /\.xlsx$/i.test(f));
  if (!nombre) return { dataset: null, meta: { ...meta, error: 'No hay ningún .xlsx en fixtures/.' } };
  const ruta = join('fixtures', nombre);
  const st = statSync(ruta);
  const clave = `${st.mtimeMs}-${st.size}|${hoy}`;
  let m = memoria.get(anio);
  if (!m || m.clave !== clave) {
    m = { clave, dataset: construirDataset({ libro: leerLibro(readFileSync(ruta)), anio, hoy }) };
    memoria.set(anio, m);
  }
  return { dataset: m.dataset, meta: { ...meta, archivo: nombre, lastModified: st.mtime.toISOString(), version: `${st.mtimeMs}-${st.size}` } };
}

export async function obtenerDatos(anioPedido?: number, opciones: { forzar?: boolean } = {}): Promise<Respuesta> {
  const hoy = hoyEn(env.timezone());
  if (env.fuenteLocal()) return datosLocales(hoy);

  const lista = await archivos();
  const anios = lista.map((a) => a.anio);
  const anio = anioPedido && anios.includes(anioPedido) ? anioPedido : anioPorDefecto(lista, +hoy.slice(0, 4));
  const archivo = lista.find((a) => a.anio === anio);
  const base: MetaDatos = { anio, anios, archivo: archivo?.nombre ?? null, fuente: 'ninguna', lastModified: null, lastChecked: null, version: null, hoy, error: null, reconectar: false };
  if (!archivo) return { dataset: null, meta: base };

  let estado = await store().get<Estado>(claveEstado(archivo.anio));
  // El lock evita que varias pestañas abiertas consulten OneDrive a la vez.
  if (opciones.forzar || (await store().setNx(`${prefijoCache()}datos:${archivo.anio}:lock`, 1, INTERVALO_CHEQUEO))) {
    estado = await refrescar(archivo, hoy, estado);
  }

  let dataset: Dataset | null = null;
  if (estado?.trozos) {
    const m = memoria.get(archivo.anio);
    if (m && m.clave === firma(estado)) dataset = m.dataset;
    else {
      dataset = await leerDataset(archivo.anio, estado.trozos);
      if (dataset) memoria.set(archivo.anio, { clave: firma(estado), dataset });
    }
  }
  return {
    dataset,
    meta: {
      ...base,
      fuente: 'onedrive',
      lastModified: estado?.lastModified ?? null,
      lastChecked: estado?.lastChecked ?? null,
      version: estado?.cTag || null,
      hoy: estado?.hoy ?? hoy,
      error: estado?.error ?? null,
      reconectar: estado?.reconectar ?? false,
    },
  };
}
