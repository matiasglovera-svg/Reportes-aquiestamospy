import type { Dataset, Servicio, TipoCliente, TipoPrecio } from './types';

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const promedio = (xs: number[]) => (xs.length ? suma(xs) / xs.length : null);
const SIN_ASIGNAR = 'Sin asignar';

/** Total de sueldo fijo de la operaria en el mes (panel COMISION); null si no es fija o no hay dato. */
function sueldoFijo(d: Dataset, mes: number, operaria: string | null): { fija: boolean; total: number | null; horas: number } {
  const o = d.operativo.find((m) => m.mes === mes)?.operarias.find((x) => x.operaria === operaria);
  return { fija: o?.modalidad === 'Sueldo fijo', total: o?.modalidad === 'Sueldo fijo' ? o.totalMes : null, horas: o?.horas ?? 0 };
}

const realizados = (d: Dataset, mes?: number | null) => d.servicios.filter((s) => s.realizado && (mes == null || s.mes === mes));
const mesesCerrados = (d: Dataset) => d.operativo.filter((m) => m.cerrado).map((m) => m.mes);

// ───────────────────────── Ticket promedio ─────────────────────────

export interface TicketMes {
  mes: number;
  cerrado: boolean;
  /** Σ N de realizados con precio ÷ cantidad de esos servicios. */
  ticket: number | null;
  servicios: number;
}

export function ticketPorMes(d: Dataset): { meses: TicketMes[]; promedioCerrados: number | null } {
  const meses = d.operativo.map((m) => {
    const conPrecio = realizados(d, m.mes).filter((s) => s.precio !== null);
    return { mes: m.mes, cerrado: m.cerrado, servicios: conPrecio.length, ticket: conPrecio.length ? suma(conPrecio.map((s) => s.precio!)) / conPrecio.length : null };
  });
  return { meses, promedioCerrados: promedio(meses.filter((m) => m.cerrado && m.ticket !== null).map((m) => m.ticket!)) };
}

// ───────────────────────── Margen por tipo de precio ─────────────────────────

export type ModoMargen = 'A' | 'B';
export const TIPOS_PRECIO: TipoPrecio[] = ['Viejo', 'Promo', 'Nuevo', 'Sin clasificar'];

export interface MargenTipo {
  tipo: TipoPrecio;
  servicios: number;
  ingresos: number;
  costo: number;
  margen: number;
  /** margen ÷ ingresos. */
  pct: number | null;
}

export interface MargenMes {
  mes: number;
  tipos: MargenTipo[];
  /** Servicios de sueldo fijo que quedaron fuera (modo B, o modo A sin total de sueldo cargado). */
  excluidosFijos: number;
  /** Servicios realizados sin precio: no entran al margen. */
  sinPrecio: number;
}

/**
 * Margen = Σ N − costo, sobre servicios realizados con precio.
 * Modo A: a cada servicio de una operaria de sueldo fijo se le asigna
 *   costo = sueldo fijo del mes × (horas del servicio ÷ horas realizadas por ella en el mes).
 * Modo B: los servicios de operarias de sueldo fijo no entran al cálculo.
 */
export function margenPorTipo(d: Dataset, mes: number, modo: ModoMargen): MargenMes {
  const out: MargenMes = { mes, tipos: TIPOS_PRECIO.map((tipo) => ({ tipo, servicios: 0, ingresos: 0, costo: 0, margen: 0, pct: null })), excluidosFijos: 0, sinPrecio: 0 };
  for (const s of realizados(d, mes)) {
    if (s.precio === null) {
      out.sinPrecio++;
      continue;
    }
    const f = sueldoFijo(d, mes, s.operaria);
    let costo = s.pago ?? 0;
    if (f.fija) {
      // Sin total de sueldo cargado (mes en curso) no se inventa un costo: el servicio queda fuera.
      if (modo === 'B' || f.total === null || !f.horas) {
        out.excluidosFijos++;
        continue;
      }
      costo = (f.total * (s.horas ?? 0)) / f.horas;
    }
    const t = out.tipos.find((x) => x.tipo === s.tipoPrecio)!;
    t.servicios++;
    t.ingresos += s.precio;
    t.costo += costo;
  }
  for (const t of out.tipos) {
    t.margen = t.ingresos - t.costo;
    t.pct = t.ingresos ? t.margen / t.ingresos : null;
  }
  return out;
}

// ───────────────────────── Costo de personal ─────────────────────────

export function costoPersonal(d: Dataset): { meses: { mes: number; cerrado: boolean; pct: number | null }[]; promedioCerrados: number | null } {
  const meses = d.financiero.meses
    .filter((m) => m.ingresos !== null)
    .map((m) => ({ mes: m.mes, cerrado: m.cerrado, pct: m.rrhh !== null && m.ingresos ? m.rrhh / m.ingresos : null }));
  return { meses, promedioCerrados: promedio(meses.filter((m) => m.cerrado && m.pct !== null).map((m) => m.pct!)) };
}

// ───────────────────────── Proyección al cierre ─────────────────────────

/** Días hábiles (lunes a sábado) del mes y los transcurridos hasta `hoy` inclusive. */
export function diasHabiles(anio: number, mes: number, hoy: string): { total: number; transcurridos: number } {
  let total = 0;
  let transcurridos = 0;
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  for (let dia = 1; dia <= dias; dia++) {
    if (new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() === 0) continue;
    total++;
    if (`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` <= hoy) transcurridos++;
  }
  return { total, transcurridos };
}

export interface Proyeccion {
  mes: number;
  /** Σ N de todos los servicios cargados del mes. */
  facturacionAgendada: number;
  /** Σ N realizados ÷ días hábiles transcurridos × días hábiles del mes. */
  facturacionRitmo: number | null;
  dias: { total: number; transcurridos: number };
  gasto: { pagoServicios: number; sueldosFijos: number | null; otros: number | null; total: number | null };
  gananciaAgendada: number | null;
  gananciaRitmo: number | null;
}

/** Sueldos fijos del último mes cerrado que los tenga cargados. */
export function sueldosFijosReferencia(d: Dataset): { mes: number; total: number } | null {
  for (const m of [...d.operativo].reverse()) {
    if (!m.cerrado) continue;
    const fijas = m.operarias.filter((o) => o.modalidad === 'Sueldo fijo' && o.totalMes !== null);
    if (fijas.length) return { mes: m.mes, total: suma(fijas.map((o) => o.totalMes!)) };
  }
  return null;
}

/** Promedio mensual de gastos que no son RR. HH., sobre meses cerrados. */
export function gastosNoPersonalPromedio(d: Dataset): number | null {
  const cerrados = d.financiero.meses.filter((m) => d.financiero.mesesCerrados.includes(m.mes));
  return promedio(cerrados.map((m) => (m.gastos ?? 0) - (m.rrhh ?? 0)));
}

export function proyeccionCierre(d: Dataset, mes: number): Proyeccion | null {
  const op = d.operativo.find((m) => m.mes === mes);
  if (!op) return null;
  const dias = diasHabiles(d.anio, mes, d.hoy);
  const ritmo = dias.transcurridos ? (op.precioRealizado / dias.transcurridos) * dias.total : null;
  const fijos = sueldosFijosReferencia(d)?.total ?? null;
  const otros = gastosNoPersonalPromedio(d);
  const total = fijos !== null && otros !== null ? op.pagoCargado + fijos + otros : null;
  return {
    mes,
    facturacionAgendada: op.precioCargado,
    facturacionRitmo: ritmo,
    dias,
    gasto: { pagoServicios: op.pagoCargado, sueldosFijos: fijos, otros, total },
    gananciaAgendada: total !== null ? op.precioCargado - total : null,
    gananciaRitmo: total !== null && ritmo !== null ? ritmo - total : null,
  };
}

// ───────────────────────── Comparación vs mes anterior ─────────────────────────

export interface FilaComparacion {
  metrica: string;
  tipo: 'gs' | 'num' | 'pct';
  actual: number | null;
  anterior: number | null;
  /** (actual − anterior) ÷ |anterior|; para porcentajes, diferencia en puntos. */
  variacion: number | null;
}

const variar = (tipo: FilaComparacion['tipo'], actual: number | null, anterior: number | null) =>
  actual === null || anterior === null ? null : tipo === 'pct' ? actual - anterior : anterior ? (actual - anterior) / Math.abs(anterior) : null;

const fila = (metrica: string, tipo: FilaComparacion['tipo'], actual: number | null, anterior: number | null): FilaComparacion => ({
  metrica,
  tipo,
  actual,
  anterior,
  variacion: variar(tipo, actual, anterior),
});

/** Mes en curso hasta el día X contra el mes anterior hasta el mismo día X. */
export function comparacionAlDia(d: Dataset, mes: number): { dia: number; filas: FilaComparacion[] } | null {
  if (mes < 2 || !d.operativo.some((m) => m.mes === mes - 1)) return null;
  const dia = d.mesEnCurso === mes ? +d.hoy.slice(8, 10) : 31;
  const hasta = (m: number) => realizados(d, m).filter((s) => s.fecha !== null && +s.fecha.slice(8, 10) <= dia);
  const medir = (ss: Servicio[]) => {
    const conPrecio = ss.filter((s) => s.precio !== null);
    const fact = suma(conPrecio.map((s) => s.precio!));
    return { servicios: ss.length, fact, ticket: conPrecio.length ? fact / conPrecio.length : null };
  };
  const a = medir(hasta(mes));
  const b = medir(hasta(mes - 1));
  return {
    dia,
    filas: [fila('Servicios realizados', 'num', a.servicios, b.servicios), fila('Facturación por precio (Σ N)', 'gs', a.fact, b.fact), fila('Ticket promedio', 'gs', a.ticket, b.ticket)],
  };
}

/** Último mes cerrado contra el mes previo. */
export function comparacionCerrados(d: Dataset): { mes: number; filas: FilaComparacion[] } | null {
  const cerrados = d.financiero.mesesCerrados;
  const mes = cerrados[cerrados.length - 1];
  if (!mes || mes < 2) return null;
  const [f1, f0] = [d.financiero.meses[mes - 1], d.financiero.meses[mes - 2]];
  const [o1, o0] = [d.operativo.find((m) => m.mes === mes), d.operativo.find((m) => m.mes === mes - 1)];
  return {
    mes,
    filas: [
      fila('Ingresos', 'gs', f1.ingresos, f0.ingresos),
      fila('Gastos', 'gs', f1.gastos, f0.gastos),
      fila('Gasto en personal', 'gs', f1.rrhh, f0.rrhh),
      fila('Ganancia', 'gs', f1.ganancia, f0.ganancia),
      fila('Rentabilidad', 'pct', f1.rentabilidad, f0.rentabilidad),
      fila('Servicios realizados', 'num', o1?.realizados ?? null, o0?.realizados ?? null),
      fila('Unidades ponderadas', 'num', o1?.unidades ?? null, o0?.unidades ?? null),
      fila('Horas trabajadas', 'num', o1?.horas ?? null, o0?.horas ?? null),
    ],
  };
}

// ───────────────────────── Rankings ─────────────────────────

export interface RankingCliente {
  cliente: string;
  servicios: number;
  /** Σ N. */
  dinero: number;
}

/** Clientes por servicios realizados y por dinero. `mes` null = acumulado del año. */
export function rankingClientes(d: Dataset, mes: number | null, tipo?: TipoCliente): RankingCliente[] {
  const porCliente = new Map<string, RankingCliente>();
  for (const s of realizados(d, mes)) {
    if (!s.cliente || (tipo && s.tipoCliente !== tipo)) continue;
    const r = porCliente.get(s.cliente) ?? { cliente: s.cliente, servicios: 0, dinero: 0 };
    r.servicios++;
    r.dinero += s.precio ?? 0;
    porCliente.set(s.cliente, r);
  }
  return [...porCliente.values()];
}

export const top = <T>(filas: T[], por: (f: T) => number, n = 10): T[] => [...filas].sort((a, b) => por(b) - por(a)).slice(0, n);

export interface RankingOperaria {
  operaria: string;
  servicios: number;
  unidades: number;
  /** Σ N de sus servicios realizados. */
  facturado: number;
  /** Lo que cobró: Σ K, o el total de sueldo fijo del mes. null si falta el sueldo fijo de algún mes. */
  cobrado: number | null;
  margen: number | null;
}

export function rankingOperarias(d: Dataset, mes: number | null): RankingOperaria[] {
  const meses = mes == null ? d.operativo.map((m) => m.mes) : [mes];
  const out = new Map<string, RankingOperaria>();
  for (const m of meses) {
    for (const o of d.operativo.find((x) => x.mes === m)?.operarias ?? []) {
      if (o.operaria === SIN_ASIGNAR) continue;
      const r = out.get(o.operaria) ?? { operaria: o.operaria, servicios: 0, unidades: 0, facturado: 0, cobrado: 0, margen: null };
      const cobrado = o.modalidad === 'Sueldo fijo' ? o.totalMes : o.pagoRealizado;
      r.servicios += o.realizados;
      r.unidades += o.unidades;
      r.facturado += o.precioRealizado;
      r.cobrado = r.cobrado === null || cobrado === null ? null : r.cobrado + cobrado;
      out.set(o.operaria, r);
    }
  }
  return [...out.values()].map((r) => ({ ...r, margen: r.cobrado === null ? null : r.facturado - r.cobrado })).filter((r) => r.servicios > 0 || !!r.cobrado);
}

// ───────────────────────── Punto de equilibrio ─────────────────────────

export interface PuntoEquilibrio {
  /** Gastos no-RR. HH. (promedio de meses cerrados). */
  otrosGastos: number | null;
  /** Sueldos fijos del último mes cerrado. */
  sueldosFijos: number | null;
  costosFijos: number | null;
  ticket: number | null;
  /** K promedio por servicio de operarias por servicio (meses cerrados). */
  pagoPromedio: number | null;
  margenContribucion: number | null;
  servicios: number | null;
  facturacion: number | null;
}

export function puntoEquilibrio(d: Dataset): PuntoEquilibrio {
  const cerrados = new Set(mesesCerrados(d));
  const otrosGastos = gastosNoPersonalPromedio(d);
  const sueldosFijos = sueldosFijosReferencia(d)?.total ?? null;
  const costosFijos = otrosGastos !== null ? otrosGastos + (sueldosFijos ?? 0) : null;
  const ticket = ticketPorMes(d).promedioCerrados;
  const porServicio = d.servicios.filter((s) => s.realizado && cerrados.has(s.mes) && s.operaria && s.pago !== null && !sueldoFijo(d, s.mes, s.operaria).fija);
  const pagoPromedio = promedio(porServicio.map((s) => s.pago!));
  const mc = ticket !== null && pagoPromedio !== null ? ticket - pagoPromedio : null;
  const servicios = costosFijos !== null && mc !== null && mc > 0 ? costosFijos / mc : null;
  return { otrosGastos, sueldosFijos, costosFijos, ticket, pagoPromedio, margenContribucion: mc, servicios, facturacion: servicios !== null && ticket !== null ? servicios * ticket : null };
}
