'use client';

import { useState } from 'react';
import { barra, base, Grafico, linea, usePaleta, type Opcion, type Paleta } from '@/components/chart';
import { useDatos } from '@/components/datos';
import { Kpi, Variacion } from '@/components/kpi';
import { cn, Etiqueta, Panel, Segmentos, TituloSeccion, Vacio } from '@/components/ui';
import type { Reporte } from '@/lib/csv';
import {
  comparacionAlDia,
  comparacionCerrados,
  costoPersonal,
  margenPorTipo,
  proyeccionCierre,
  puntoEquilibrio,
  rankingOperarias,
  ticketPorMes,
  TIPOS_PRECIO,
  top,
  type FilaComparacion,
} from '@/lib/engine/metrics-analisis';
import type { TipoCliente } from '@/lib/engine/types';
import { gs, gsCorto, mesCorto, mesLargo, num, pct, SIN_DATO } from '@/lib/format';
import { rComparacionAlDia, rComparacionCerrados, rCostoPersonal, rMargen, rProyeccion, rPuntoEquilibrio, rRankingClientes, rRankingOperarias, rTicket } from '@/lib/reportes';

/** Barras horizontales (rankings). `porSigno` pinta en alerta los valores negativos. */
function horizontales(p: Paleta, nombres: string[], valores: (number | null)[], formato: (v: number | null) => string, o: { nombre: string; formatoEje?: (v: number) => string; porSigno?: boolean }): Opcion {
  return {
    ...base(p, { categorias: nombres, horizontal: true, formatoEje: o.formatoEje, formatoValor: formato }),
    series: [
      barra(p, {
        name: o.nombre,
        barMaxWidth: 18,
        data: valores.map((v) => ({ value: v, itemStyle: { color: o.porSigno && (v ?? 0) < 0 ? p.alerta : p.series[0], borderRadius: (v ?? 0) < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: p.tenue, fontSize: 11, formatter: (x: { value: number | null }) => formato(x.value) },
      }),
    ],
  };
}

function Ranking({ titulo, reporte, columna, formato, formatoEje, info, acciones, porSigno }: { titulo: string; reporte: Reporte; columna: number; formato: (v: number | null) => string; formatoEje?: (v: number) => string; info: { formula: string; fuente: string; nota?: string }; acciones?: React.ReactNode; porSigno?: boolean }) {
  const p = usePaleta();
  const filas = reporte.filas.filter((f) => f[columna] !== null);
  return (
    <Panel titulo={titulo} subtitulo={reporte.periodo.replace('-', ' ')} reporte={reporte} info={info} acciones={acciones}>
      {filas.length ? (
        <Grafico
          alto={Math.max(160, filas.length * 30 + 24)}
          opcion={horizontales(p, filas.map((f) => String(f[0])), filas.map((f) => f[columna] as number), formato, { nombre: reporte.columnas[columna].titulo, formatoEje, porSigno })}
          descripcion={`${titulo}: ${filas.map((f) => `${f[0]} ${formato(f[columna] as number)}`).join('; ')}`}
        />
      ) : (
        <p className="py-8 text-center text-sm text-muted">Sin datos para este período.</p>
      )}
    </Panel>
  );
}

function TablaComparacion({ filas, etiquetas }: { filas: FilaComparacion[]; etiquetas: [string, string] }) {
  const f = (x: FilaComparacion, v: number | null) => (v === null ? SIN_DATO : x.tipo === 'gs' ? gs(v) : x.tipo === 'pct' ? pct(v) : num(v, 2));
  return (
    <div className="relative -mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 text-left font-semibold">Métrica</th>
            <th className="px-3 py-2 text-right font-semibold">{etiquetas[0]}</th>
            <th className="px-3 py-2 text-right font-semibold">{etiquetas[1]}</th>
            <th className="px-3 py-2 text-right font-semibold">Variación</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((x) => (
            <tr key={x.metrica} className="border-t border-border">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                {x.metrica}
              </th>
              <td className={cn('num whitespace-nowrap px-3 py-2 text-right', (x.actual ?? 0) < 0 && 'text-alerta')}>{f(x, x.actual)}</td>
              <td className="num whitespace-nowrap px-3 py-2 text-right text-muted">{f(x, x.anterior)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{x.variacion === null ? <span className="text-muted">—</span> : <Variacion fraccion={x.variacion} enPuntos={x.tipo === 'pct'} invertir={x.metrica.startsWith('Gasto')} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analisis() {
  const { dataset: d, mes, modoMargen, setModoMargen } = useDatos();
  const p = usePaleta();
  const [periodo, setPeriodo] = useState<'mes' | 'anio'>('mes');
  const [tipoEventual, setTipoEventual] = useState<TipoCliente>('Ocasional');
  if (!d || !mes) return null;

  const mesRanking = periodo === 'mes' ? mes : null;
  const selectorPeriodo = <Segmentos etiqueta="Período" valor={periodo} onCambio={setPeriodo} opciones={[{ valor: 'mes', texto: mesLargo(mes) }, { valor: 'anio', texto: 'Acumulado' }]} />;
  const fuenteServicios = 'Pestañas mensuales (tabla de servicios)';
  const categorias = d.operativo.map((m) => mesCorto(m.mes));

  const ticket = ticketPorMes(d);
  const opTicket = { ...base(p, { categorias, formatoEje: gsCorto, formatoValor: gs }), series: [linea({ name: 'Ticket promedio', data: ticket.meses.map((m) => m.ticket) })] };

  const margenes = d.operativo.map((m) => margenPorTipo(d, m.mes, modoMargen));
  const margenMes = margenes.find((m) => m.mes === mes);
  const tiposConDatos = TIPOS_PRECIO.filter((t) => margenes.some((m) => m.tipos.find((x) => x.tipo === t)!.servicios > 0));
  const opMargen = {
    ...base(p, { categorias, leyenda: true, formatoEje: gsCorto, formatoValor: gs }),
    series: tiposConDatos.map((t) => barra(p, { name: t === 'Sin clasificar' ? t : `Precio ${t.toLowerCase()}`, color: p.series[TIPOS_PRECIO.indexOf(t)], barMaxWidth: 12, barGap: '15%', data: margenes.map((m) => m.tipos.find((x) => x.tipo === t)!.margen) })),
  };

  const costo = costoPersonal(d);
  const opCosto = {
    ...base(p, { categorias: costo.meses.map((m) => mesCorto(m.mes) + (m.cerrado ? '' : '\nen curso')), formatoEje: (v) => `${Math.round(v * 100)} %`, formatoValor: pct }),
    series: [linea({ name: 'Costo de personal', data: costo.meses.map((m) => m.pct), color: p.series[1] })],
  };

  const proy = d.mesEnCurso === mes ? proyeccionCierre(d, mes) : null;
  const alDia = comparacionAlDia(d, mes);
  const cerr = comparacionCerrados(d);
  const pe = puntoEquilibrio(d);
  const opMes = d.operativo.find((m) => m.mes === mes);
  const estimado = <Etiqueta tono="estimado">Estimado</Etiqueta>;

  const ops = rankingOperarias(d, mesRanking);
  const repOps = rRankingOperarias(d, mesRanking);
  const porMargen: Reporte = { ...repOps, id: 'ranking-operarias-margen', titulo: 'Ranking de operarias por margen', filas: top(ops.filter((o) => o.margen !== null), (o) => o.margen!, 100).map((o) => [o.operaria, o.unidades, o.servicios, o.facturado, o.cobrado, o.margen]) };

  const avancePe = pe.servicios && opMes ? opMes.realizados / pe.servicios : null;
  const opGauge = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: Math.max(1.5, Math.ceil((avancePe ?? 0) * 10) / 10),
        radius: '100%',
        center: ['50%', '62%'],
        progress: { show: true, width: 14, itemStyle: { color: (avancePe ?? 0) >= 1 ? p.series[1] : p.series[0] } },
        axisLine: { lineStyle: { width: 14, color: [[1, p.grilla]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: { valueAnimation: true, offsetCenter: [0, '-8%'], fontSize: 26, fontWeight: 900, color: p.texto, formatter: (v: number) => pct(v) },
        data: [{ value: avancePe ?? 0 }],
      },
    ],
  };

  return (
    <>
      <TituloSeccion nota={`${mesLargo(mes)} ${d.anio}`}>Análisis</TituloSeccion>

      {/* Ticket y costo de personal */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Ticket promedio por servicio" reporte={rTicket(d)} info={{ formula: 'Σ PRECIO FINAL (N) de servicios realizados con precio ÷ cantidad de esos servicios, por mes. El promedio es el de los meses cerrados.', fuente: `${fuenteServicios}, columna N` }}>
          <div className="mb-2 flex flex-wrap items-end gap-x-6 gap-y-1">
            <div>
              <p className="text-xs text-muted">Promedio de meses cerrados</p>
              <p className="num font-display text-3xl font-black">{gs(ticket.promedioCerrados)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{mesLargo(mes)}</p>
              <p className="num font-display text-xl font-extrabold">{gs(ticket.meses.find((m) => m.mes === mes)?.ticket ?? null)}</p>
            </div>
          </div>
          <Grafico alto={220} opcion={opTicket} descripcion={`Ticket promedio por mes: ${ticket.meses.map((m) => `${mesLargo(m.mes)} ${gs(m.ticket)}`).join('; ')}`} />
        </Panel>
        <Panel titulo="Costo de personal sobre facturación" reporte={rCostoPersonal(d)} info={{ formula: 'Gasto en personal (RECURSOS HUMANOS) ÷ Ingresos, por mes. El promedio es el de los meses cerrados.', fuente: 'GASTOS e INGRESOS (tablas de detalle)', nota: 'En el mes en curso los sueldos se cargan al cierre, por eso el valor suele verse bajo.' }}>
          <div className="mb-2">
            <p className="text-xs text-muted">Promedio de meses cerrados</p>
            <p className="num font-display text-3xl font-black">{pct(costo.promedioCerrados)}</p>
          </div>
          <Grafico alto={220} opcion={opCosto} descripcion={`Costo de personal sobre facturación: ${costo.meses.map((m) => `${mesLargo(m.mes)} ${pct(m.pct)}`).join('; ')}`} />
        </Panel>
      </div>

      {/* Margen por tipo de precio */}
      <Panel
        className="mt-4"
        titulo="Margen por tipo de precio"
        subtitulo={modoMargen === 'A' ? 'Modo A: a los servicios de operarias de sueldo fijo se les asigna la parte proporcional de su sueldo según las horas.' : 'Modo B: se excluyen los servicios de operarias de sueldo fijo.'}
        reporte={rMargen(d, modoMargen)}
        acciones={<Segmentos etiqueta="Modo de cálculo del margen" valor={modoMargen} onCambio={setModoMargen} opciones={[{ valor: 'A', texto: 'A · Con sueldo fijo' }, { valor: 'B', texto: 'B · Sin sueldo fijo' }]} />}
        info={{
          formula: 'Margen = Σ PRECIO FINAL (N) − costo, sobre servicios realizados con precio. Modo A: costo de un servicio de sueldo fijo = sueldo del mes × (horas del servicio ÷ horas realizadas por ella en el mes). Modo B: esos servicios no entran.',
          fuente: `${fuenteServicios}, columnas N, K, R y panel COMISION; tipo de precio con respaldo en BBDD CLIENTES`,
          nota: 'Si el sueldo fijo del mes todavía no está cargado, sus servicios quedan fuera aun en modo A.',
        }}
      >
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {margenMes?.tipos.map((t) => (
            <div key={t.tipo} className="rounded-2xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.series[TIPOS_PRECIO.indexOf(t.tipo)] }} />
                {t.tipo === 'Sin clasificar' ? t.tipo : `Precio ${t.tipo.toLowerCase()}`}
              </p>
              <p className={cn('num font-display text-xl font-black', t.margen < 0 && 'text-alerta')}>{t.servicios ? gs(t.margen) : SIN_DATO}</p>
              <p className="num text-xs text-muted">{t.servicios ? `${pct(t.pct)} · ${num(t.servicios)} servicios` : 'Sin servicios'}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted">
          {mesLargo(mes)}: {num(margenMes?.excluidosFijos ?? 0)} servicios de sueldo fijo fuera del cálculo · {num(margenMes?.sinPrecio ?? 0)} servicios sin precio.
        </p>
        <Grafico opcion={opMargen} descripcion={`Margen por tipo de precio y mes, modo ${modoMargen}`} />
      </Panel>

      {/* Proyección */}
      <TituloSeccion nota={proy ? `Día hábil ${proy.dias.transcurridos} de ${proy.dias.total} (lunes a sábado)` : undefined}>Proyección al cierre del mes</TituloSeccion>
      {proy ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi chico indice={0} titulo="Facturación agendada" valor={proy.facturacionAgendada} formato={gs} etiqueta={estimado} reporte={rProyeccion(d, mes)} info={{ formula: 'Σ PRECIO FINAL (N) de todos los servicios cargados del mes (realizados + agendados).', fuente: `${opMes?.pestana} (columna N)` }} />
          <Kpi chico indice={1} titulo="Facturación al ritmo actual" valor={proy.facturacionRitmo} formato={gs} etiqueta={estimado} info={{ formula: 'Σ N de realizados ÷ días hábiles transcurridos × días hábiles del mes (lunes a sábado).', fuente: `${opMes?.pestana} (columna N)` }} />
          <Kpi
            chico
            indice={2}
            titulo="Gasto proyectado"
            valor={proy.gasto.total}
            formato={gs}
            etiqueta={estimado}
            pie={`Pago por servicio ${gsCorto(proy.gasto.pagoServicios)} + sueldos fijos ${gsCorto(proy.gasto.sueldosFijos)} + otros ${gsCorto(proy.gasto.otros)}`}
            info={{ formula: 'Σ K de los servicios cargados + sueldos fijos del último mes cerrado + promedio de gastos no-RR. HH. de meses cerrados.', fuente: `${opMes?.pestana} (columna K), panel COMISION y GASTOS (detalle)` }}
          />
          <Kpi
            chico
            indice={3}
            titulo="Ganancia proyectada"
            valor={proy.gananciaAgendada}
            formato={gs}
            negativoEnAlerta
            etiqueta={estimado}
            pie={
              <>
                Al ritmo actual: <span className="num font-semibold text-text">{gs(proy.gananciaRitmo)}</span>
              </>
            }
            info={{ formula: 'Facturación agendada − gasto proyectado. Debajo, la misma cuenta con la facturación al ritmo actual.', fuente: 'Calculada a partir de las tres tarjetas anteriores' }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted">La proyección se calcula solo para el mes en curso. {mesLargo(mes)} ya cerró: sus valores reales están en Financiero.</p>
      )}

      {/* Comparación */}
      <TituloSeccion>Comparación vs mes anterior</TituloSeccion>
      <div className="grid gap-4 xl:grid-cols-2">
        {alDia && (
          <Panel
            titulo={d.mesEnCurso === mes ? `${mesLargo(mes)} al día ${alDia.dia} vs ${mesLargo(mes - 1)} al día ${alDia.dia}` : `${mesLargo(mes)} vs ${mesLargo(mes - 1)}`}
            reporte={rComparacionAlDia(d, mes) ?? undefined}
            info={{ formula: 'Servicios realizados, Σ PRECIO FINAL (N) y ticket, contando en ambos meses solo los servicios hasta el mismo día del mes.', fuente: fuenteServicios }}
          >
            <TablaComparacion filas={alDia.filas} etiquetas={[mesLargo(mes), mesLargo(mes - 1)]} />
          </Panel>
        )}
        {cerr && (
          <Panel titulo={`Último mes cerrado: ${mesLargo(cerr.mes)} vs ${mesLargo(cerr.mes - 1)}`} reporte={rComparacionCerrados(d) ?? undefined} info={{ formula: 'Mes cerrado completo contra el mes previo. En rentabilidad la variación es en puntos porcentuales.', fuente: 'INGRESOS y GASTOS (detalle) y pestañas mensuales' }}>
            <TablaComparacion filas={cerr.filas} etiquetas={[mesLargo(cerr.mes), mesLargo(cerr.mes - 1)]} />
          </Panel>
        )}
        {!alDia && !cerr && <Vacio titulo="Todavía no hay un mes anterior para comparar" />}
      </div>

      {/* Rankings */}
      <TituloSeccion nota="Solo servicios realizados · top 10">Rankings</TituloSeccion>
      <div className="mb-3">{selectorPeriodo}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Ranking titulo="Clientes por cantidad de servicios" reporte={rRankingClientes(d, mesRanking, 'servicios')} columna={1} formato={(v) => num(v)} info={{ formula: 'Cantidad de servicios realizados por cliente (nombres normalizados).', fuente: `${fuenteServicios}, columna C` }} />
        <Ranking titulo="Clientes por dinero" reporte={rRankingClientes(d, mesRanking, 'dinero')} columna={2} formato={gs} formatoEje={gsCorto} info={{ formula: 'Σ PRECIO FINAL (N) de servicios realizados por cliente.', fuente: `${fuenteServicios}, columnas C y N` }} />
        <Ranking titulo="Clientes semanales que más piden" reporte={rRankingClientes(d, mesRanking, 'servicios', 'Semanal')} columna={1} formato={(v) => num(v)} info={{ formula: 'Servicios realizados por cliente con TIPO CLIENTE = SEMANAL.', fuente: `${fuenteServicios}, columna S; respaldo en BBDD CLIENTES` }} />
        <Ranking
          titulo={`Clientes ${tipoEventual === 'Ocasional' ? 'ocasionales' : 'quincenales'} que más piden`}
          reporte={rRankingClientes(d, mesRanking, 'servicios', tipoEventual)}
          columna={1}
          formato={(v) => num(v)}
          acciones={<Segmentos etiqueta="Tipo de cliente" valor={tipoEventual} onCambio={setTipoEventual} opciones={[{ valor: 'Ocasional', texto: 'Ocasional' }, { valor: 'Quincenal', texto: 'Quincenal' }]} />}
          info={{ formula: `Servicios realizados por cliente con TIPO CLIENTE = ${tipoEventual.toUpperCase()}.`, fuente: `${fuenteServicios}, columna S; respaldo en BBDD CLIENTES` }}
        />
        <Ranking
          titulo="Operarias por servicios (unidades ponderadas)"
          reporte={{ ...repOps, filas: repOps.filas.slice(0, 12) }}
          columna={1}
          formato={(v) => num(v, 2)}
          info={{ formula: 'Unidades ponderadas realizadas (horas ÷ 4). El CSV incluye también la cantidad simple de servicios.', fuente: `${fuenteServicios}, columnas E y H` }}
        />
        <Ranking
          titulo="Operarias por margen"
          reporte={{ ...porMargen, filas: porMargen.filas.slice(0, 12) }}
          columna={5}
          formato={gs}
          formatoEje={gsCorto}
          porSigno
          info={{ formula: 'Σ PRECIO FINAL (N) de sus servicios realizados − lo que cobró (Σ K, o el total de sueldo fijo del mes).', fuente: `${fuenteServicios}, columnas N y K; panel COMISION`, nota: 'Una operaria de sueldo fijo sin total cargado en algún mes del período no figura.' }}
        />
      </div>

      {/* Punto de equilibrio */}
      <TituloSeccion nota="Con promedios de meses cerrados">Punto de equilibrio mensual</TituloSeccion>
      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi
          indice={0}
          titulo="Servicios para cubrir costos fijos"
          valor={pe.servicios}
          formato={(n) => num(n, 1)}
          reporte={rPuntoEquilibrio(d)}
          pie={
            <>
              Equivale a <span className="num font-semibold text-text">{gs(pe.facturacion)}</span> de facturación
            </>
          }
          info={{ formula: 'Costos fijos ÷ margen de contribución por servicio. Facturación de equilibrio = servicios × ticket promedio.', fuente: 'GASTOS (detalle), panel COMISION y pestañas mensuales' }}
        />
        <Panel titulo="Cómo se compone" reporte={rPuntoEquilibrio(d)} info={{ formula: 'Costos fijos = gastos no-RR. HH. (promedio de meses cerrados) + sueldos fijos del último mes cerrado. Margen de contribución = ticket promedio − pago promedio por servicio (solo operarias por servicio).', fuente: 'GASTOS (detalle), panel COMISION y pestañas mensuales' }}>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Otros gastos (promedio)', gs(pe.otrosGastos)],
              ['Sueldos fijos', gs(pe.sueldosFijos)],
              ['Costos fijos', gs(pe.costosFijos)],
              ['Ticket promedio', gs(pe.ticket)],
              ['Pago promedio por servicio', gs(pe.pagoPromedio)],
              ['Margen de contribución', gs(pe.margenContribucion)],
            ].map(([k, v], i) => (
              <div key={k} className={cn('flex justify-between gap-3', (i === 2 || i === 5) && 'border-t border-border pt-1.5 font-semibold')}>
                <dt className="text-muted">{k}</dt>
                <dd className="num whitespace-nowrap">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel titulo={`Servicios de ${mesLargo(mes)} vs punto de equilibrio`} info={{ formula: 'Servicios realizados del mes ÷ servicios del punto de equilibrio.', fuente: `${opMes?.pestana ?? ''} y cálculo del punto de equilibrio` }}>
          {avancePe !== null ? (
            <>
              <Grafico alto={170} opcion={opGauge} descripcion={`${num(opMes?.realizados ?? 0)} servicios realizados sobre ${num(pe.servicios, 1)} del punto de equilibrio: ${pct(avancePe)}`} />
              <p className="num -mt-4 text-center text-sm text-muted">
                {num(opMes?.realizados ?? 0)} realizados de {num(pe.servicios, 1)} necesarios
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted">{SIN_DATO}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
