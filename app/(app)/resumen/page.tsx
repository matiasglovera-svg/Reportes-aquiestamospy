'use client';

import { useMemo } from 'react';
import { barra, base, Grafico, linea, usePaleta } from '@/components/chart';
import { useDatos } from '@/components/datos';
import { Kpi } from '@/components/kpi';
import { Etiqueta, Panel, TituloSeccion } from '@/components/ui';
import { calcularResumen } from '@/lib/engine/metrics-resumen';
import { gs, gsCorto, mesLargo, num, pct } from '@/lib/format';
import { rResumen, rResumenSemanas } from '@/lib/reportes';

export default function Resumen() {
  const { dataset: d, mes } = useDatos();
  const p = usePaleta();
  const r = useMemo(() => (d && mes ? calcularResumen(d, mes) : null), [d, mes]);
  if (!d || !mes || !r) return null;

  const fin = d.financiero;
  const previo = fin.meses[mes - 2];
  const pestana = d.operativo.find((m) => m.mes === mes)?.pestana ?? mesLargo(mes).toUpperCase();
  const vivo = r.enCurso ? <Etiqueta tono="vivo">En vivo</Etiqueta> : undefined;
  const reporte = rResumen(d, mes);
  const reporteSemanas = rResumenSemanas(d, mes);
  const avance = r.facturacion !== null && r.promedioCerrados ? r.facturacion / r.promedioCerrados : null;
  const semanas = r.semanas.map((s) => `Semana ${s.semana}`);
  const variar = (a: number | null, b: number | null | undefined) => (a !== null && b ? (a - b) / Math.abs(b) : null);

  const opServicios = {
    ...base(p, { categorias: semanas, leyenda: true, formatoValor: (v) => num(v) }),
    series: [barra(p, { name: 'Realizado', stack: 's', data: r.semanas.map((s) => s.realizados), itemStyle: { borderRadius: 0, borderColor: p.superficie, borderWidth: 1 } }), barra(p, { name: 'Agendado', stack: 's', data: r.semanas.map((s) => s.agendados), itemStyle: { color: p.atenuado, borderColor: p.superficie, borderWidth: 1, borderRadius: [4, 4, 0, 0] } })],
  };

  // La línea es sólida hasta la última semana ya realizada y punteada de ahí en adelante.
  const corte = r.semanas.findIndex((s) => s.estimada);
  const solida = r.semanas.map((s, i) => (corte === -1 || i < corte ? s.proyeccion : null));
  const punteada = r.semanas.map((s, i) => (corte !== -1 && i >= Math.max(0, corte - 1) ? s.proyeccion : null));
  const opProyeccion = {
    ...base(p, { categorias: semanas, leyenda: corte !== -1, formatoEje: gsCorto, formatoValor: gs }),
    series: [linea({ name: 'Realizado', data: solida, color: p.series[0] }), ...(corte !== -1 ? [linea({ name: 'Estimado', data: punteada, color: p.series[0], lineStyle: { width: 2, type: 'dashed', color: p.series[0] }, itemStyle: { color: p.superficie, borderColor: p.series[0], borderWidth: 2 } })] : [])],
  };

  return (
    <>
      <TituloSeccion nota={r.enCurso ? 'En vivo · mes en curso' : 'Mes cerrado'}>Resumen de {mesLargo(mes)}</TituloSeccion>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          indice={0}
          titulo="Facturación del mes"
          valor={r.facturacion}
          formato={gs}
          etiqueta={vivo}
          reporte={reporte}
          serie={fin.meses.slice(0, mes).map((m) => m.ingresos)}
          info={{ formula: 'Σ de la columna VALOR del bloque del mes. Es lo efectivamente cobrado.', fuente: fin.meses[mes - 1].fuente.ingresos ?? 'INGRESOS (detalle del mes)' }}
          pie={
            avance !== null && (
              <div>
                <div className="mb-1 flex justify-between">
                  <span>vs promedio de meses cerrados ({gs(r.promedioCerrados)})</span>
                  <span className="num font-semibold text-text">{pct(avance)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(avance * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance contra el promedio">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.min(100, avance * 100)}%` }} />
                </div>
              </div>
            )
          }
        />
        <Kpi
          indice={1}
          titulo="Gasto en personal del mes"
          valor={r.rrhh}
          formato={gs}
          etiqueta={vivo}
          serie={fin.meses.slice(0, mes).map((m) => m.rrhh)}
          variacion={r.enCurso ? undefined : { fraccion: variar(r.rrhh, previo?.rrhh), etiqueta: 'vs mes anterior', invertir: true }}
          info={{ formula: 'Σ de VALOR de las filas con concepto RECURSOS HUMANOS (incluye adelantos).', fuente: fin.meses[mes - 1].fuente.gastos ?? 'GASTOS (detalle del mes)', nota: r.enCurso ? 'Los sueldos se cargan al cierre: durante el mes este valor suele estar incompleto.' : undefined }}
        />
        <Kpi
          indice={2}
          titulo="Caja chica"
          valor={r.cajaChica.valor}
          formato={gs}
          etiqueta={vivo}
          negativoEnAlerta
          info={{ formula: 'Celda numérica 2 filas debajo del título CAJA CHICA INICIAL MES. Si falta, CAJA AL CIERRE del mes.', fuente: r.cajaChica.fuente }}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Servicios de limpieza del mes"
          subtitulo={
            <>
              <span className="num font-semibold text-text">{num(r.realizados)}</span> realizados · <span className="num">{num(r.agendados)}</span> agendados
            </>
          }
          reporte={reporteSemanas}
          info={{ formula: 'Filas con cliente en la pestaña del mes, por bloque SEMANA n. Realizado = fecha ≤ hoy; agendado = fecha futura.', fuente: `${pestana} (tabla de servicios)` }}
        >
          <Grafico opcion={opServicios} descripcion={`Servicios por semana de ${mesLargo(mes)}: ${r.semanas.map((s) => `semana ${s.semana}, ${s.realizados} realizados y ${s.agendados} agendados`).join('; ')}`} />
        </Panel>
        <Panel
          titulo="Proyección de ganancia por semana"
          subtitulo="No incluye sueldos fijos ni otros gastos."
          reporte={reporteSemanas}
          info={{ formula: 'Por bloque semanal: Σ PRECIO FINAL (N) − Σ TOTAL pagado a la operaria (K), sobre todos los servicios cargados.', fuente: `${pestana} (columnas N y K)`, nota: 'Las semanas con servicios todavía agendados se muestran como estimado.' }}
        >
          <Grafico opcion={opProyeccion} descripcion={`Proyección de ganancia por semana: ${r.semanas.map((s) => `semana ${s.semana}, ${gs(s.proyeccion)}${s.estimada ? ' estimado' : ''}`).join('; ')}`} />
        </Panel>
      </div>

      <TituloSeccion nota="Servicios ya realizados del mes">Pendientes</TituloSeccion>
      <div className="grid gap-4 sm:grid-cols-2">
        <Kpi
          chico
          indice={3}
          titulo="Por cobrar a clientes"
          valor={r.porCobrar}
          formato={gs}
          pie={`${num(r.serviciosPorCobrar)} servicios sin marcar como pagados. Es de referencia: hay clientes que pagan a fin de mes.`}
          info={{ formula: 'Σ PRECIO FINAL (N) de servicios realizados con STATUS PAGO (D) sin tilde.', fuente: `${pestana} (columnas D y N)` }}
        />
        <Kpi
          chico
          indice={4}
          titulo="Por pagar a personal"
          valor={r.porPagar}
          formato={gs}
          pie={`${num(r.serviciosPorPagar)} servicios sin marcar como abonados. Es de referencia: algunas operarias cobran por semana o por mes.`}
          info={{ formula: 'Σ TOTAL (K) de servicios realizados con STATUS PROFESIONALES (G) sin tilde.', fuente: `${pestana} (columnas G y K)`, nota: 'No incluye los sueldos fijos.' }}
        />
      </div>
    </>
  );
}
