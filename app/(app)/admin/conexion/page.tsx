'use client';

import { CheckCircle2, CircleAlert, FileSpreadsheet, RefreshCw, Search, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useDatos } from '@/components/datos';
import { Boton, Etiqueta, Panel, TituloSeccion } from '@/components/ui';
import { fechaHora } from '@/lib/format';

interface Estado {
  msConfigurado: boolean;
  redisConfigurado: boolean;
  fuenteLocal: boolean;
  soloLectura: boolean;
  redirectUri: string;
  cuenta: { usuario: string; nombre: string | null; conectadaEl: string } | null;
  archivos: { anio: number; nombre: string; lastModified: string | null; lastChecked: string | null; error: string | null; reconectar: boolean }[];
}

interface Resultado {
  itemId: string;
  nombre: string;
  carpeta: string;
  lastModified: string | null;
  size: number | null;
}

const ERRORES: Record<string, string> = {
  config: 'Faltan variables de Microsoft en el servidor (MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI o TOKEN_ENCRYPTION_KEY).',
  state: 'La autorización no coincide con la que se inició. Probá de nuevo desde "Conectar OneDrive".',
  cancelado: 'Cancelaste la autorización en Microsoft.',
  microsoft: 'Microsoft devolvió un error al autorizar.',
  preview: 'En la vista previa no se puede conectar OneDrive: se usa la conexión de producción.',
  token: 'No se pudo completar la conexión. Revisá el secreto de cliente (puede estar vencido) y la URI de redirección.',
};

const traer = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo leer el estado.'))));
const campo = 'h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text placeholder:text-muted';

function Punto({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-alerta" />}
      <span>{children}</span>
    </li>
  );
}

export default function Conexion() {
  const { refrescar } = useDatos();
  const { data: e, error, mutate } = useSWR<Estado>('/api/admin/conexion', traer, { refreshInterval: 30_000 });
  const [q, setQ] = useState('PLANILLA VENTAS');
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('conectado')) setMensaje({ ok: true, texto: 'OneDrive conectado. Ahora buscá la planilla y asignala a un año.' });
    else if (p.get('error')) setMensaje({ ok: false, texto: ERRORES[p.get('error')!] ?? 'No se pudo conectar.' });
    if (p.size) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const accion = async (clave: string, hacer: () => Promise<Response>, exito: string) => {
    setOcupado(clave);
    setMensaje(null);
    try {
      const r = await hacer();
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string | null };
      setMensaje(r.ok && j.ok !== false ? { ok: true, texto: exito } : { ok: false, texto: j.error ?? 'No se pudo completar la acción.' });
    } catch {
      setMensaje({ ok: false, texto: 'No se pudo conectar con el servidor.' });
    }
    setOcupado(null);
    void mutate();
    refrescar();
  };

  const buscar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setOcupado('buscar');
    setMensaje(null);
    setResultados(null);
    try {
      const r = await fetch(`/api/admin/buscar?q=${encodeURIComponent(q)}`);
      const j = (await r.json()) as { resultados?: Resultado[]; error?: string };
      if (r.ok) setResultados(j.resultados ?? []);
      else setMensaje({ ok: false, texto: j.error ?? 'No se pudo buscar.' });
    } catch {
      setMensaje({ ok: false, texto: 'No se pudo conectar con el servidor.' });
    }
    setOcupado(null);
  };

  if (error) return <p className="text-sm text-alerta">No se pudo leer el estado de la conexión.</p>;
  if (!e) return <p className="text-sm text-muted">Cargando…</p>;

  return (
    <>
      <TituloSeccion nota="Solo administrador">Conexión con OneDrive</TituloSeccion>

      {mensaje && (
        <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${mensaje.ok ? 'bg-accent-soft text-text' : 'bg-alerta-soft text-alerta'}`}>
          {mensaje.texto}
        </p>
      )}
      {e.soloLectura && <p className="mb-4 rounded-xl bg-amarillo/25 px-4 py-3 text-sm">Vista previa: se leen el mismo OneDrive y la misma planilla que en producción, pero acá no se puede cambiar la conexión ni los archivos.</p>}
      {e.fuenteLocal && <p className="mb-4 rounded-xl bg-amarillo/25 px-4 py-3 text-sm">Modo desarrollo: los reportes se leen de la copia local en fixtures/, no de OneDrive.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Cuenta de Microsoft">
          <ul className="mb-4 space-y-2 text-sm">
            <Punto ok={e.msConfigurado}>{e.msConfigurado ? 'App de Microsoft configurada en el servidor.' : ERRORES.config}</Punto>
            <Punto ok={e.redisConfigurado}>{e.redisConfigurado ? 'Almacenamiento Upstash Redis configurado.' : 'Falta Upstash Redis: sin él la conexión no se conserva entre reinicios.'}</Punto>
            <Punto ok={!!e.cuenta}>
              {e.cuenta ? (
                <>
                  Conectado como <strong>{e.cuenta.usuario}</strong>
                  {e.cuenta.nombre ? ` (${e.cuenta.nombre})` : ''} desde el {fechaHora(e.cuenta.conectadaEl)}.
                </>
              ) : (
                'OneDrive todavía no está conectado.'
              )}
            </Punto>
          </ul>
          <div className="flex flex-wrap gap-2">
            {/* Navegación completa: el flujo OAuth redirige a Microsoft. */}
            <a href="/api/microsoft/login" aria-disabled={!e.msConfigurado || e.soloLectura} className={`inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg ${e.msConfigurado && !e.soloLectura ? 'hover:opacity-90' : 'pointer-events-none opacity-50'}`}>
              {e.cuenta ? 'Reconectar OneDrive' : 'Conectar OneDrive'}
            </a>
            {e.cuenta && (
              <Boton variante="peligro" disabled={ocupado !== null || e.soloLectura} onClick={() => window.confirm('¿Desconectar OneDrive? Los reportes van a seguir mostrando los últimos datos guardados.') && accion('desconectar', () => fetch('/api/admin/desconectar', { method: 'POST' }), 'OneDrive desconectado.')}>
                <Unplug className="h-4 w-4" /> Desconectar
              </Boton>
            )}
          </div>
          <p className="mt-3 break-all text-xs text-muted">URI de redirección registrada en Azure: {e.redirectUri || 'sin configurar'}</p>
        </Panel>

        <Panel titulo="Archivos por año" subtitulo="Cada año usa su propia planilla, con la misma estructura.">
          {e.archivos.length ? (
            <ul className="space-y-3">
              {e.archivos.map((a) => (
                <li key={a.anio} className="rounded-2xl bg-surface-2 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num font-display text-xl font-black">{a.anio}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
                    {a.error ? <Etiqueta tono="alerta">Con error</Etiqueta> : <Etiqueta tono="ok">Al día</Etiqueta>}
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                    <dt>Última modificación</dt>
                    <dd className="num">{fechaHora(a.lastModified)}</dd>
                    <dt>Último chequeo</dt>
                    <dd className="num">{fechaHora(a.lastChecked)}</dd>
                    <dt>Último error</dt>
                    <dd className={a.error ? 'text-alerta' : ''}>{a.error ?? 'Ninguno'}</dd>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Boton variante="suave" className="h-8 px-3 text-xs" disabled={ocupado !== null || e.soloLectura} onClick={() => accion(`leer-${a.anio}`, () => fetch(`/api/admin/refrescar?anio=${a.anio}`, { method: 'POST' }), `Planilla ${a.anio} leída de nuevo.`)}>
                      <RefreshCw className={`h-3.5 w-3.5 ${ocupado === `leer-${a.anio}` ? 'animate-spin' : ''}`} /> Leer ahora
                    </Boton>
                    <Boton variante="fantasma" className="h-8 px-3 text-xs" disabled={ocupado !== null || e.soloLectura} onClick={() => window.confirm(`¿Quitar el archivo de ${a.anio}?`) && accion(`quitar-${a.anio}`, () => fetch(`/api/admin/archivos?anio=${a.anio}`, { method: 'DELETE' }), `Archivo de ${a.anio} quitado.`)}>
                      Quitar
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todavía no hay ninguna planilla asignada. Conectá OneDrive y buscala acá abajo.</p>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" titulo="Agregar o cambiar la planilla de un año" subtitulo="Se guarda el identificador del archivo: si después lo renombrás o lo movés de carpeta, sigue funcionando.">
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 basis-56 text-xs font-medium text-muted">
            Nombre del archivo
            <input className={`${campo} mt-1 w-full`} value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="PLANILLA VENTAS 03_07_26" minLength={3} required />
          </label>
          <label className="text-xs font-medium text-muted">
            Año
            <input className={`${campo} num mt-1 w-24`} type="number" min={2020} max={2100} value={anio} onChange={(ev) => setAnio(Number(ev.target.value))} required />
          </label>
          <Boton type="submit" disabled={!e.cuenta || ocupado !== null || e.soloLectura}>
            <Search className="h-4 w-4" /> {ocupado === 'buscar' ? 'Buscando…' : 'Buscar en OneDrive'}
          </Boton>
        </form>
        {!e.cuenta && <p className="mt-2 text-xs text-muted">Primero conectá OneDrive.</p>}
        {resultados && (
          <ul className="mt-4 space-y-2">
            {resultados.length === 0 && <li className="text-sm text-muted">No se encontraron planillas de Excel con ese nombre.</li>}
            {resultados.map((r) => (
              <li key={r.itemId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-ok" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.nombre}</p>
                  <p className="truncate text-xs text-muted">
                    {r.carpeta} · modificado {fechaHora(r.lastModified)}
                    {r.size ? ` · ${(r.size / 1048576).toFixed(1).replace('.', ',')} MB` : ''}
                  </p>
                </div>
                <Boton
                  variante="suave"
                  className="h-9"
                  disabled={ocupado !== null || e.soloLectura}
                  onClick={() => accion(`usar-${r.itemId}`, () => fetch('/api/admin/archivos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio, itemId: r.itemId, nombre: r.nombre }) }), `Planilla asignada a ${anio} y leída correctamente.`)}
                >
                  {ocupado === `usar-${r.itemId}` ? 'Leyendo…' : `Usar para ${anio}`}
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-4 text-xs text-muted">Los cambios del Excel se ven en la app cuando el archivo queda guardado en OneDrive (Autoguardado activado). El reflejo tarda como máximo 1 a 2 minutos.</p>
    </>
  );
}
