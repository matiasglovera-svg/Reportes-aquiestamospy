'use client';

import { useState } from 'react';
import { base, Grafico, linea, usePaleta } from '@/components/chart';
import { useDatos } from '@/components/datos';
import { MapaCalor } from '@/components/heatmap';
import { Kpi, Variacion } from '@/components/kpi';
import { Tabla } from '@/components/tabla';
import { Etiqueta, Panel, Segmentos, Selector, Tarjeta, TituloSeccion } from '@/components/ui';
import { CAPACIDAD_MENSUAL, CAPACIDAD_SEMANAL } from '@/config/staff';
import { mesCorto, mesLargo, num } from '@/lib/format';
import { ETIQUETA_SUELDO_FIJO, ocupacion, rHorasOperaria, rOcupacion, rSalarioMes, rSalarioSemana, rServiciosMes, rServiciosSemana } from '@/lib/reportes';

export default function Operativo() {
  const { dataset: d, mes, conAgendados, setConAgendados } = useDatos();
  const p = usePaleta();
  const [operaria, setOperaria] = useState('');
  const [vistaCalor, setVistaCalor] = useState<'mes' | 'anio'>('mes');
  if (!d || !mes) return null;

  const op = d.operativo.find((m) => m.mes === mes);
  const previo = d.operativo.find((m) => m.mes === mes - 1);
  const pestana = op?.pestana ?? mesLargo(mes).toUpperCase();
  const cerrados = d.operativo.filter((m) => m.cerrado);
  const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const nombres = [...new Set(d.operativo.flatMap((m) => m.operarias.map((o) => o.operaria)))].filter((n) => n !== 'Sin asignar').sort((a, b) => a.localeCompare(b, 'es'));
  const sola = operaria || undefined;
  const fuenteTabla = 'Pestañas mensuales (tabla de servicios, columnas A–U)';

  const categorias = d.operativo.map((m) => mesCorto(m.mes) + (m.enCurso ? '\nen curso' : ''));
  const opServicios = {
    ...base(p, { categorias, leyenda: true, formatoValor: (v) => num(v, 2) }),
    series: [
      linea({ name: conAgendados ? 'Servicios (con agendados)' : 'Servicios realizados', data: d.operativo.map((m) => (conAgendados ? m.cargados : m.realizados)) }),
      linea({ name: 'Unidades ponderadas', data: d.operativo.map((m) => (conAgendados ? m.unidadesCargadas : m.unidades)), lineStyle: { width: 2, type: 'dashed' } }),
    ],
  };

  const semanal = rServiciosSemana(d, conAgendados);
  const horas = rHorasOperaria(d, mes, conAgendados);
  const filasHoras = horas.filas.filter((f) => (!sola || f[0] === sola) && ((f[1] as number) > 0 || (f[2] as number | null)));
  const salarioSemana = rSalarioSemana(d, mes, sola);

  return (
    <>
      <TituloSeccion nota={`${mesLargo(mes)}${op?.enCurso ? ' · mes en curso' : ''}`}>Operativo</TituloSeccion>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Selector etiqueta="Operaria" value={operaria} onChange={(e) => setOperaria(e.target.value)}>
          <option value="">Todas las operarias</option>
          {nombres.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Selector>
        <Segmentos etiqueta="Servicios a considerar" valor={conAgendados ? 'todos' : 'realizados'} onCambio={(v) => setConAgendados(v === 'todos')} opciones={[{ valor: 'realizados', texto: 'Realizados' }, { valor: 'todos', texto: 'Incluir agendados' }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Kpi
            indice={0}
            titulo="Servicios por mes en promedio"
            valor={promedio(cerrados.map((m) => m.realizados))}
            formato={(n) => num(n, 1)}
            serie={cerrados.map((m) => m.realizados)}
            reporte={rServiciosMes(d)}
            pie={
              <>
                Promedio de {cerrados.length} meses cerrados · <span className="num font-semibold text-text">{num(promedio(cerrados.map((m) => m.unidades)), 1)}</span> unidades ponderadas
              </>
            }
            info={{ formula: 'Promedio simple de servicios realizados por mes, sobre meses cerrados. Unidades ponderadas = horas ÷ 4 (4 h = 1; 6 h = 1,5; 8 h = 2).', fuente: fuenteTabla }}
          />
          <Kpi
            indice={1}
            titulo={`Servicios de ${mesLargo(mes)}`}
            valor={op ? (conAgendados ? op.cargados : op.realizados) : null}
            formato={(n) => num(n)}
            etiqueta={op?.enCurso ? <Etiqueta tono="vivo">En vivo</Etiqueta> : undefined}
            variacion={op?.enCurso || !previo || !op ? undefined : { fraccion: previo.realizados ? (op.realizados - previo.realizados) / previo.realizados : null, etiqueta: 'vs mes anterior' }}
            pie={op && `${num(op.realizados)} realizados · ${num(op.agendados)} agendados · ${num(conAgendados ? op.horasCargadas : op.horas, 1)} h`}
            info={{ formula: 'Filas con cliente en la pestaña del mes. Realizado = fecha ≤ hoy; con fecha futura es agendado.', fuente: `${pestana} (tabla de servicios)` }}
          />
        </div>
        <Panel className="lg:col-span-2" titulo="Cantidad de servicios por mes" reporte={rServiciosMes(d)} info={{ formula: 'Servicios realizados por mes y sus unidades ponderadas (horas ÷ 4), en el mismo eje.', fuente: fuenteTabla }}>
          <Grafico opcion={opServicios} descripcion={`Servicios por mes: ${d.operativo.map((m) => `${mesLargo(m.mes)} ${m.realizados} realizados, ${num(m.unidades, 2)} unidades`).join('; ')}`} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel titulo="Servicios por semana" reporte={semanal} info={{ formula: 'Servicios por bloque SEMANA n de cada pestaña (los 4 bloques tal como están en la planilla, no semanas de calendario).', fuente: fuenteTabla }}>
          <Tabla reporte={semanal} barras={[1, 2, 3, 4]} resaltarFila={(f) => String(f[0]).startsWith(mesLargo(mes))} />
        </Panel>
        <Panel
          titulo="Ocupación por operaria"
          subtitulo={vistaCalor === 'mes' ? `${mesLargo(mes)} · capacidad ${CAPACIDAD_SEMANAL} unidades por semana` : `Año ${d.anio} · capacidad ${CAPACIDAD_MENSUAL} unidades por mes`}
          reporte={rOcupacion(d, vistaCalor === 'mes' ? mes : null, conAgendados, sola)}
          acciones={<Segmentos etiqueta="Vista de ocupación" valor={vistaCalor} onCambio={setVistaCalor} opciones={[{ valor: 'mes', texto: 'Semanas' }, { valor: 'anio', texto: 'Año' }]} />}
          info={{ formula: `Unidades ponderadas ÷ capacidad (${CAPACIDAD_SEMANAL} por semana, ${CAPACIDAD_MENSUAL} por mes). Más de 100 % es sobreasignación.`, fuente: fuenteTabla }}
        >
          <MapaCalor datos={ocupacion(d, vistaCalor === 'mes' ? mes : null, conAgendados, sola)} />
        </Panel>
      </div>

      <TituloSeccion nota={`${mesLargo(mes)} · incluye servicios agendados del mes`}>Salarios</TituloSeccion>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          titulo="Salario por mes de las operarias"
          reporte={rSalarioMes(d, mes, sola)}
          info={{ formula: 'Por servicio: Σ SALARIO (I), Σ MOVILIDAD (J) y Σ TOTAL (K) de sus servicios del mes. Sueldo fijo: su fila del panel (Salario + Movilidad = Total). Gs/hora = Total ÷ horas.', fuente: `${pestana} (columnas I, J, K y panel PERSONAL DE LIMPIEZA (COMISION))`, nota: 'Un sueldo fijo todavía no cargado en el panel se muestra como "Sin dato".' }}
        >
          <Tabla reporte={rSalarioMes(d, mes, sola)} maxAlto={420} celda={(v, col) => (col === 1 && v === 'Sueldo fijo' ? <Etiqueta tono="estimado">Sueldo fijo</Etiqueta> : undefined)} />
        </Panel>
        <Panel titulo="Salario por semana de las operarias" reporte={salarioSemana} info={{ formula: 'Σ I, J y K por bloque semanal. El sueldo fijo no se prorratea por semana: el monto figura solo en la vista mensual.', fuente: `${pestana} (columnas I, J, K)` }}>
          <Tabla reporte={salarioSemana} maxAlto={420} celda={(v, col, fila) => (fila[6] === ETIQUETA_SUELDO_FIJO && col >= 3 && col <= 5 ? '—' : undefined)} />
        </Panel>
      </div>

      <Panel
        className="mt-4"
        titulo="Horas trabajadas por operaria"
        subtitulo={`${mesLargo(mes)} · barras: semanas 1 a 4`}
        reporte={horas}
        info={{ formula: 'Σ de horas de sus servicios del mes (columna HORAS TRABAJADAS; si falta, se calculan desde el HORARIO). Variación contra las horas realizadas del mes anterior.', fuente: `${pestana} (columnas E y F)` }}
      >
      {filasHoras.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filasHoras.map((f) => {
            const [nombre, h, antes, ...semanas] = f as [string, number, number | null, ...number[]];
            const max = Math.max(1, ...semanas);
            return (
              <Tarjeta key={nombre} className="p-3.5 shadow-none">
                <p className="truncate text-sm font-medium text-muted">{nombre}</p>
                <p className="num font-display text-2xl font-black leading-tight">
                  {num(h, 1)} <span className="text-sm font-bold text-muted">h</span>
                </p>
                <div className="mt-1 min-h-4">{op?.enCurso ? <span className="text-xs text-muted">Mes en curso</span> : antes ? <Variacion fraccion={(h - antes) / antes} etiqueta="vs mes ant." /> : <span className="text-xs text-muted">Sin mes anterior</span>}</div>
                <div className="mt-2 flex h-8 items-end gap-1" role="img" aria-label={`Horas por semana: ${semanas.map((s, i) => `semana ${i + 1}, ${num(s, 1)}`).join('; ')}`}>
                  {semanas.map((s, i) => (
                    <span key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(s > 0 ? 8 : 2, (s / max) * 100)}%`, opacity: s > 0 ? 1 : 0.25 }} title={`Semana ${i + 1}: ${num(s, 1)} h`} />
                  ))}
                </div>
              </Tarjeta>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Sin horas cargadas para este período.</p>
      )}
      </Panel>
    </>
  );
}
