'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { Tema } from '@/config/theme';
import type { MetaDatos } from '@/lib/cache';
import type { ModoMargen } from '@/lib/engine/metrics-analisis';
import { mesDeResumen } from '@/lib/engine/metrics-resumen';
import type { Dataset } from '@/lib/engine/types';

interface RespuestaApi {
  dataset: Dataset | null;
  meta: MetaDatos;
  usuario: { user: string; role: 'admin' | 'viewer' };
}

interface Contexto {
  cargando: boolean;
  error: string | null;
  dataset: Dataset | null;
  meta: MetaDatos | null;
  usuario: RespuestaApi['usuario'] | null;
  esAdmin: boolean;
  anio: number | null;
  setAnio: (a: number) => void;
  /** Mes elegido en la barra superior (1–12). */
  mes: number | null;
  setMes: (m: number) => void;
  modoMargen: ModoMargen;
  setModoMargen: (m: ModoMargen) => void;
  conAgendados: boolean;
  setConAgendados: (v: boolean) => void;
  tema: Tema;
  alternarTema: () => void;
  aviso: string | null;
  refrescar: () => void;
}

const Ctx = createContext<Contexto | null>(null);

export function useDatos(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDatos fuera de <ProveedorDatos>');
  return c;
}

// Último dataset recibido por URL: si el servidor responde "sin cambios" se reutiliza.
const recibido = new Map<string, { firma: string; dataset: Dataset }>();

async function traer(url: string): Promise<RespuestaApi> {
  const previo = recibido.get(url);
  const r = await fetch(previo ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(previo.firma)}` : url, { cache: 'no-store' });
  if (r.status === 401) {
    window.location.href = '/login';
    throw new Error('Sesión vencida.');
  }
  if (!r.ok) throw new Error('No se pudieron cargar los datos.');
  const j = (await r.json()) as RespuestaApi & { sinCambios?: boolean; firma?: string | null };
  if (j.sinCambios && previo) return { dataset: previo.dataset, meta: j.meta, usuario: j.usuario };
  if (j.dataset && j.firma) recibido.set(url, { firma: j.firma, dataset: j.dataset });
  return j;
}

export function ProveedorDatos({ children }: { children: React.ReactNode }) {
  const [anioElegido, setAnio] = useState<number | null>(null);
  const [mesElegido, setMes] = useState<number | null>(null);
  const [modoMargen, setModoMargen] = useState<ModoMargen>('A');
  const [conAgendados, setConAgendados] = useState(false);
  const [tema, setTema] = useState<Tema>('light');
  const [aviso, setAviso] = useState<string | null>(null);

  // El cliente abierto es el que dispara el refresco: cada 60 s pide /api/data.
  const { data, error, isLoading, mutate } = useSWR(`/api/data${anioElegido ? `?anio=${anioElegido}` : ''}`, traer, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const alternarTema = useCallback(() => {
    const html = document.documentElement;
    const nuevo: Tema = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.classList.add('tema-en-transicion');
    html.dataset.theme = nuevo;
    try {
      localStorage.setItem('ae-tema', nuevo);
    } catch {
      // Sin almacenamiento disponible el tema igual cambia; solo no se recuerda.
    }
    setTema(nuevo);
    window.setTimeout(() => html.classList.remove('tema-en-transicion'), 450);
  }, []);

  // Aviso cuando cambia el contenido del archivo (cTag distinto) con la app abierta.
  const version = data?.meta.version ?? null;
  const anioActual = data?.meta.anio ?? null;
  const previa = useRef<{ version: string | null; anio: number | null }>({ version: null, anio: null });
  useEffect(() => {
    const p = previa.current;
    if (p.version && version && p.version !== version && p.anio === anioActual) {
      setAviso(data?.meta.fuente === 'onedrive' ? 'Datos actualizados desde OneDrive' : 'Datos actualizados');
      const t = window.setTimeout(() => setAviso(null), 4500);
      previa.current = { version, anio: anioActual };
      return () => window.clearTimeout(t);
    }
    previa.current = { version, anio: anioActual };
  }, [version, anioActual, data?.meta.fuente]);

  const dataset = data?.dataset ?? null;
  const valor = useMemo<Contexto>(() => {
    const disponibles = dataset?.operativo.map((m) => m.mes) ?? [];
    const mes = mesElegido && disponibles.includes(mesElegido) ? mesElegido : dataset ? mesDeResumen(dataset) : null;
    return {
      cargando: isLoading && !data,
      error: error ? (error as Error).message : null,
      dataset,
      meta: data?.meta ?? null,
      usuario: data?.usuario ?? null,
      esAdmin: data?.usuario.role === 'admin',
      anio: data?.meta.anio ?? null,
      setAnio,
      mes,
      setMes,
      modoMargen,
      setModoMargen,
      conAgendados,
      setConAgendados,
      tema,
      alternarTema,
      aviso,
      refrescar: () => void mutate(),
    };
  }, [data, dataset, error, isLoading, mesElegido, modoMargen, conAgendados, tema, alternarTema, aviso, mutate]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
