import { CAPACIDAD_MENSUAL, CAPACIDAD_SEMANAL } from '@/config/staff';
import type { Reporte, Valor } from './csv';
import {
  comparacionAlDia,
  comparacionCerrados,
  costoPersonal,
  margenPorTipo,
  proyeccionCierre,
  puntoEquilibrio,
  rankingClientes,
  rankingOperarias,
  ticketPorMes,
  top,
  type FilaComparacion,
  type ModoMargen,
} from './engine/metrics-analisis';
import { calcularResumen } from './engine/metrics-resumen';
import type { Dataset, OpMes, TipoCliente } from './engine/types';
import { mesCorto, mesLargo } from './format';

/**
 * Cada reporte de la app como tabla. Las tablas en pantalla y los CSV salen de estas mismas funciones,
 * así lo exportado es exactamente lo mostrado.
 */

const estado = (m: { cerrado: boolean; enCurso: boolean }) => (m.enCurso ? 'En curso' : m.cerrado ? 'Cerrado' : 'Futuro');
const pAnio = (d: Dataset) => String(d.anio);
const pMes = (d: Dataset, mes: number) => `${mesLargo(mes)}-${d.anio}`;
const opMes = (d: Dataset, mes: number): OpMes | undefined => d.operativo.find((m) => m.mes === mes);

// ───────────────────────── Resumen ─────────────────────────

export function rResumen(d: Dataset, mes: number): Reporte {
  const r = calcularResumen(d, mes);
  return {
    id: 'resumen-mes',
    titulo: 'Resumen del mes',
    periodo: pMes(d, mes),
    columnas: [
      { titulo: 'Indicador', tipo: 'texto' },
      { titulo: 'Valor', tipo: 'gs' },
    ],
    filas: [
      ['Facturación del mes', r.facturacion],
      ['Promedio de facturación (meses cerrados)', r.promedioCerrados],
      ['Gasto en personal del mes', r.rrhh],
      ['Caja chica', r.cajaChica.valor],
      ['Servicios realizados', r.realizados],
      ['Servicios agendados', r.agendados],
      ['Por cobrar a clientes', r.porCobrar],
      ['Por pagar a personal', r.porPagar],
    ],
  };
}

export function rResumenSemanas(d: Dataset, mes: number): Reporte {
  const r = calcularResumen(d, mes);
  return {
    id: 'resumen-semanas',
    titulo: 'Servicios y proyección por semana',
    periodo: pMes(d, mes),
    columnas: [
      { titulo: 'Semana', tipo: 'texto' },
      { titulo: 'Realizados', tipo: 'num' },
      { titulo: 'Agendados', tipo: 'num' },
      { titulo: 'Proyección de ganancia', tipo: 'gs' },
      { titulo: 'Tipo', tipo: 'texto' },
    ],
    filas: r.semanas.map((s) => [`Semana ${s.semana}`, s.realizados, s.agendados, s.proyeccion, s.estimada ? 'Estimado' : 'Realizado']),
  };
}

// ───────────────────────── Financiero ─────────────────────────

export function rFinancieroMensual(d: Dataset): Reporte {
  return {
    id: 'financiero-mensual',
    titulo: 'Financiero por mes',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Estado', tipo: 'texto' },
      { titulo: 'Ingresos', tipo: 'gs' },
      { titulo: 'Gastos', tipo: 'gs' },
      { titulo: 'Gasto en personal', tipo: 'gs' },
      { titulo: 'Ganancia', tipo: 'gs' },
      { titulo: 'Ganancia bruta', tipo: 'gs' },
      { titulo: 'Rentabilidad', tipo: 'pct' },
    ],
    filas: d.financiero.meses
      .filter((m) => m.ingresos !== null || m.gastos !== null)
      .map((m) => [mesLargo(m.mes), estado(m), m.ingresos, m.gastos, m.rrhh, m.ganancia, m.gananciaBruta, m.rentabilidad]),
  };
}

/** Categorías de gasto presentes en el año, de mayor a menor. */
export function categoriasDelAnio(d: Dataset): string[] {
  const totales = new Map<string, number>();
  for (const m of d.financiero.meses) for (const c of m.categorias) totales.set(c.categoria, (totales.get(c.categoria) ?? 0) + c.valor);
  return [...totales].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function rGastosCategoria(d: Dataset): Reporte {
  const cats = categoriasDelAnio(d);
  return {
    id: 'gastos-categoria',
    titulo: 'Gastos por categoría',
    periodo: pAnio(d),
    columnas: [{ titulo: 'Mes', tipo: 'texto' }, { titulo: 'Estado', tipo: 'texto' }, ...cats.map((c) => ({ titulo: c, tipo: 'gs' as const })), { titulo: 'Total', tipo: 'gs' }],
    filas: d.financiero.meses
      .filter((m) => m.gastos !== null)
      .map((m) => [mesLargo(m.mes), estado(m), ...cats.map((c) => m.categorias.find((x) => x.categoria === c)?.valor ?? null), m.gastos]),
  };
}

export function rFlujo(d: Dataset): Reporte {
  return {
    id: 'flujo-caja',
    titulo: 'Flujo de caja',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Caja inicial', tipo: 'gs' },
      { titulo: 'Ingresos', tipo: 'gs' },
      { titulo: 'Gastos', tipo: 'gs' },
      { titulo: 'Ganancia', tipo: 'gs' },
      { titulo: 'Caja al cierre', tipo: 'gs' },
    ],
    filas: d.financiero.meses
      .filter((m) => m.ingresos !== null || m.gastos !== null)
      .map((m) => [mesLargo(m.mes) + (m.enCurso ? ' (en curso)' : ''), m.cajaInicial, m.ingresos, m.gastos, m.ganancia, m.cajaCierre]),
  };
}

export function rFinancieroTotales(d: Dataset): Reporte {
  const f = d.financiero;
  const fila = (nombre: string, a: typeof f.ingresos): Valor[] => [nombre, a.promedio, a.total, a.acumulado];
  return {
    id: 'financiero-totales',
    titulo: 'Promedios y totales',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Concepto', tipo: 'texto' },
      { titulo: 'Promedio (meses cerrados)', tipo: 'gs' },
      { titulo: 'Total (meses cerrados)', tipo: 'gs' },
      { titulo: 'Acumulado incl. mes en curso', tipo: 'gs' },
    ],
    filas: [fila('Facturación', f.ingresos), fila('Gastos', f.gastos), fila('Gasto en personal', f.rrhh), fila('Ganancia', f.ganancia), fila('Ganancia bruta', f.gananciaBruta)],
  };
}

// ───────────────────────── Operativo ─────────────────────────

export function rServiciosMes(d: Dataset): Reporte {
  return {
    id: 'servicios-mes',
    titulo: 'Servicios por mes',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Estado', tipo: 'texto' },
      { titulo: 'Realizados', tipo: 'num' },
      { titulo: 'Agendados', tipo: 'num' },
      { titulo: 'Unidades ponderadas', tipo: 'num' },
      { titulo: 'Horas', tipo: 'num' },
    ],
    filas: d.operativo.map((m) => [mesLargo(m.mes), estado(m), m.realizados, m.agendados, m.unidades, m.horas]),
  };
}

export function rServiciosSemana(d: Dataset, conAgendados: boolean): Reporte {
  const n = (s: { realizados: number; cargados: number }) => (conAgendados ? s.cargados : s.realizados);
  return {
    id: 'servicios-semana',
    titulo: conAgendados ? 'Servicios por semana (con agendados)' : 'Servicios por semana',
    periodo: pAnio(d),
    columnas: [{ titulo: 'Mes', tipo: 'texto' }, ...[1, 2, 3, 4].map((s) => ({ titulo: `Semana ${s}`, tipo: 'num' as const })), { titulo: 'Total', tipo: 'num' }],
    filas: d.operativo.map((m) => [mesLargo(m.mes) + (m.enCurso ? ' (en curso)' : ''), ...[1, 2, 3, 4].map((s) => n(m.semanas.find((x) => x.semana === s) ?? { realizados: 0, cargados: 0 })), n(m)]),
  };
}

export interface CeldaOcupacion {
  unidades: number;
  horas: number;
  capacidad: number;
  /** unidades ÷ capacidad. */
  ocupacion: number;
}

export interface Ocupacion {
  columnas: string[];
  filas: { operaria: string; celdas: CeldaOcupacion[] }[];
}

/** Ocupación por operaria: semanas del mes (capacidad 12) o meses del año (capacidad 48). */
export function ocupacion(d: Dataset, mes: number | null, conAgendados: boolean, soloOperaria?: string): Ocupacion {
  const u = (t: { unidades: number; unidadesCargadas: number; horas: number; horasCargadas: number }, capacidad: number): CeldaOcupacion => {
    const unidades = conAgendados ? t.unidadesCargadas : t.unidades;
    return { unidades, horas: conAgendados ? t.horasCargadas : t.horas, capacidad, ocupacion: unidades / capacidad };
  };
  const cero = { unidades: 0, unidadesCargadas: 0, horas: 0, horasCargadas: 0 };
  const incluir = (nombre: string) => nombre !== 'Sin asignar' && (!soloOperaria || nombre === soloOperaria);

  if (mes !== null) {
    const m = opMes(d, mes);
    return {
      columnas: [1, 2, 3, 4].map((s) => `Semana ${s}`),
      filas: (m?.operarias ?? [])
        .filter((o) => incluir(o.operaria))
        .map((o) => ({ operaria: o.operaria, celdas: [1, 2, 3, 4].map((s) => u(o.semanas.find((x) => x.semana === s) ?? cero, CAPACIDAD_SEMANAL)) })),
    };
  }
  const nombres = [...new Set(d.operativo.flatMap((m) => m.operarias.map((o) => o.operaria)))].filter(incluir);
  const filas = nombres.map((operaria) => ({
    operaria,
    celdas: d.operativo.map((m) => u(m.operarias.find((o) => o.operaria === operaria) ?? cero, CAPACIDAD_MENSUAL)),
  }));
  filas.sort((a, b) => b.celdas.reduce((x, c) => x + c.unidades, 0) - a.celdas.reduce((x, c) => x + c.unidades, 0));
  return { columnas: d.operativo.map((m) => mesCorto(m.mes)), filas };
}

export function rOcupacion(d: Dataset, mes: number | null, conAgendados: boolean, soloOperaria?: string): Reporte {
  const o = ocupacion(d, mes, conAgendados, soloOperaria);
  return {
    id: 'ocupacion',
    titulo: 'Ocupación por operaria',
    periodo: mes !== null ? pMes(d, mes) : pAnio(d),
    columnas: [{ titulo: 'Operaria', tipo: 'texto' }, ...o.columnas.flatMap((c) => [{ titulo: `${c} unidades`, tipo: 'num' as const }, { titulo: `${c} ocupación`, tipo: 'pct' as const }])],
    filas: o.filas.map((f) => [f.operaria, ...f.celdas.flatMap((c) => [c.unidades, c.ocupacion])]),
  };
}

export function rSalarioMes(d: Dataset, mes: number, soloOperaria?: string): Reporte {
  const m = opMes(d, mes);
  return {
    id: 'salario-mes',
    titulo: 'Salario por mes de las operarias',
    periodo: pMes(d, mes),
    columnas: [
      { titulo: 'Operaria', tipo: 'texto' },
      { titulo: 'Modalidad', tipo: 'texto' },
      { titulo: 'Salario', tipo: 'gs' },
      { titulo: 'Movilidad', tipo: 'gs' },
      { titulo: 'Total', tipo: 'gs' },
      { titulo: 'Servicios', tipo: 'num' },
      { titulo: 'Horas', tipo: 'num' },
      { titulo: 'Gs/hora', tipo: 'gs' },
    ],
    filas: (m?.operarias ?? [])
      .filter((o) => !soloOperaria || o.operaria === soloOperaria)
      .map((o) => [o.operaria, o.modalidad, o.salarioMes, o.movilidadMes, o.totalMes, o.cargados, o.horasCargadas, o.gsPorHora]),
  };
}

export const ETIQUETA_SUELDO_FIJO = 'Sueldo fijo · se abona al cierre de mes';

export function rSalarioSemana(d: Dataset, mes: number, soloOperaria?: string): Reporte {
  const m = opMes(d, mes);
  const filas: Valor[][] = [];
  for (const o of (m?.operarias ?? []).filter((x) => !soloOperaria || x.operaria === soloOperaria)) {
    for (const s of o.semanas) {
      if (!s.cargados) continue;
      // El sueldo fijo no se prorratea por semana: el monto queda solo en la vista mensual.
      const fijo = o.modalidad === 'Sueldo fijo';
      filas.push([o.operaria, `Semana ${s.semana}`, s.cargados, fijo ? null : s.salario, fijo ? null : s.movilidad, fijo ? null : s.pagoCargado, fijo ? ETIQUETA_SUELDO_FIJO : '']);
    }
  }
  return {
    id: 'salario-semana',
    titulo: 'Salario por semana de las operarias',
    periodo: pMes(d, mes),
    columnas: [
      { titulo: 'Operaria', tipo: 'texto' },
      { titulo: 'Semana', tipo: 'texto' },
      { titulo: 'Servicios', tipo: 'num' },
      { titulo: 'Salario', tipo: 'gs' },
      { titulo: 'Movilidad', tipo: 'gs' },
      { titulo: 'Total', tipo: 'gs' },
      { titulo: 'Nota', tipo: 'texto' },
    ],
    filas,
  };
}

export function rHorasOperaria(d: Dataset, mes: number, conAgendados: boolean): Reporte {
  const m = opMes(d, mes);
  const previo = opMes(d, mes - 1);
  const h = (o: { horas: number; horasCargadas: number }) => (conAgendados ? o.horasCargadas : o.horas);
  return {
    id: 'horas-operaria',
    titulo: 'Horas trabajadas por operaria',
    periodo: pMes(d, mes),
    columnas: [{ titulo: 'Operaria', tipo: 'texto' }, { titulo: 'Horas del mes', tipo: 'num' }, { titulo: 'Horas mes anterior', tipo: 'num' }, ...[1, 2, 3, 4].map((s) => ({ titulo: `Semana ${s}`, tipo: 'num' as const }))],
    filas: (m?.operarias ?? []).map((o) => {
      const antes = previo?.operarias.find((x) => x.operaria === o.operaria);
      return [o.operaria, h(o), antes ? antes.horas : null, ...[1, 2, 3, 4].map((s) => h(o.semanas.find((x) => x.semana === s) ?? { horas: 0, horasCargadas: 0 }))];
    }),
  };
}

// ───────────────────────── Análisis ─────────────────────────

export function rTicket(d: Dataset): Reporte {
  return {
    id: 'ticket-promedio',
    titulo: 'Ticket promedio por servicio',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Ticket promedio', tipo: 'gs' },
      { titulo: 'Servicios con precio', tipo: 'num' },
    ],
    filas: ticketPorMes(d).meses.map((m) => [mesLargo(m.mes), m.ticket, m.servicios]),
  };
}

export function rMargen(d: Dataset, modo: ModoMargen): Reporte {
  return {
    id: 'margen-tipo-precio',
    titulo: `Margen por tipo de precio (modo ${modo})`,
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Tipo de precio', tipo: 'texto' },
      { titulo: 'Servicios', tipo: 'num' },
      { titulo: 'Ingresos', tipo: 'gs' },
      { titulo: 'Costo', tipo: 'gs' },
      { titulo: 'Margen', tipo: 'gs' },
      { titulo: 'Margen %', tipo: 'pct' },
    ],
    filas: d.operativo.flatMap((m) =>
      margenPorTipo(d, m.mes, modo)
        .tipos.filter((t) => t.servicios > 0)
        .map((t) => [mesLargo(m.mes), t.tipo, t.servicios, t.ingresos, t.costo, t.margen, t.pct]),
    ),
  };
}

export function rCostoPersonal(d: Dataset): Reporte {
  return {
    id: 'costo-personal',
    titulo: 'Costo de personal sobre facturación',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Mes', tipo: 'texto' },
      { titulo: 'Costo de personal', tipo: 'pct' },
    ],
    filas: costoPersonal(d).meses.map((m) => [mesLargo(m.mes) + (m.cerrado ? '' : ' (en curso)'), m.pct]),
  };
}

export function rProyeccion(d: Dataset, mes: number): Reporte {
  const p = proyeccionCierre(d, mes);
  return {
    id: 'proyeccion-cierre',
    titulo: 'Proyección al cierre del mes',
    periodo: pMes(d, mes),
    columnas: [
      { titulo: 'Concepto (estimado)', tipo: 'texto' },
      { titulo: 'Valor', tipo: 'gs' },
    ],
    filas: p
      ? [
          ['Facturación agendada', p.facturacionAgendada],
          ['Facturación al ritmo actual', p.facturacionRitmo],
          ['Gasto proyectado: pago por servicio agendado', p.gasto.pagoServicios],
          ['Gasto proyectado: sueldos fijos (último mes cerrado)', p.gasto.sueldosFijos],
          ['Gasto proyectado: otros gastos (promedio meses cerrados)', p.gasto.otros],
          ['Gasto proyectado total', p.gasto.total],
          ['Ganancia proyectada (facturación agendada)', p.gananciaAgendada],
          ['Ganancia proyectada (ritmo actual)', p.gananciaRitmo],
        ]
      : [],
  };
}

function tablaComparacion(id: string, titulo: string, periodo: string, etiquetas: [string, string], filas: FilaComparacion[]): Reporte {
  return {
    id,
    titulo,
    periodo,
    columnas: [
      { titulo: 'Métrica', tipo: 'texto' },
      { titulo: etiquetas[0], tipo: 'num' },
      { titulo: etiquetas[1], tipo: 'num' },
      { titulo: 'Variación', tipo: 'pct' },
    ],
    // Los porcentajes se exportan como fracción en las tres columnas para que el CSV sea consistente.
    filas: filas.map((f) => [f.metrica + (f.tipo === 'pct' ? ' (fracción; variación en puntos)' : ''), f.actual, f.anterior, f.variacion]),
  };
}

export function rComparacionAlDia(d: Dataset, mes: number): Reporte | null {
  const c = comparacionAlDia(d, mes);
  if (!c) return null;
  return tablaComparacion('comparacion-al-dia', `Comparación al día ${c.dia} vs mes anterior`, pMes(d, mes), [mesLargo(mes), mesLargo(mes - 1)], c.filas);
}

export function rComparacionCerrados(d: Dataset): Reporte | null {
  const c = comparacionCerrados(d);
  if (!c) return null;
  return tablaComparacion('comparacion-cerrados', 'Último mes cerrado vs mes previo', pMes(d, c.mes), [mesLargo(c.mes), mesLargo(c.mes - 1)], c.filas);
}

export function rRankingClientes(d: Dataset, mes: number | null, por: 'servicios' | 'dinero', tipo?: TipoCliente): Reporte {
  const filas = top(rankingClientes(d, mes, tipo), (r) => r[por]);
  return {
    id: `ranking-clientes-${por}${tipo ? `-${tipo.toLowerCase()}` : ''}`,
    titulo: `Ranking de clientes${tipo ? ` ${tipo.toLowerCase()}es` : ''} por ${por === 'servicios' ? 'cantidad de servicios' : 'dinero'}`,
    periodo: mes !== null ? pMes(d, mes) : pAnio(d),
    columnas: [
      { titulo: 'Cliente', tipo: 'texto' },
      { titulo: 'Servicios', tipo: 'num' },
      { titulo: 'Facturado (Σ N)', tipo: 'gs' },
    ],
    filas: filas.map((r) => [r.cliente, r.servicios, r.dinero]),
  };
}

export function rRankingOperarias(d: Dataset, mes: number | null): Reporte {
  return {
    id: 'ranking-operarias',
    titulo: 'Ranking de operarias',
    periodo: mes !== null ? pMes(d, mes) : pAnio(d),
    columnas: [
      { titulo: 'Operaria', tipo: 'texto' },
      { titulo: 'Unidades ponderadas', tipo: 'num' },
      { titulo: 'Servicios', tipo: 'num' },
      { titulo: 'Facturado (Σ N)', tipo: 'gs' },
      { titulo: 'Cobrado', tipo: 'gs' },
      { titulo: 'Margen', tipo: 'gs' },
    ],
    filas: top(rankingOperarias(d, mes), (r) => r.unidades, 100).map((r) => [r.operaria, r.unidades, r.servicios, r.facturado, r.cobrado, r.margen]),
  };
}

export function rPuntoEquilibrio(d: Dataset): Reporte {
  const p = puntoEquilibrio(d);
  return {
    id: 'punto-equilibrio',
    titulo: 'Punto de equilibrio mensual',
    periodo: pAnio(d),
    columnas: [
      { titulo: 'Concepto', tipo: 'texto' },
      { titulo: 'Valor', tipo: 'gs' },
    ],
    filas: [
      ['Otros gastos (promedio meses cerrados)', p.otrosGastos],
      ['Sueldos fijos (último mes cerrado)', p.sueldosFijos],
      ['Costos fijos', p.costosFijos],
      ['Ticket promedio', p.ticket],
      ['Pago promedio por servicio', p.pagoPromedio],
      ['Margen de contribución por servicio', p.margenContribucion],
      ['Punto de equilibrio (servicios)', p.servicios],
      ['Punto de equilibrio (facturación)', p.facturacion],
    ],
  };
}

// ───────────────────────── Exportar todo ─────────────────────────

export interface Filtros {
  mes: number;
  modoMargen: ModoMargen;
  conAgendados: boolean;
}

export function todosLosReportes(d: Dataset, f: Filtros): Reporte[] {
  const lista: (Reporte | null)[] = [
    rResumen(d, f.mes),
    rResumenSemanas(d, f.mes),
    rFinancieroMensual(d),
    rGastosCategoria(d),
    rFlujo(d),
    rFinancieroTotales(d),
    rServiciosMes(d),
    rServiciosSemana(d, f.conAgendados),
    rOcupacion(d, f.mes, f.conAgendados),
    rOcupacion(d, null, f.conAgendados),
    rSalarioMes(d, f.mes),
    rSalarioSemana(d, f.mes),
    rHorasOperaria(d, f.mes, f.conAgendados),
    rTicket(d),
    rMargen(d, f.modoMargen),
    rCostoPersonal(d),
    rProyeccion(d, f.mes),
    rComparacionAlDia(d, f.mes),
    rComparacionCerrados(d),
    rRankingClientes(d, f.mes, 'servicios'),
    rRankingClientes(d, null, 'servicios'),
    rRankingClientes(d, f.mes, 'dinero'),
    rRankingClientes(d, null, 'dinero'),
    rRankingClientes(d, null, 'servicios', 'Semanal'),
    rRankingClientes(d, null, 'servicios', 'Ocasional'),
    rRankingClientes(d, null, 'servicios', 'Quincenal'),
    rRankingOperarias(d, f.mes),
    rRankingOperarias(d, null),
    rPuntoEquilibrio(d),
  ];
  // Dos reportes pueden compartir título con distinto período; el nombre de archivo ya los separa.
  return lista.filter((r): r is Reporte => r !== null);
}
