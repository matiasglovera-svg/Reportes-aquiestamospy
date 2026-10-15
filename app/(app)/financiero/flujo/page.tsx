'use client';

import * as Popover from '@radix-ui/react-popover';
import { CheckCircle2, ChevronDown, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cascada, etiquetaPaso } from '@/components/cascada';
import { useDatos } from '@/components/datos';
import { PestanasFinanciero } from '@/components/financiero-tabs';
import { Kpi } from '@/components/kpi';
import { cn, Etiqueta, MenuCsv, Panel, Selector, TituloSeccion, Vacio } from '@/components/ui';
import type { Reporte } from '@/lib/csv';
import { cascada, lecturaAutomatica, matrizFlujo, periodoAnterior, resumenFlujo, type FilaMatriz, type PeriodoFlujo, type ResumenFlujo } from '@/lib/engine/metrics-flujo';
import type { LineaDetalle } from '@/lib/engine/types';
import { gs, mesCorto, mesLargo, pct, SIN_DATO } from '@/lib/format';
import { nombreCategoria, rDistribucionGastos, rLineasGastos, rMatrizFlujo } from '@/lib/reportes';

const FUENTE_ING = 'INGRESOS, tablas de detalle (columna VALOR)';
const FUENTE_GAS = 'GASTOS, tablas de detalle (columna VALOR)';
const FUENTE_CAJA = 'FLUJO CAJA';

const variacion = (a: number | null, b: number | null | undefined) => (a !== null && b !== null && b !== undefined && b !== 0 ? (a - b) / Math.abs(b) : null);

/** Líneas reales de la tabla de detalle de GASTOS: responden "en qué y por qué". */
function Lineas({ lineas, conMes }: { lineas: LineaDetalle[]; conMes: boolean }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {lineas.map((l) => (
        <li key={`${l.mes}-${l.celda}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
          {conMes && <span className="w-20 shrink-0 text-xs text-muted">{mesLargo(l.mes)}</span>}
          <span className="min-w-0 flex-1">
            <span className="font-medium">{l.concepto}</span>
            <span className={cn('block text-xs', l.obs ? 'text-text' : 'italic text-muted')}>{l.obs ?? 'Sin detalle cargado'}</span>
          </span>
          <span className="num whitespace-nowrap font-semibold">{gs(l.valor)}</span>
          <span className="w-full text-[11px] text-muted sm:w-auto">GASTOS!{l.celda}</span>
        </li>
      ))}
    </ul>
  );
}

/** C. ¿Dónde se fue la plata? */
function Distribucion({ r }: { r: ResumenFlujo }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const max = Math.max(1, ...r.categorias.map((c) => c.valor));
  if (!r.categorias.length) return <p className="py-6 text-center text-sm text-muted">Sin gastos cargados en este período.</p>;
  return (
    <ul className="space-y-1">
      {r.categorias.map((c, i) => {
        const abiertaEsta = abierta === c.categoria;
        return (
          <li key={c.categoria} className="rounded-xl">
            <button
              onClick={() => setAbierta(abiertaEsta ? null : c.categoria)}
              aria-expanded={abiertaEsta}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', abiertaEsta && 'rotate-180')} />
                <span className="truncate">{nombreCategoria(c.categoria)}</span>
                {i === 0 && <Etiqueta tono="estimado">Mayor gasto</Etiqueta>}
              </span>
              <span className="num whitespace-nowrap text-sm font-semibold">{gs(c.valor)}</span>
              <span className="col-span-2 flex items-center gap-3">
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className={cn('block h-full rounded-full', i === 0 ? 'bg-amarillo' : 'bg-primary')} style={{ width: `${(c.valor / max) * 100}%` }} />
                </span>
                <span className="num shrink-0 text-right text-xs text-muted sm:w-64">
                  {r.gastos ? pct(c.valor / r.gastos) : SIN_DATO} del gasto · {r.ingresos ? pct(c.valor / r.ingresos) : SIN_DATO} de ingresos
                </span>
              </span>
            </button>
            {abiertaEsta && (
              <div className="mb-2 ml-7 mr-2 rounded-xl border border-border px-3">
                <Lineas lineas={c.lineas} conMes={r.meses.length > 1} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** D. Matriz estilo Excel. */
function Matriz({ lineas }: { lineas: LineaDetalle[] }) {
  const { dataset: d } = useDatos();
  const [todas, setTodas] = useState(false);
  const mz = useMemo(() => (d ? matrizFlujo(d) : null), [d]);
  if (!d || !mz) return null;

  const esCero = (f: FilaMatriz) => f.valores.every((v) => !v) && !f.total;
  const filas = mz.filas.filter((f) => todas || !(f.categoria && esCero(f)));
  const ocultas = mz.filas.filter((f) => f.categoria && esCero(f)).length;
  const categorias = mz.filas.filter((f) => f.categoria);
  // Gasto más alto de cada mes.
  const mayorDelMes = mz.columnas.map((_, i) => Math.max(...categorias.map((f) => f.valores[i] ?? 0)));
  const fmt = (f: FilaMatriz, v: number | null) => (v === null ? '—' : f.tipo === 'pct' ? pct(v) : gs(v).replace('Gs. ', ''));
  const titulos: Record<string, string> = { caja: 'Caja', ingreso: 'Ingresos', gasto: 'Gastos', resultado: 'Resultado', control: 'Control' };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Montos en Gs. Tocá un gasto para ver sus líneas.</span>
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
            <tr>
              <th scope="col" className="sticky left-0 z-20 border-b border-border bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Concepto
              </th>
              {mz.columnas.map((c) => (
                <th key={c.mes} scope="col" className={cn('whitespace-nowrap border-b border-border bg-surface px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted', c.parcial && 'opacity-60')}>
                  {mesCorto(c.mes)}
                  {c.parcial && <span className="block text-[10px] normal-case">parcial</span>}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap border-b border-l border-border bg-surface px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                Total cerrados
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-border bg-surface px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                Promedio
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, k) => {
              const nuevoGrupo = k === 0 || filas[k - 1].grupo !== f.grupo;
              const maxFila = Math.max(1, ...f.valores.map((v) => Math.abs(v ?? 0)));
              const nombre = f.categoria ? nombreCategoria(f.titulo) : f.grupo === 'ingreso' && !f.destacada ? nombreCategoria(f.titulo) : f.titulo;
              return [
                nuevoGrupo && (
                  <tr key={`g-${f.grupo}`}>
                    <th colSpan={mz.columnas.length + 3} scope="colgroup" className="sticky left-0 bg-surface px-3 pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {titulos[f.grupo]}
                    </th>
                  </tr>
                ),
                <tr key={f.clave}>
                  <th scope="row" className={cn('sticky left-0 z-10 max-w-48 truncate whitespace-nowrap border-b border-border bg-surface px-3 py-1.5 text-left', f.destacada ? 'font-semibold' : 'font-normal', f.categoria && 'pl-5')} title={nombre}>
                    {nombre}
                  </th>
                  {f.valores.map((v, i) => {
                    const col = mz.columnas[i];
                    if (f.tipo === 'check') {
                      return (
                        <td key={i} className={cn('border-b border-border px-2 py-1.5 text-center', col.parcial && 'opacity-60')}>
                          {v === null ? <span className="text-muted">—</span> : v ? <CheckCircle2 aria-label="Coherente" className="mx-auto h-4 w-4 text-ok" /> : <TriangleAlert aria-label="No coincide" className="mx-auto h-4 w-4 text-alerta" />}
                        </td>
                      );
                    }
                    const intensidad = f.tipo === 'gs' && v ? 4 + Math.round((Math.abs(v) / maxFila) * 16) : 0;
                    const esMayor = !!f.categoria && v !== null && v > 0 && v === mayorDelMes[i];
                    const lineasCelda = f.categoria && v ? lineas.filter((l) => l.mes === col.mes && l.categoria === f.categoria) : [];
                    const contenido = <span className={cn('num', v !== null && v < 0 && 'text-alerta', esMayor && 'font-semibold')}>{fmt(f, v)}</span>;
                    return (
                      <td
                        key={i}
                        className={cn('whitespace-nowrap border-b border-border px-2 py-1.5 text-right', f.destacada && 'font-semibold', col.parcial && 'opacity-60')}
                        style={{ background: esMayor ? 'color-mix(in srgb, var(--amarillo) 38%, transparent)' : intensidad ? `color-mix(in srgb, var(--primary) ${intensidad}%, transparent)` : undefined }}
                      >
                        {lineasCelda.length ? (
                          <Popover.Root>
                            <Popover.Trigger className="rounded underline decoration-dotted underline-offset-4 hover:decoration-solid" aria-label={`${nombre}, ${mesLargo(col.mes)}: ver líneas`}>
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
                  <td className={cn('num whitespace-nowrap border-b border-l border-border px-2 py-1.5 text-right', f.destacada && 'font-semibold', (f.total ?? 0) < 0 && 'text-alerta')}>{f.tipo === 'check' ? '' : fmt(f, f.total)}</td>
                  <td className={cn('num whitespace-nowrap border-b border-border px-2 py-1.5 text-right text-muted', (f.promedio ?? 0) < 0 && 'text-alerta')}>{f.tipo === 'check' ? '' : fmt(f, f.promedio)}</td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Total y promedio usan solo meses cerrados. En las filas de caja, el total es la caja del primer (inicial) o del último (cierre) mes cerrado. Sombreado: más intenso = mayor valor de la fila; en amarillo, el gasto más alto de cada mes.
      </p>
    </div>
  );
}

export default function FlujoDetallado() {
  const { dataset: d } = useDatos();
  const [eleccion, setEleccion] = useState('acumulado');

  const periodo: PeriodoFlujo = eleccion === 'acumulado' ? { tipo: 'acumulado' } : { tipo: 'mes', mes: Number(eleccion) };
  const datos = useMemo(() => {
    if (!d) return null;
    const r = resumenFlujo(d, periodo);
    if (!r) return null;
    const pAnt = periodoAnterior(d, periodo);
    const ant = pAnt ? resumenFlujo(d, pAnt) : null;
    return { r, ant, pasos: cascada(r), pasosAnt: ant ? cascada(ant) : [], lectura: lecturaAutomatica(r, ant) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, eleccion]);
  if (!d) return null;

  const mesesDisponibles = d.financiero.meses.filter((m) => m.ingresos !== null || m.gastos !== null);
  const r = datos?.r;
  const ant = datos?.ant ?? null;
  const etiquetaAnt = ant ? (ant.periodo.tipo === 'mes' ? mesLargo(ant.meses[0]) : ant.etiqueta) : null;
  const vsAnt = (a: number | null, b: number | null | undefined, invertir = false) => (etiquetaAnt && !r?.parcial ? { fraccion: variacion(a, b), etiqueta: `vs ${etiquetaAnt}`, invertir } : undefined);
  const enVivo = r?.parcial ? <Etiqueta tono="vivo">En vivo · parcial</Etiqueta> : undefined;
  const matriz = rMatrizFlujo(d);

  return (
    <>
      <PestanasFinanciero />
      <TituloSeccion nota={r ? `${r.etiqueta}${etiquetaAnt && !r.parcial ? ` · comparado con ${etiquetaAnt}` : ''}` : undefined}>Flujo de caja detallado</TituloSeccion>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Selector etiqueta="Período" value={eleccion} onChange={(e) => setEleccion(e.target.value)}>
          <option value="acumulado">Acumulado de meses cerrados</option>
          {mesesDisponibles.map((m) => (
            <option key={m.mes} value={m.mes}>
              {mesLargo(m.mes)}
              {m.enCurso ? ' · en vivo, parcial' : ''}
            </option>
          ))}
        </Selector>
        {enVivo}
        {r && r.coherente === false && (
          <Etiqueta tono="alerta">
            <TriangleAlert className="h-3 w-3" /> La caja no cierra
          </Etiqueta>
        )}
        {r && r.coherente === true && (
          <Etiqueta tono="ok">
            <CheckCircle2 className="h-3 w-3" /> Caja coherente
          </Etiqueta>
        )}
      </div>

      {!r ? (
        <Vacio titulo="Sin datos para este período">Todavía no hay meses cerrados con ingresos y gastos cargados.</Vacio>
      ) : (
        <>
          {/* A. Indicadores */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi indice={0} titulo="Caja inicial" valor={r.cajaInicial} formato={gs} negativoEnAlerta etiqueta={enVivo} variacion={r.periodo.tipo === 'mes' ? vsAnt(r.cajaInicial, ant?.cajaInicial) : undefined} info={{ formula: r.meses.length > 1 ? 'Caja inicial del primer mes del período.' : 'Caja inicial del mes.', fuente: `${FUENTE_CAJA}, fila CAJA INICIAL (${mesLargo(r.meses[0])})` }} />
            <Kpi indice={1} titulo="Ingresos totales" valor={r.ingresos} formato={gs} etiqueta={enVivo} variacion={vsAnt(r.ingresos, ant?.ingresos)} info={{ formula: 'Σ de la columna VALOR de los bloques de los meses del período (lo efectivamente cobrado).', fuente: FUENTE_ING }} />
            <Kpi indice={2} titulo="Gastos totales" valor={r.gastos} formato={gs} etiqueta={enVivo} variacion={vsAnt(r.gastos, ant?.gastos, true)} info={{ formula: 'Σ de la columna VALOR de los bloques de los meses del período. Lo escrito en comentarios no se suma.', fuente: FUENTE_GAS }} />
            <Kpi
              indice={3}
              titulo="Ganancia bruta"
              valor={r.gananciaBruta}
              formato={gs}
              negativoEnAlerta
              etiqueta={enVivo}
              variacion={vsAnt(r.gananciaBruta, ant?.gananciaBruta)}
              pie={
                <>
                  Margen bruto: <span className="num font-semibold text-text">{pct(r.margenBruto)}</span>
                </>
              }
              info={{ formula: 'Ingresos − Recursos Humanos. Margen bruto = Ganancia bruta ÷ Ingresos.', fuente: `${FUENTE_ING} y ${FUENTE_GAS}` }}
            />
            <Kpi
              indice={4}
              titulo="Ganancia real"
              valor={r.gananciaReal}
              formato={gs}
              negativoEnAlerta
              etiqueta={enVivo}
              variacion={vsAnt(r.gananciaReal, ant?.gananciaReal)}
              pie={
                <>
                  Margen neto: <span className="num font-semibold text-text">{pct(r.margenNeto)}</span>
                </>
              }
              info={{ formula: 'Ingresos − Gastos totales. Margen neto = Ganancia real ÷ Ingresos.', fuente: `${FUENTE_ING} y ${FUENTE_GAS}` }}
            />
            <Kpi
              indice={5}
              titulo="Caja al cierre"
              valor={r.cajaCierre}
              formato={gs}
              negativoEnAlerta
              etiqueta={enVivo}
              variacion={vsAnt(r.cajaCierre, ant?.cajaCierre)}
              pie={r.coherente === false ? 'No coincide con caja inicial + ganancia real: ver la matriz y Salud de datos.' : undefined}
              info={{ formula: r.meses.length > 1 ? 'Caja al cierre del último mes del período.' : 'Caja al cierre del mes.', fuente: `${FUENTE_CAJA}, fila CAJA AL CIERRE (${mesLargo(r.meses[r.meses.length - 1])})`, nota: r.parcial ? 'Mes en curso: la planilla calcula este valor con lo cargado hasta hoy.' : undefined }}
            />
          </div>

          {/* B. Cascada + E. Lectura */}
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel
              titulo="De la caja inicial a la caja al cierre"
              subtitulo="Cuánto entró, cuánto salió y en qué, y cómo cerró la caja."
              reporte={{ id: 'flujo-cascada', titulo: 'Cascada del flujo de caja', periodo: r.etiqueta.replace(/ a /, '-a-'), columnas: [{ titulo: 'Paso', tipo: 'texto' }, { titulo: 'Monto', tipo: 'gs' }, { titulo: 'Desde', tipo: 'gs' }, { titulo: 'Hasta', tipo: 'gs' }], filas: datos!.pasos.map((x) => [etiquetaPaso(x), x.tipo === 'gasto' ? -x.monto : x.monto, x.desde, x.hasta]) } satisfies Reporte}
              info={{ formula: 'Caja inicial → + Ingresos → − Recursos Humanos → = Ganancia bruta → − cada categoría de gasto (de mayor a menor) → = Ganancia real → = Caja al cierre. Los subtotales se dibujan desde el nivel de la caja inicial.', fuente: `${FUENTE_CAJA} (caja), ${FUENTE_ING} y ${FUENTE_GAS}` }}
            >
              {datos!.pasos.length ? <Cascada pasos={datos!.pasos} resumen={r} anteriores={datos!.pasosAnt} etiquetaAnterior={r.parcial ? null : etiquetaAnt} /> : <p className="py-8 text-center text-sm text-muted">{SIN_DATO}</p>}
            </Panel>
            <Panel titulo="Lectura automática" subtitulo="Frases armadas con reglas fijas a partir de los datos." info={{ formula: 'Cada frase se genera solo si hay datos suficientes: peso de RR. HH. sobre ingresos, mayor gasto después de RR. HH., gasto que más creció, margen neto y variación de la caja.', fuente: `${FUENTE_CAJA}, ${FUENTE_ING} y ${FUENTE_GAS}` }}>
              {datos!.lectura.length ? (
                <ul className="space-y-3">
                  {datos!.lectura.map((t) => (
                    <li key={t} className="flex gap-2 text-[15px] leading-snug">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-turquesa" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No hay datos suficientes para armar la lectura.</p>
              )}
            </Panel>
          </div>

          {/* C. Distribución */}
          <Panel
            className="mt-4"
            titulo="¿Dónde se fue la plata?"
            subtitulo={`${r.etiqueta} · tocá una categoría para ver sus líneas y el comentario de cada una`}
            reporte={rDistribucionGastos(r)}
            acciones={<MenuCsv reporte={rLineasGastos(r)} />}
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
        reporte={matriz}
        info={{ formula: 'Caja inicial y al cierre de FLUJO CAJA; ingresos y gastos por concepto del detalle de INGRESOS y GASTOS; ganancias y márgenes calculados. La última fila controla que caja inicial + ganancia real = caja al cierre.', fuente: `${FUENTE_CAJA}, ${FUENTE_ING} y ${FUENTE_GAS}` }}
      >
        <Matriz lineas={d.detalle.gastos} />
      </Panel>
    </>
  );
}
