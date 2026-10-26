'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowLeftRight, Users, BarChart3, CheckCircle2, ChevronDown, ChevronsLeft, ChevronsRight, Download, LayoutDashboard, LogOut, Moon, PlugZap, Sun, TriangleAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { descargarZip } from '@/lib/csv';
import { fechaHora, hace, mesLargo } from '@/lib/format';
import { todosLosReportes } from '@/lib/reportes';
import { useDatos } from './datos';
import { Logo, Ondas } from './marca';
import { Boton, cn, Esqueleto, Selector, Vacio } from './ui';

const NAV = [
  { href: '/resumen', texto: 'Resumen', icono: LayoutDashboard },
  { href: '/financiero', texto: 'Financiero', icono: Wallet },
  { href: '/operativo', texto: 'Operativo', icono: Activity },
];
/** Submenús desplegables: Financiero y Operativo. */
const SUBMENUS: Record<string, { href: string; texto: string; icono: typeof Activity }[]> = {
  '/financiero': [
    { href: '/financiero', texto: 'Resumen financiero', icono: Wallet },
    { href: '/financiero/flujo', texto: 'Flujo de caja', icono: ArrowLeftRight },
  ],
  '/operativo': [
    { href: '/operativo', texto: 'Resumen operativo', icono: Activity },
    { href: '/operativo/rendimiento', texto: 'Rendimiento por operaria', icono: Users },
  ],
};
const NAV_ADMIN = [
  { href: '/admin/conexion', texto: 'Conexión', icono: PlugZap },
  { href: '/admin/datos', texto: 'Salud de datos', icono: BarChart3 },
];

/** Punto pulsante + "Actualizado hace 32 s". */
export function IndicadorVivo() {
  const { meta } = useDatos();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const conError = !!meta?.error;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted" title={meta?.lastModified ? `Archivo modificado: ${fechaHora(meta.lastModified)}` : undefined}>
      <span className="relative grid h-2.5 w-2.5 place-items-center">
        {!conError && <span className="absolute h-2.5 w-2.5 rounded-full bg-turquesa" style={{ animation: 'pulso 1.8s ease-out infinite' }} />}
        <span className={cn('relative h-2.5 w-2.5 rounded-full', conError ? 'bg-amarillo' : 'bg-turquesa')} />
      </span>
      <span className="num">{meta?.lastChecked ? `Actualizado ${hace(meta.lastChecked, ahora)}` : 'Sin lecturas'}</span>
    </span>
  );
}

function Enlace({ href, texto, icono: Icono, activo, plegado, hijo, contador }: { href: string; texto: string; icono: typeof Activity; activo: boolean; plegado: boolean; hijo?: boolean; contador?: number }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      title={plegado ? texto : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
        activo ? 'bg-primary-soft font-semibold text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        hijo && !plegado && 'ml-4',
        plegado && 'justify-center px-0',
      )}
    >
      <Icono className={cn('h-[18px] w-[18px] shrink-0', activo && 'text-primary')} />
      {!plegado && <span className="flex-1 truncate">{texto}</span>}
      {!plegado && !!contador && <span className="num rounded-full bg-amarillo px-1.5 text-[11px] font-bold text-navy">{contador}</span>}
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const d = useDatos();
  const [plegado, setPlegado] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    try {
      setPlegado(localStorage.getItem('ae-lateral') === '1');
    } catch {
      // Sin almacenamiento: la barra queda desplegada.
    }
  }, []);
  const plegar = () => {
    setPlegado((p) => {
      try {
        localStorage.setItem('ae-lateral', p ? '0' : '1');
      } catch {
        // Solo no se recuerda la preferencia.
      }
      return !p;
    });
  };

  const avisos = d.dataset?.salud.filter((a) => a.nivel !== 'info').length ?? 0;
  const items = d.esAdmin ? [...NAV, ...NAV_ADMIN] : NAV;
  const activo = (href: string) => ruta === href;
  const esAdminRuta = ruta.startsWith('/admin');
  // El flujo de caja y el rendimiento por operaria tienen su propio selector de período.
  const sinSelectorMes = esAdminRuta || ruta === '/financiero/flujo' || ruta === '/operativo/rendimiento';
  // En la barra inferior del teléfono el flujo de caja se abre desde Financiero (pestañas en la página).
  const itemsMovil = items;
  const enGrupo = (base: string) => ruta === base || ruta.startsWith(`${base}/`);
  const grupoActual = Object.keys(SUBMENUS).find(enGrupo) ?? null;
  const [abiertos, setAbiertos] = useState<string[]>(grupoActual ? [grupoActual] : []);
  useEffect(() => {
    if (grupoActual) setAbiertos((a) => (a.includes(grupoActual) ? a : [...a, grupoActual]));
  }, [grupoActual]);
  const alternarGrupo = (base: string) => setAbiertos((a) => (a.includes(base) ? a.filter((x) => x !== base) : [...a, base]));
  const activoMovil = (href: string) => activo(href) || (href in SUBMENUS && enGrupo(href));

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const exportar = async () => {
    if (!d.dataset || !d.mes) return;
    setExportando(true);
    try {
      await descargarZip(todosLosReportes(d.dataset, { mes: d.mes, modoMargen: d.modoMargen, conAgendados: d.conAgendados }), `${mesLargo(d.mes)}-${d.dataset.anio}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex min-h-dvh">
      {/* Barra lateral (escritorio) */}
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface p-3 transition-[width] duration-200 md:flex', plegado ? 'w-[68px]' : 'w-60')}>
        <div className={cn('mb-3 flex items-center', plegado ? 'justify-center' : 'justify-between')}>
          {!plegado && <Logo alto={38} />}
          <button onClick={plegar} aria-label={plegado ? 'Desplegar menú' : 'Plegar menú'} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
            {plegado ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {NAV.map((n) =>
            SUBMENUS[n.href] && !plegado ? (
              <div key={n.href}>
                <button
                  onClick={() => alternarGrupo(n.href)}
                  aria-expanded={abiertos.includes(n.href)}
                  aria-controls={`submenu${n.href.replace('/', '-')}`}
                  className={cn('flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', enGrupo(n.href) ? 'font-semibold text-text' : 'text-muted hover:bg-surface-2 hover:text-text')}
                >
                  <n.icono className={cn('h-[18px] w-[18px] shrink-0', enGrupo(n.href) && 'text-primary')} />
                  <span className="flex-1 truncate text-left">{n.texto}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', abiertos.includes(n.href) && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {abiertos.includes(n.href) && (
                    <motion.div id={`submenu${n.href.replace('/', '-')}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="mt-1 flex flex-col gap-1">
                        {SUBMENUS[n.href].map((s) => (
                          <Enlace key={s.href} {...s} hijo activo={activo(s.href)} plegado={false} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Enlace key={n.href} {...n} activo={SUBMENUS[n.href] ? enGrupo(n.href) : activo(n.href)} plegado={plegado} />
            ),
          )}
          {d.esAdmin && (
            <>
              {!plegado ? <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Admin</p> : <hr className="my-3 border-border" />}
              {NAV_ADMIN.map((n) => (
                <Enlace key={n.href} {...n} activo={activo(n.href)} plegado={plegado} contador={n.href === '/admin/datos' ? avisos : undefined} />
              ))}
            </>
          )}
        </nav>
        <button onClick={salir} title="Cerrar sesión" className={cn('flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text', plegado && 'justify-center px-0')}>
          <LogOut className="h-[18px] w-[18px]" />
          {!plegado && <span className="truncate">Salir{d.usuario ? ` (${d.usuario.user})` : ''}</span>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
          <Ondas className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-8 w-full opacity-[0.07]" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <span className="md:hidden">
              <Logo alto={28} />
            </span>
            <div className="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto">
              {d.meta && d.meta.anios.length > 0 && (
                <Selector etiqueta="Año" value={d.anio ?? ''} onChange={(e) => d.setAnio(Number(e.target.value))}>
                  {d.meta.anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Selector>
              )}
              {d.dataset && !sinSelectorMes && (
                <Selector etiqueta="Mes" value={d.mes ?? ''} onChange={(e) => d.setMes(Number(e.target.value))}>
                  {d.dataset.operativo.map((m) => (
                    <option key={m.mes} value={m.mes}>
                      {mesLargo(m.mes)}
                      {m.enCurso ? ' · en curso' : ''}
                    </option>
                  ))}
                </Selector>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
              <IndicadorVivo />
              <button onClick={d.alternarTema} aria-label={d.tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
                {d.tema === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>
              <Boton variante="suave" onClick={exportar} disabled={!d.dataset || exportando} className="h-9 px-3" aria-label="Exportar todo en CSV">
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">{exportando ? 'Exportando…' : 'Exportar CSV'}</span>
              </Boton>
              <button onClick={salir} aria-label="Cerrar sesión" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text md:hidden">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <Avisos />

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10">{esAdminRuta ? children : <ConDatos>{children}</ConDatos>}</main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {itemsMovil.map((n) => (
          <Link key={n.href} href={n.href} aria-current={activoMovil(n.href) ? 'page' : undefined} className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium', activoMovil(n.href) ? 'text-primary' : 'text-muted')}>
            <n.icono className="h-5 w-5" />
            <span className="max-w-full truncate px-0.5">{n.texto === 'Salud de datos' ? 'Salud' : n.texto}</span>
            {n.href === '/admin/datos' && avisos > 0 && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-amarillo" />}
          </Link>
        ))}
      </nav>

      <AnimatePresence>
        {d.aviso && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-card md:bottom-6"
          >
            <CheckCircle2 className="h-4 w-4 text-ok" /> {d.aviso}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Banner cuando OneDrive falla: se siguen mostrando los últimos datos guardados, con su fecha. */
function Avisos() {
  const { meta, esAdmin, dataset } = useDatos();
  if (!meta?.error) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-amarillo/20 px-4 py-2 text-sm sm:px-6">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {esAdmin ? meta.error : 'No se pudo actualizar desde OneDrive.'}
        {dataset && meta.lastChecked && <> Se muestran los últimos datos guardados ({fechaHora(meta.lastChecked)}).</>}
      </span>
      {esAdmin && (
        <Link href="/admin/conexion" className="font-semibold underline underline-offset-2">
          {meta.reconectar ? 'Reconectar OneDrive' : 'Ver conexión'}
        </Link>
      )}
    </div>
  );
}

/** Estados de carga, error y "sin datos" comunes a todos los módulos de reportes. */
function ConDatos({ children }: { children: React.ReactNode }) {
  const { cargando, error, dataset, esAdmin, meta } = useDatos();
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando datos">
        <Esqueleto className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} className="h-32" />
          ))}
        </div>
        <Esqueleto className="h-72" />
      </div>
    );
  }
  if (!dataset) {
    return (
      <Vacio titulo={error ? 'No se pudieron cargar los datos' : 'Todavía no hay datos'}>
        {error ? (
          <p>{error}</p>
        ) : esAdmin ? (
          <>
            <p>{meta?.error ?? 'Conectá OneDrive y elegí la planilla para empezar a ver los reportes.'}</p>
            <Link href="/admin/conexion" className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">
              Ir a Conexión
            </Link>
          </>
        ) : (
          <p>El administrador todavía no conectó la planilla. Volvé a intentar en unos minutos.</p>
        )}
      </Vacio>
    );
  }
  return <>{children}</>;
}
