'use client';

import * as Popover from '@radix-ui/react-popover';
import { CheckCircle2, ChevronDown, Equal, Minus, Plus, TriangleAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { Fragment, useMemo, useState } from 'react';
import { Cascada, etiquetaPaso } from '@/components/cascada';
import { useDatos } from '@/components/datos';
import { PestanasFinanciero } from '@/components/financiero-tabs';
import { Numero, Variacion } from '@/components/kpi';
import { cn, Etiqueta, Informacion, Panel, Selector, Tarjeta, TituloSeccion, Vacio, type InfoKpi } from '@/components/ui';
import type { Reporte } from '@/lib/csv';
import { cascada, lecturaAutomatica, matrizFlujo, periodoAnterior, resumenFlujo, type FilaMatriz, type PeriodoFlujo, type ResumenFlujo } from '@/lib/engine/metrics-flujo';
import type { LineaDetalle } from '@/lib/engine/types';
import { gs, mesCorto, mesLargo, pct, SIN_DATO } from '@/lib/format';
import { nombreCategoria, rDistribucionGastos, rLineasGastos, rMatrizFlujo } from '@/lib/reportes';

const FUENTE_ING = 'INGRESOS, tablas de detalle (columna VALOR)';
const FUENTE_GAS = 'GASTOS, tablas de detalle (columna VALOR)';
const FUENTE_CAJA = 'FLUJO CAJA';

const variacion = (a: number | null, b: number | null | undefined) => (a !== null && b !== null && b !== undefined && b !== 0 ? (a - b) / Math.abs(b) : null);

type Comparacion = { fraccion: number | null; etiqueta: string; invertir?: boolean } | undefined;

// ───────────────────────── A. Ecuación de caja y ganancias ─────────────────────────

function Termino({ titulo, valor, info, comparar, final, signo, indice }: { titulo: string; valor: number | null; info: InfoKpi; comparar?: Comparacion; final?: boolean; signo?: 'mas' | 'menos' | 'igual'; indice: number }) {
  const Icono = signo === 'mas' ? Plus : signo === 'menos' ? Minus : signo === 'igual' ? Equal : null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: indice * 0.06 }} className="flex min-w-0 items-stretch gap-3 md:contents">
      {Icono && (
        <span className="grid w-6 shrink-0 place-items-center text-muted md:w-8" aria-hidden>
          <Icono className="h-5 w-5" strokeWidth={2.5} />
        </span>
      )}
      <div className={cn('min-w-0 flex-1 rounded-2xl px-4 py-3', final ? 'bg-primary-soft ring-1 ring-primary/30' : 'bg-surface-2/60')}>
        <div className="flex items-center gap-1">
          <p className={cn('min-w-0 flex-1 truncate text-sm', final ? 'font-semibold text-text' : 'font-medium text-muted')}>{titulo}</p>
          <Informacion info={info} titulo={titulo} />
        </div>
        <Numero valor={valor} formato={gs} className={cn('block font-display font-extrabold leading-tight', final ? 'text-[1.75rem] xl:text-[2rem]' : 'text-xl xl:text-2xl', valor !== null && valor < 0 && 'text-alerta')} />
        <div className="mt-1 min-h-4">{comparar && <Variacion {...comparar} />}</div>
      </div>
    </motion.div>
  );
}

function Ganancia({ titulo, valor, margen, nombreMargen, info, comparar, indice, destacada }: { titulo: string; valor: number | null; margen: number | null; nombreMargen: string; info: InfoKpi; comparar?: Comparacion; indice: number; destacada?: boolean }) {
  const ancho = margen === null ? 0 : Math.min(100, Math.abs(margen) * 100);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: indice * 0.06 }} className="min-w-0">
      <Tarjeta className={cn('h-full p-4 sm:p-5', destacada && 'ring-1 ring-primary/25')}>
        <div className="flex items-center gap-1">
          <p className="min-w-0 flex-1 text-sm font-semibold">{titulo}</p>
          <Informacion info={info} titulo={titulo} />
        </div>
        <Numero valor={valor} formato={gs} className={cn('mt-1 block font-display text-3xl font-extrabold leading-tight', valor !== null && valor < 0 && 'text-alerta')} />
        <div className="mt-1 min-h-4">{comparar && <Variacion {...comparar} />}</div>
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted">{nombreMargen}</span>
          <span className={cn('num font-display text-xl font-extrabold', margen !== null && margen < 0 && 'text-alerta')}>{pct(margen)}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${nombreMargen}: ${pct(margen)}`}>
          <div className={cn('h-full rounded-full transition-[width] duration-700', margen !== null && margen < 0 ? 'bg-alerta' : 'bg-turquesa')} style={{ width: `${ancho}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted">sobre los ingresos del período</p>
      </Tarjeta>
    </motion.div>
  );
}

// ───────────────────────── E. Lectura automática ─────────────────────────

/** Resalta los números dentro de cada frase para leerla de un vistazo. */
function ConNumeros({ texto }: { texto: string }) {
  const partes = texto.split(/(Gs\. [\d.]+|[+−]?[\d.]+(?:,\d+)? %|[+−][\d.]+(?:,\d+)?(?: pts)?)/);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="num font-semibold text-text">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

// ───────────────────────── C. Distribución de gastos ─────────────────────────

/** Líneas reales de la tabla de detalle de GASTOS: responden "en qué y por qué". */
function Lineas({ lineas, conMes }: { lineas: LineaDetalle[]; conMes: boolean }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {lineas.map((l) => (
        <li key={`${l.mes}-${l.celda}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
          <span className="min-w-0">
            <span className="font-medium">{l.concepto}</span>
            {conMes && <span className="text-muted"> · {mesLargo(l.mes)}</span>}
            <span className={cn('block text-xs', l.obs ? 'text-text' : 'italic text-muted')}>{l.obs ?? 'Sin detalle cargado'}</span>
          </span>
          <span className="text-right">
            <span className="num block whitespace-nowrap font-semibold">{gs(l.valor)}</span>
            <span className="block text-[11px] text-muted">GASTOS!{l.celda}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Distribucion({ r }: { r: ResumenFlujo }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const max = Math.max(1, ...r.categorias.map((c) => c.valor));
  if (!r.categorias.length) return <p className="py-6 text-center text-sm text-muted">Sin gastos cargados en este período.</p>;
  const columnas = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_9rem_6.5rem_6.5rem]';
  return (
    <div>
      <div className={cn(columnas, 'border-b border-border px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted')}>
        <span>Categoría</span>
        <span className="text-right">Monto</span>
        <span className="hidden text-right sm:block">% del gasto</span>
        <span className="hidden text-right sm:block">% de ingresos</span>
      </div>
      <ul>
        {r.categorias.map((c, i) => {
          const abiertaEsta = abierta === c.categoria;
          const delGasto = r.gastos ? c.valor / r.gastos : null;
          const deIngresos = r.ingresos ? c.valor / r.ingresos : null;
          return (
            <li key={c.categoria} className="border-b border-border last:border-0">
              <button onClick={() => setAbierta(abiertaEsta ? null : c.categoria)} aria-expanded={abiertaEsta} className={cn(columnas, 'w-full px-2 py-2.5 text-left transition-colors hover:bg-surface-2/70', abiertaEsta && 'bg-surface-2/70')}>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', abiertaEsta && 'rotate-180')} />
                    <span className="truncate">{nombreCategoria(c.categoria)}</span>
                    {i === 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-amarillo" title="Mayor gasto" />}
                  </span>
                  <span className="mt-1.5 ml-5.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className={cn('block h-full rounded-full', i === 0 ? 'bg-amarillo' : 'bg-primary/70')} style={{ width: `${(c.valor / max) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block whitespace-nowrap text-sm font-semibold">{gs(c.valor)}</span>
                  <span className="num block text-[11px] text-muted sm:hidden">
                    {pct(delGasto)} del gasto · {pct(deIngresos)} de ingresos
                  </span>
                </span>
                <span className="num hidden text-right text-sm sm:block">{pct(delGasto)}</span>
                <span className="num hidden text-right text-sm text-muted sm:block">{pct(deIngresos)}</span>
              </button>
              {abiertaEsta && (
                <div className="mb-3 ml-7 mr-2 rounded-xl border border-border bg-surface px-3">
                  <Lineas lineas={c.lineas} conMes={r.meses.length > 1} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className={cn(columnas, 'mt-1 rounded-xl bg-surface-2 px-2 py-2.5 font-semibold')}>
        <span className="pl-5.5 text-sm">Total gastos</span>
        <span className="num whitespace-nowrap text-right text-sm">{gs(r.gastos)}</span>
        <span className="num hidden text-right text-sm sm:block">100 %</span>
        <span className="num hidden text-right text-sm sm:block">{r.ingresos && r.gastos !== null ? pct(r.gastos / r.ingresos) : SIN_DATO}</span>
      </div>
    </div>
  );
}

// ───────────────────────── D. Matriz ─────────────────────────

function Matriz({ lineas }: { lineas: LineaDetalle[] }) {
  const { dataset: d } = useDatos();
  const [todas, setTodas] = useState(false);
  const mz = useMemo(() => (d ? matrizFlujo(d) : null), [d]);
  if (!d || !mz) return null;

  const esCero = (f: FilaMatriz) => f.valores.every((v) => !v) && !f.total;
  const filas = mz.filas.filter((f) => todas || !(f.categoria && esCero(f)));
  const ocultas = mz.filas.filter((f) => f.categoria && esCero(f)).length;
  const categorias = mz.filas.filter((f) => f.categoria);
  const mayorDelMes = mz.columnas.map((_, i) => Math.max(...categorias.map((f) => f.valores[i] ?? 0)));
  const fmt = (f: FilaMatriz, v: number | null) => (v === null ? '—' : f.tipo === 'pct' ? pct(v) : gs(v).replace('Gs. ', ''));
  const titulos: Record<string, string> = { caja: 'Caja', ingreso: 'Ingresos', gasto: 'Gastos', resultado: 'Resultado', control: 'Control' };
  // Jerarquía: los totales y la caja al cierre se destacan; los márgenes quedan como dato secundario.
  const estilo = (f: FilaMatriz) =>
    f.clave === 'caja-cierre' || f.clave === 'ganancia-real'
      ? { fila: 'bg-primary-soft', texto: 'font-bold text-text' }
      : f.destacada
        ? { fila: 'bg-surface-2/80', texto: 'font-semibold text-text' }
        : f.tipo === 'pct'
          ? { fila: '', texto: 'text-xs text-muted' }
          : { fila: '', texto: '' };
  const sticky = (f: FilaMatriz) => (f.clave === 'caja-cierre' || f.clave === 'ganancia-real' ? 'bg-primary-soft' : f.destacada ? 'bg-surface-2' : 'bg-surface');

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Montos en Gs. Tocá un gasto para ver sus líneas.</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amarillo" /> Mayor gasto del mes
        </span>
        {ocultas > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="accent-[var(--primary)]" />
            Mostrar todas ({ocultas} en 0)
          </label>
        )}
      </div>
      <div className="relative -mx-1 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="sticky left-0 z-20 border-b-2 border-border bg-surface px-3 py-2 text-left">
                Concepto
              </th>
              {mz.columnas.map((c) => (
                <th key={c.mes} scope="col" className={cn('whitespace-nowrap border-b-2 border-border px-2.5 py-2 text-right', c.parcial && 'opacity-60')}>
                  {mesCorto(c.mes)}
                  {c.parcial && <span className="block text-[10px] font-medium normal-case">parcial</span>}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap border-b-2 border-l border-border px-2.5 py-2 text-right">
                Promedio
                <span className="block text-[10px] font-medium normal-case">mensual</span>
              </th>
              <th scope="col" className="z-20 whitespace-nowrap border-b-2 border-l border-border bg-surface-2 px-2.5 py-2 text-right text-text md:sticky md:right-0 md:shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.35)]">
                Total
                <span className="block text-[10px] font-medium normal-case text-muted">meses cerrados</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, k) => {
              const nuevoGrupo = k === 0 || filas[k - 1].grupo !== f.grupo;
              const nombre = f.categoria || (f.grupo === 'ingreso' && !f.destacada) ? nombreCategoria(f.titulo) : f.titulo;
              const e = estilo(f);
              return (
                <Fragment key={f.clave}>
                  {nuevoGrupo && (
                    <tr>
                      <th colSpan={mz.columnas.length + 3} scope="colgroup" className="sticky left-0 bg-surface px-3 pb-1.5 pt-5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
                        {titulos[f.grupo]}
                      </th>
                    </tr>
                  )}
                  <tr className={cn('transition-colors hover:bg-surface-2/50', e.fila)}>
                    <th scope="row" className={cn('sticky left-0 z-10 max-w-36 truncate sm:max-w-52 whitespace-nowrap border-b border-border px-3 py-2 text-left font-normal', sticky(f), e.texto, (f.categoria || (f.grupo === 'ingreso' && !f.destacada)) && 'pl-6')} title={nombre}>
                      {nombre}
                    </th>
                    {f.valores.map((v, i) => {
                      const col = mz.columnas[i];
                      if (f.tipo === 'check') {
                        return (
                          <td key={i} className={cn('border-b border-border px-2.5 py-2 text-right', col.parcial && 'opacity-60')}>
                            {v === null ? <span className="text-muted">—</span> : v ? <CheckCircle2 aria-label="Coherente" className="ml-auto h-4 w-4 text-ok" /> : <TriangleAlert aria-label="No coincide" className="ml-auto h-4 w-4 text-alerta" />}
                          </td>
                        );
                      }
                      const esMayor = !!f.categoria && v !== null && v > 0 && v === mayorDelMes[i];
                      const lineasCelda = f.categoria && v ? lineas.filter((l) => l.mes === col.mes && l.categoria === f.categoria) : [];
                      const contenido = (
                        <span className={cn('num inline-flex items-center gap-1.5', v !== null && v < 0 && 'text-alerta', v === null && 'text-muted/60', esMayor && 'font-semibold')}>
                          {esMayor && <span className="h-1.5 w-1.5 rounded-full bg-amarillo" aria-label="Mayor gasto del mes" />}
                          {fmt(f, v)}
                        </span>
                      );
                      return (
                        <td key={i} className={cn('whitespace-nowrap border-b border-border px-2.5 py-2 text-right', e.texto, col.parcial && 'opacity-60')}>
                          {lineasCelda.length ? (
                            <Popover.Root>
                              <Popover.Trigger className="rounded px-0.5 hover:bg-surface-2 hover:underline hover:underline-offset-4" aria-label={`${nombre}, ${mesLargo(col.mes)}: ver líneas`}>
                                {contenido}
                              </Popover.Trigger>
                              <Popover.Portal>
                                <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-surface p-3 shadow-card">
                                  <p className="font-display text-base font-extrabold">
                                    {nombre} · {mesLargo(col.mes)}
                                  </p>
                                  <Lineas lineas={lineasCelda} conMes={false} />
                                </Popover.Content>
                              </Popover.Portal>
                            </Popover.Root>
                          ) : (
                            contenido
                          )}
                        </td>
                      );
                    })}
                    <td className={cn('num whitespace-nowrap border-b border-l border-border px-2.5 py-2 text-right text-muted', f.tipo === 'pct' && 'text-xs', (f.promedio ?? 0) < 0 && 'text-alerta')}>{f.tipo === 'check' ? '' : fmt(f, f.promedio)}</td>
                    <td className={cn('num z-10 whitespace-nowrap border-b border-l border-border bg-surface-2 px-2.5 py-2 text-right font-semibold md:sticky md:right-0 md:shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.35)]', e.texto, (f.total ?? 0) < 0 && 'text-alerta')}>{f.tipo === 'check' ? '' : fmt(f, f.total)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Total y promedio usan solo meses cerrados. En las filas de caja, el total es la caja del primer (inicial) o del último (cierre) mes cerrado.</p>
    </div>
  );
}

// ───────────────────────── Página ─────────────────────────

export default function FlujoDetallado() {
  const { dataset: d } = useDatos();
  const [eleccion, setEleccion] = useState('acumulado');

  const datos = useMemo(() => {
    if (!d) return null;
    const periodo: PeriodoFlujo = eleccion === 'acumulado' ? { tipo: 'acumulado' } : { tipo: 'mes', mes: Number(eleccion) };
    const r = resumenFlujo(d, periodo);
    if (!r) return null;
    const pAnt = periodoAnterior(d, periodo);
    const ant = pAnt ? resumenFlujo(d, pAnt) : null;
    return { r, ant, pasos: cascada(r), pasosAnt: ant ? cascada(ant) : [], lectura: lecturaAutomatica(r, ant) };
  }, [d, eleccion]);
  if (!d) return null;

  const mesesDisponibles = d.financiero.meses.filter((m) => m.ingresos !== null || m.gastos !== null);
  const r = datos?.r;
  const ant = datos?.ant ?? null;
  const etiquetaAnt = ant ? (ant.periodo.tipo === 'mes' ? mesLargo(ant.meses[0]) : ant.etiqueta) : null;
  const vsAnt = (a: number | null, b: number | null | undefined, invertir = false): Comparacion => (etiquetaAnt && !r?.parcial ? { fraccion: variacion(a, b), etiqueta: `vs ${etiquetaAnt}`, invertir } : undefined);

  return (
    <>
      <PestanasFinanciero />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <TituloSeccion nota={r ? `${r.etiqueta}${etiquetaAnt && !r.parcial ? ` · comparado con ${etiquetaAnt}` : ''}` : undefined}>Flujo de caja detallado</TituloSeccion>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r?.parcial && <Etiqueta tono="vivo">En vivo · parcial</Etiqueta>}
          {r?.coherente === false && (
            <Etiqueta tono="alerta">
              <TriangleAlert className="h-3 w-3" /> La caja no cierra
            </Etiqueta>
          )}
          {r?.coherente === true && (
            <Etiqueta tono="ok">
              <CheckCircle2 className="h-3 w-3" /> Caja coherente
            </Etiqueta>
          )}
          <Selector etiqueta="Período" value={eleccion} onChange={(e) => setEleccion(e.target.value)}>
            <option value="acumulado">Acumulado de meses cerrados</option>
            {mesesDisponibles.map((m) => (
              <option key={m.mes} value={m.mes}>
                {mesLargo(m.mes)}
                {m.enCurso ? ' · en vivo, parcial' : ''}
              </option>
            ))}
          </Selector>
        </div>
      </div>

      {!r || !datos ? (
        <Vacio titulo="Sin datos para este período">Todavía no hay meses cerrados con ingresos y gastos cargados.</Vacio>
      ) : (
        <>
          {/* A. De un vistazo: la ecuación de la caja */}
          <Tarjeta className="p-4 sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Cómo se movió la caja</p>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.25fr)] md:items-center md:gap-3">
              <Termino indice={0} titulo="Caja inicial" valor={r.cajaInicial} comparar={r.periodo.tipo === 'mes' ? vsAnt(r.cajaInicial, ant?.cajaInicial) : undefined} info={{ formula: r.meses.length > 1 ? 'Caja inicial del primer mes del período.' : 'Caja inicial del mes.', fuente: `${FUENTE_CAJA}, fila CAJA INICIAL (${mesLargo(r.meses[0])})` }} />
              <Termino indice={1} signo="mas" titulo="Ingresos totales" valor={r.ingresos} comparar={vsAnt(r.ingresos, ant?.ingresos)} info={{ formula: 'Σ de la columna VALOR de los bloques de los meses del período (lo efectivamente cobrado).', fuente: FUENTE_ING }} />
              <Termino indice={2} signo="menos" titulo="Gastos totales" valor={r.gastos} comparar={vsAnt(r.gastos, ant?.gastos, true)} info={{ formula: 'Σ de la columna VALOR de los bloques de los meses del período. Lo escrito en comentarios no se suma.', fuente: FUENTE_GAS }} />
              <Termino
                indice={3}
                signo="igual"
                final
                titulo="Caja al cierre"
                valor={r.cajaCierre}
                comparar={vsAnt(r.cajaCierre, ant?.cajaCierre)}
                info={{ formula: r.meses.length > 1 ? 'Caja al cierre del último mes del período.' : 'Caja al cierre del mes.', fuente: `${FUENTE_CAJA}, fila CAJA AL CIERRE (${mesLargo(r.meses[r.meses.length - 1])})`, nota: r.parcial ? 'Mes en curso: la planilla calcula este valor con lo cargado hasta hoy.' : r.coherente === false ? 'No coincide con caja inicial + ganancia real: ver la matriz y Salud de datos.' : undefined }}
              />
            </div>
          </Tarjeta>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <Ganancia indice={4} titulo="Ganancia bruta" valor={r.gananciaBruta} margen={r.margenBruto} nombreMargen="Margen bruto" comparar={vsAnt(r.gananciaBruta, ant?.gananciaBruta)} info={{ formula: 'Ingresos − Recursos Humanos. Margen bruto = Ganancia bruta ÷ Ingresos.', fuente: `${FUENTE_ING} y ${FUENTE_GAS}` }} />
            <Ganancia indice={5} destacada titulo="Ganancia real" valor={r.gananciaReal} margen={r.margenNeto} nombreMargen="Margen neto" comparar={vsAnt(r.gananciaReal, ant?.gananciaReal)} info={{ formula: 'Ingresos − Gastos totales. Margen neto = Ganancia real ÷ Ingresos.', fuente: `${FUENTE_ING} y ${FUENTE_GAS}` }} />
            <Panel className="lg:col-span-2 xl:col-span-1" titulo="Lectura automática" subtitulo="Frases armadas con reglas fijas a partir de los datos." info={{ formula: 'Cada frase se genera solo si hay datos suficientes: peso de RR. HH. sobre ingresos, mayor gasto después de RR. HH., gasto que más creció, margen neto y variación de la caja.', fuente: `${FUENTE_CAJA}, ${FUENTE_ING} y ${FUENTE_GAS}` }}>
              {datos.lectura.length ? (
                <ul className="space-y-2.5">
                  {datos.lectura.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-turquesa" aria-hidden />
                      <span>
                        <ConNumeros texto={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No hay datos suficientes para armar la lectura.</p>
              )}
            </Panel>
          </div>

          {/* B. Cascada */}
          <Panel
            className="mt-4"
            titulo="De la caja inicial a la caja al cierre"
            subtitulo="Paso a paso: qué entró, en qué se gastó y cómo cerró la caja. Los gastos menores al 2 % van juntos en «Otros gastos»."
            reporte={{ id: 'flujo-cascada', titulo: 'Cascada del flujo de caja', periodo: r.etiqueta.replace(/ a /, '-a-'), columnas: [{ titulo: 'Paso', tipo: 'texto' }, { titulo: 'Monto', tipo: 'gs' }, { titulo: 'Desde', tipo: 'gs' }, { titulo: 'Hasta', tipo: 'gs' }], filas: datos.pasos.map((x) => [etiquetaPaso(x), x.tipo === 'gasto' ? -x.monto : x.monto, x.desde, x.hasta]) } satisfies Reporte}
            info={{ formula: 'Caja inicial → + Ingresos → − Recursos Humanos → = Ganancia bruta → − cada categoría de gasto (de mayor a menor) → = Ganancia real → = Caja al cierre. Los subtotales se dibujan desde el nivel de la caja inicial.', fuente: `${FUENTE_CAJA} (caja), ${FUENTE_ING} y ${FUENTE_GAS}` }}
          >
            {datos.pasos.length ? <Cascada pasos={datos.pasos} resumen={r} anteriores={datos.pasosAnt} etiquetaAnterior={r.parcial ? null : etiquetaAnt} /> : <p className="py-8 text-center text-sm text-muted">{SIN_DATO}</p>}
          </Panel>

          {/* C. Distribución */}
          <Panel
            className="mt-4"
            titulo="¿Dónde se fue la plata?"
            subtitulo={`${r.etiqueta} · tocá una categoría para ver sus líneas y el comentario de cada una`}
            reporte={rDistribucionGastos(r)}
            reportesExtra={[rLineasGastos(r)]}
            info={{ formula: 'Σ de la columna VALOR del detalle de GASTOS agrupada por concepto. % del gasto total y % de los ingresos del período.', fuente: `${FUENTE_GAS}; el texto de cada línea sale de la columna OBS / COMENTARIO / FECHA` }}
          >
            <Distribucion r={r} />
          </Panel>
        </>
      )}

      {/* D. Matriz */}
      <Panel
        className="mt-4"
        titulo="Estado de flujo de caja"
        subtitulo="Mismo esquema que la pestaña FLUJO CAJA de la planilla, con los gastos tomados del detalle."
        reporte={rMatrizFlujo(d)}
        info={{ formula: 'Caja inicial y al cierre de FLUJO CAJA; ingresos y gastos por concepto del detalle de INGRESOS y GASTOS; ganancias y márgenes calculados. La última fila controla que caja inicial + ganancia real = caja al cierre.', fuente: `${FUENTE_CAJA}, ${FUENTE_ING} y ${FUENTE_GAS}` }}
      >
        <Matriz lineas={d.detalle.gastos} />
      </Panel>
    </>
  );
}
