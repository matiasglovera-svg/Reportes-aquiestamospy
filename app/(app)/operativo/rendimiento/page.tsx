'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowDown, ArrowUp, ArrowUpDown, Info, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { barra, base, Grafico, usePaleta } from '@/components/chart';
import { useDatos } from '@/components/datos';
import { PestanasOperativo } from '@/components/financiero-tabs';
import { Kpi } from '@/components/kpi';
import { cn, Etiqueta, Informacion, Panel, Segmentos, Selector, Tarjeta, TituloSeccion, Vacio, type InfoKpi } from '@/components/ui';
import { CALOR } from '@/config/theme';
import { mesDeResumen } from '@/lib/engine/metrics-resumen';
import { rendimiento, vistaAnterior, type FilaRendimiento, type Rendimiento, type VistaRendimiento } from '@/lib/engine/metrics-rendimiento';
import { fecha, gs, gsCorto, mesLargo, num, pct } from '@/lib/format';
import { rRendimiento } from '@/lib/reportes';

const FUENTE_SERV = 'Pestaña del mes, tabla de servicios';

const COLUMNAS: { clave: keyof Pick<FilaRendimiento, 'operaria' | 'alcanzables' | 'unidades' | 'ocupacion' | 'salario' | 'ingreso' | 'diferencia'>; titulo: string; info: InfoKpi }[] = [
  { clave: 'operaria', titulo: 'Operaria', info: { formula: 'Nombre canónico (alias y normalización de nombres). "Sueldo fijo" marca a quien cobra sueldo mensual.', fuente: `${FUENTE_SERV}, columna PROFESIONAL (H); config/aliases.ts y config/staff.ts` } },
  { clave: 'alcanzables', titulo: 'Alcanzables', info: { formula: 'Capacidad del período: 48 servicios por mes, 12 por semana.', fuente: 'config/staff.ts (capacidad mensual y semanal)' } },
  { clave: 'unidades', titulo: 'Realizados', info: { formula: 'Unidades ponderadas por horas: horas ÷ 4 (4 h = 1 · 6 h = 1,5 · 8 h = 2). Debajo: servicios sin ponderar y horas.', fuente: `${FUENTE_SERV}, columnas HORAS TRABAJADAS (E) u HORARIO (F)` } },
  { clave: 'ocupacion', titulo: '% Ocupación', info: { formula: 'Realizados ÷ Alcanzables. Más de 100 % es sobreasignación.', fuente: 'Calculada' } },
  { clave: 'salario', titulo: 'Salario', info: { formula: 'Por servicio: Σ TOTAL (K = salario + movilidad) de sus servicios. Sueldo fijo: Total del panel COMISION del mes; en el mes en curso, el del último mes cerrado (estimado); en la vista semanal, el sueldo ÷ 4.', fuente: `${FUENTE_SERV}, columna K; panel PERSONAL DE LIMPIEZA (COMISION)` } },
  { clave: 'ingreso', titulo: 'Ingreso', info: { formula: 'Σ PRECIO FINAL (N) de los servicios que hizo, haya pagado o no el cliente. Los servicios sin precio no suman.', fuente: `${FUENTE_SERV}, columna N` } },
  { clave: 'diferencia', titulo: 'Diferencia', info: { formula: 'Ingreso − Salario: lo que dejó su trabajo después de pagarle.', fuente: 'Calculada' } },
];

/** Notita desplegable (funciona con toque en el teléfono, a diferencia de un title). */
function Nota({ etiqueta, children, alerta }: { etiqueta: string; children: React.ReactNode; alerta?: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={etiqueta} className={cn('inline-grid h-5 w-5 shrink-0 place-items-center rounded-full', alerta ? 'text-amarillo hover:bg-amarillo/20' : 'text-muted hover:bg-surface-2')}>
        {alerta ? <TriangleAlert className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-surface p-3 text-sm shadow-card">
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ColorOcupacion({ ocupacion, tema }: { ocupacion: number; tema: 'light' | 'dark' }) {
  const c = CALOR[tema];
  const color = ocupacion > 1 ? c.sobre : c.pasos[Math.min(c.pasos.length - 1, Math.max(1, Math.ceil(ocupacion * c.pasos.length) - 1))];
  return (
    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, ocupacion * 100)}%`, background: color }} />
    </span>
  );
}

function SalarioCelda({ f, semanal }: { f: FilaRendimiento; semanal: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1">
        {f.kNoSumado > 0 && (
          <Nota etiqueta={`${f.operaria}: montos K no sumados`}>
            <p className="font-semibold">Montos en K que no se suman</p>
            <p className="text-muted">
              Sus filas de servicio tienen {gs(f.kNoSumado)} en la columna TOTAL (K). No se suman: su sueldo es el Total del panel COMISION. Figura en Salud de datos.
            </p>
          </Nota>
        )}
        <span className={cn('num', f.salario === null && 'text-muted')}>{gs(f.salario)}</span>
      </span>
      {f.fija && (
        <span className="mt-0.5 flex flex-wrap justify-end gap-1">
          {f.origenSalario === 'estimado' && <Etiqueta tono="estimado">Estimado</Etiqueta>}
          {f.origenSalario === 'respaldo' && <Etiqueta tono="neutro">Respaldo config</Etiqueta>}
          {semanal && <span className="text-[10px] text-muted">Promedio semanal (sueldo ÷ 4)</span>}
        </span>
      )}
    </span>
  );
}

function DiferenciaCelda({ v, max }: { v: number | null; max: number }) {
  if (v === null) return <span className="text-muted">Sin dato</span>;
  const intensidad = v > 0 && max > 0 ? 8 + Math.round((v / max) * 24) : 0;
  return (
    <span
      className={cn('num inline-block rounded-md px-1.5 py-0.5 font-semibold', v < 0 ? 'bg-alerta-soft text-alerta' : 'text-ok')}
      style={v > 0 ? { background: `color-mix(in srgb, var(--ok) ${intensidad}%, transparent)` } : undefined}
    >
      {v > 0 ? '+' : ''}
      {gs(v)}
    </span>
  );
}

function Advertencias({ f }: { f: FilaRendimiento }) {
  if (!f.sinPrecio.length) return null;
  return (
    <Nota alerta etiqueta={`${f.operaria}: ${f.sinPrecio.length} servicios sin precio`}>
      <p className="font-semibold">{f.sinPrecio.length} servicios sin precio</p>
      <p className="mb-1 text-muted">Cuentan en realizados pero no suman al ingreso.</p>
      <ul className="space-y-0.5 text-xs">
        {f.sinPrecio.map((s) => (
          <li key={s.fila}>
            {fecha(s.fecha)} · {s.cliente ?? 'Sin nombre'} · fila {s.fila}
          </li>
        ))}
      </ul>
    </Nota>
  );
}

export default function RendimientoOperaria() {
  const { dataset: d, tema } = useDatos();
  const p = usePaleta();
  const [mesElegido, setMesElegido] = useState<number | null>(null);
  const [semana, setSemana] = useState<string>('mes');
  const [conAgendados, setConAgendados] = useState(false);
  const [sinActividad, setSinActividad] = useState(false);
  const [orden, setOrden] = useState<{ clave: (typeof COLUMNAS)[number]['clave']; asc: boolean }>({ clave: 'diferencia', asc: false });

  const mes = mesElegido ?? (d ? mesDeResumen(d) : null);
  const datos = useMemo(() => {
    if (!d || !mes) return null;
    const v: VistaRendimiento = { mes, semana: semana === 'mes' ? null : Number(semana), conAgendados, mostrarSinActividad: sinActividad };
    const r = rendimiento(d, v);
    const va = vistaAnterior(d, v);
    return { r, ant: va ? rendimiento(d, va) : null, va };
  }, [d, mes, semana, conAgendados, sinActividad]);
  if (!d || !mes || !datos) return null;

  const { r, ant, va } = datos;
  const semanal = r.vista.semana !== null;
  const enCurso = d.mesEnCurso === mes;
  const etiquetaPeriodo = `${semanal ? `Semana ${r.vista.semana} de ` : ''}${mesLargo(mes)}`;
  const etiquetaAnt = va ? `${va.semana ? `Semana ${va.semana} de ` : ''}${mesLargo(va.mes)}` : null;
  const variar = (a: number | null, b: number | null | undefined, invertir = false) =>
    etiquetaAnt && a !== null && b !== null && b !== undefined && b !== 0 && !enCurso ? { fraccion: (a - b) / Math.abs(b), etiqueta: `vs ${etiquetaAnt}`, invertir } : undefined;

  const filas = [...r.filas].sort((a, b) => {
    const x = a[orden.clave];
    const y = b[orden.clave];
    const cmp = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : ((x as number | null) ?? -Infinity) - ((y as number | null) ?? -Infinity);
    return orden.asc ? cmp : -cmp;
  });
  const maxDif = Math.max(0, ...r.filas.map((f) => f.diferencia ?? 0));
  const reporte = rRendimiento(d, r);

  // Gráfico: dinero generado (diferencia), de mayor a menor, con la ocupación como etiqueta.
  const graf = [...r.filas].filter((f) => f.diferencia !== null).sort((a, b) => b.diferencia! - a.diferencia!);
  const verde = tema === 'dark' ? '#6FDCB9' : '#17755B';
  const opcion = {
    ...base(p, { categorias: graf.map((f) => f.operaria), horizontal: true, formatoEje: gsCorto }),
    tooltip: {
      ...base(p, { categorias: [], horizontal: true }).tooltip,
      trigger: 'item',
      formatter: (x: { dataIndex: number }) => {
        const f = graf[x.dataIndex];
        return `<b>${f.operaria}</b><br/>Ingreso: ${gs(f.ingreso)}<br/>Salario: ${gs(f.salario)}<br/>Diferencia: <b>${gs(f.diferencia)}</b><br/>Ocupación: ${pct(f.ocupacion)}`;
      },
    },
    series: [
      barra(p, {
        name: 'Diferencia',
        barMaxWidth: 18,
        data: graf.map((f) => ({ value: f.diferencia, itemStyle: { color: f.diferencia! < 0 ? p.alerta : verde, borderRadius: f.diferencia! < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: p.tenue, fontSize: 11, formatter: (x: { dataIndex: number }) => pct(graf[x.dataIndex].ocupacion) },
      }),
    ],
  };

  const meses = d.operativo.filter((m) => m.cargados > 0 || m.enCurso);
  const ordenar = (clave: (typeof COLUMNAS)[number]['clave']) => setOrden((o) => ({ clave, asc: o.clave === clave ? !o.asc : clave === 'operaria' }));

  return (
    <>
      <PestanasOperativo />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <TituloSeccion nota={`${etiquetaPeriodo}${enCurso ? ' · mes en curso' : ''}${etiquetaAnt && !enCurso ? ` · comparado con ${etiquetaAnt}` : ''}`}>Rendimiento por operaria</TituloSeccion>
        <Selector etiqueta="Mes" value={mes} onChange={(e) => setMesElegido(Number(e.target.value))}>
          {meses.map((m) => (
            <option key={m.mes} value={m.mes}>
              {mesLargo(m.mes)}
              {m.enCurso ? ' · en curso' : ''}
            </option>
          ))}
        </Selector>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmentos
          etiqueta="Vista"
          valor={semana}
          onCambio={setSemana}
          opciones={[
            { valor: 'mes', texto: 'Mes' },
            { valor: '1', texto: 'Semana 1' },
            { valor: '2', texto: 'Semana 2' },
            { valor: '3', texto: 'Semana 3' },
            { valor: '4', texto: 'Semana 4' },
          ]}
        />
        {[
          { texto: 'Incluir agendados', valor: conAgendados, cambiar: setConAgendados },
          { texto: 'Mostrar sin actividad', valor: sinActividad, cambiar: setSinActividad },
        ].map((t) => (
          <label key={t.texto} className="flex cursor-pointer items-center gap-2 text-sm">
            <button
              type="button"
              role="switch"
              aria-checked={t.valor}
              aria-label={t.texto}
              onClick={() => t.cambiar(!t.valor)}
              className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', t.valor ? 'bg-primary' : 'bg-border')}
            >
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform', t.valor ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </button>
            <span className="text-muted">{t.texto}</span>
          </label>
        ))}
        {r.incluyeAgendados && <Etiqueta tono="estimado">Incluye agendados</Etiqueta>}
      </div>

      {!r.filas.length ? (
        <Vacio titulo="Sin servicios en este período">Probá con otro mes o activá "Incluir agendados".</Vacio>
      ) : (
        <>
          <Panel
            titulo="Dinero generado por operaria"
            subtitulo="Ingreso que generó su trabajo menos lo que cobró. La etiqueta de cada barra es su ocupación."
            reporte={reporte}
            info={{ formula: 'Diferencia = Ingreso (Σ N de sus servicios) − Salario (Σ K, o el sueldo fijo). Ordenado de mayor a menor.', fuente: `${FUENTE_SERV} y panel PERSONAL DE LIMPIEZA (COMISION)` }}
          >
            <Grafico alto={Math.max(180, graf.length * 30 + 40)} opcion={opcion} descripcion={`Dinero generado por operaria en ${etiquetaPeriodo}: ${graf.map((f) => `${f.operaria} ${gs(f.diferencia)}, ocupación ${pct(f.ocupacion)}`).join('; ')}`} />
          </Panel>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Kpi chico indice={0} titulo="Ingreso total generado" valor={r.total.ingreso} formato={gs} variacion={variar(r.total.ingreso, ant?.total.ingreso)} info={{ formula: 'Σ PRECIO FINAL (N) de los servicios del período de todas las operarias listadas.', fuente: `${FUENTE_SERV}, columna N` }} />
            <Kpi
              chico
              indice={1}
              titulo="Total pagado al personal"
              valor={r.total.salario}
              formato={gs}
              variacion={variar(r.total.salario, ant?.total.salario, true)}
              etiqueta={r.filas.some((f) => f.origenSalario === 'estimado') ? <Etiqueta tono="estimado">Estimado</Etiqueta> : undefined}
              info={{ formula: 'Σ de la columna Salario: K de las operarias por servicio + sueldos fijos (÷ 4 en la vista semanal).', fuente: `${FUENTE_SERV}, columna K; panel COMISION` }}
            />
            <Kpi chico indice={2} titulo="Diferencia total" valor={r.total.diferencia} formato={gs} negativoEnAlerta variacion={variar(r.total.diferencia, ant?.total.diferencia)} info={{ formula: 'Ingreso total − Total pagado al personal.', fuente: 'Calculada' }} />
          </div>

          <Panel className="mt-4" titulo="Detalle por operaria" subtitulo={`${etiquetaPeriodo} · tocá un encabezado para ordenar`} reporte={reporte}>
            {/* Escritorio y tablet: tabla con encabezado y primera columna fijos. */}
            <div className={cn('relative -mx-1 hidden overflow-auto md:block', filas.length > 14 && 'max-h-[75vh]')}>
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    {COLUMNAS.map((c, i) => (
                      <th key={c.clave} scope="col" className={cn('sticky top-0 z-20 whitespace-nowrap border-b-2 border-border bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted', i === 0 ? 'left-0 z-30 text-left' : 'text-right')}>
                        <span className={cn('inline-flex items-center gap-0.5', i > 0 && 'flex-row-reverse')}>
                          <button onClick={() => ordenar(c.clave)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:bg-surface-2 hover:text-text" aria-label={`Ordenar por ${c.titulo}`}>
                            {c.titulo}
                            {orden.clave === c.clave ? orden.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                          <Informacion info={c.info} titulo={c.titulo} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.operaria} className="hover:bg-surface-2/50">
                      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-border bg-surface px-3 py-2.5 text-left font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {f.operaria}
                          {f.fija && <Etiqueta tono="vivo">Sueldo fijo</Etiqueta>}
                          <Advertencias f={f} />
                        </span>
                      </th>
                      <td className="num border-b border-border px-3 py-2.5 text-right text-muted">{f.alcanzables}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right">
                        <span className="num block font-semibold">{num(f.unidades, 2)}</span>
                        <span className="num block text-[11px] text-muted">
                          {f.servicios} {f.servicios === 1 ? 'servicio' : 'servicios'} · {num(f.horas, 1)} h
                        </span>
                      </td>
                      <td className="w-36 border-b border-border px-3 py-2.5 text-right">
                        <span className={cn('num font-semibold', f.ocupacion > 1 && 'text-text')}>{pct(f.ocupacion)}</span>
                        {f.ocupacion > 1 && <span className="ml-1 text-[10px] font-semibold uppercase text-amarillo">sobreasignada</span>}
                        <ColorOcupacion ocupacion={f.ocupacion} tema={tema} />
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right">
                        <SalarioCelda f={f} semanal={semanal} />
                      </td>
                      <td className="num border-b border-border px-3 py-2.5 text-right">{gs(f.ingreso)}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right">
                        <DiferenciaCelda v={f.diferencia} max={maxDif} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <th scope="row" className="sticky bottom-0 left-0 z-20 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-left">
                      TOTAL
                    </th>
                    <td className="num sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">{r.total.alcanzables}</td>
                    <td className="sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">
                      <span className="num block">{num(r.total.unidades, 2)}</span>
                      <span className="num block text-[11px] font-normal text-muted">
                        {r.total.servicios} servicios · {num(r.total.horas, 1)} h
                      </span>
                    </td>
                    <td className="num sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">{pct(r.total.ocupacion)}</td>
                    <td className="num sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">{gs(r.total.salario)}</td>
                    <td className="num sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">{gs(r.total.ingreso)}</td>
                    <td className="sticky bottom-0 border-t-2 border-border bg-surface-2 px-3 py-2.5 text-right">
                      <DiferenciaCelda v={r.total.diferencia} max={0} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Teléfono: una tarjeta por operaria. */}
            <div className="space-y-3 md:hidden">
              <div className="flex items-center gap-2 text-xs text-muted">
                Ordenar por
                <Selector etiqueta="Ordenar por" value={orden.clave} onChange={(e) => setOrden({ clave: e.target.value as typeof orden.clave, asc: e.target.value === 'operaria' })} className="h-8 text-xs">
                  {COLUMNAS.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.titulo}
                    </option>
                  ))}
                </Selector>
              </div>
              {[...filas, null].map((f) => {
                const x = f ?? { operaria: 'TOTAL', fija: false, alcanzables: r.total.alcanzables, unidades: r.total.unidades, servicios: r.total.servicios, horas: r.total.horas, ocupacion: r.total.ocupacion ?? 0, salario: r.total.salario, ingreso: r.total.ingreso, diferencia: r.total.diferencia };
                return (
                  <Tarjeta key={x.operaria} className={cn('p-3.5 shadow-none', !f && 'bg-surface-2')}>
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate font-semibold">{x.operaria}</p>
                      {f?.fija && <Etiqueta tono="vivo">Sueldo fijo</Etiqueta>}
                      {f && <Advertencias f={f} />}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-sm">
                      <span className="text-muted">Ocupación</span>
                      <span className="num font-semibold">
                        {pct(x.ocupacion)} <span className="text-xs font-normal text-muted">({num(x.unidades, 2)} de {x.alcanzables})</span>
                      </span>
                    </div>
                    <ColorOcupacion ocupacion={x.ocupacion} tema={tema} />
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted">Servicios / horas</dt>
                      <dd className="num text-right">
                        {x.servicios} · {num(x.horas, 1)} h
                      </dd>
                      <dt className="text-muted">Salario</dt>
                      <dd className="text-right">{f ? <SalarioCelda f={f} semanal={semanal} /> : <span className="num">{gs(x.salario)}</span>}</dd>
                      <dt className="text-muted">Ingreso</dt>
                      <dd className="num text-right">{gs(x.ingreso)}</dd>
                      <dt className="text-muted">Diferencia</dt>
                      <dd className="text-right">
                        <DiferenciaCelda v={x.diferencia} max={f ? maxDif : 0} />
                      </dd>
                    </dl>
                  </Tarjeta>
                );
              })}
            </div>

            {r.sinAsignar > 0 && <p className="mt-3 text-xs text-muted">{r.sinAsignar} servicios del período no tienen operaria asignada y no figuran en ninguna fila.</p>}
          </Panel>
        </>
      )}
    </>
  );
}
