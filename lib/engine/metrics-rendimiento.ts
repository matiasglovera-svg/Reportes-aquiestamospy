import { CAPACIDAD_MENSUAL, CAPACIDAD_SEMANAL } from '../../config/staff';
import { normTexto } from './normalize';
import type { Dataset, Servicio } from './types';

/**
 * Rendimiento por operaria: lo que generó su trabajo contra lo que cobró, en un mes o en un bloque SEMANA n.
 * Fuente: tabla de servicios de la pestaña del mes y panel PERSONAL DE LIMPIEZA (COMISION).
 */

export interface VistaRendimiento {
  mes: number;
  /** null = el mes completo; 1 a 4 = el bloque SEMANA n. */
  semana: number | null;
  /** También los servicios con fecha futura. */
  conAgendados: boolean;
  /** Listar todas las operarias del año, aunque no tengan servicios en el período. */
  mostrarSinActividad: boolean;
}

/** De dónde sale el salario de la fila. */
export type OrigenSalario = 'servicios' | 'panel' | 'estimado' | 'respaldo' | 'sin-dato';

export interface FilaRendimiento {
  operaria: string;
  fija: boolean;
  /** Servicios alcanzables: 48 por mes, 12 por semana. */
  alcanzables: number;
  /** Unidades ponderadas por horas (horas ÷ 4). */
  unidades: number;
  servicios: number;
  horas: number;
  ocupacion: number;
  /** Lo que recibe la operaria. null = sin dato. */
  salario: number | null;
  origenSalario: OrigenSalario;
  /** Mes del panel del que sale el sueldo fijo (el mismo mes, o el último cerrado si es estimado). */
  mesSueldo: number | null;
  /** Sueldo mensual completo (para sueldo fijo; en la vista semanal el salario es esto ÷ 4). */
  sueldoMensual: number | null;
  /** Lo que generó su trabajo: Σ N, haya pagado o no el cliente. */
  ingreso: number;
  diferencia: number | null;
  /** Servicios sin precio: cuentan en unidades pero no suman ingreso. */
  sinPrecio: { fecha: string | null; cliente: string | null; fila: number }[];
  /** Montos en K de filas de servicio de una operaria de sueldo fijo (no se suman al sueldo). */
  kNoSumado: number;
}

export interface Rendimiento {
  vista: VistaRendimiento;
  filas: FilaRendimiento[];
  total: { alcanzables: number; unidades: number; servicios: number; horas: number; ocupacion: number | null; salario: number | null; ingreso: number; diferencia: number | null };
  /** Servicios del período sin operaria asignada (no entran en ninguna fila). */
  sinAsignar: number;
  /** El período incluye servicios agendados (fecha futura). */
  incluyeAgendados: boolean;
}

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function esFija(d: Dataset, operaria: string, mes: number): boolean {
  const c = d.sueldosFijos.find((s) => normTexto(s.operaria) === normTexto(operaria));
  return !!c && `${d.anio}-${String(mes).padStart(2, '0')}` >= c.fijoDesde;
}

/** Total del panel COMISION de la operaria en el mes; null si no está cargado (o es 0). */
function totalPanel(d: Dataset, operaria: string, mes: number): number | null {
  const o = d.operativo.find((m) => m.mes === mes)?.operarias.find((x) => x.operaria === operaria);
  return o && o.modalidad === 'Sueldo fijo' && o.totalMes ? o.totalMes : null;
}

/**
 * Sueldo mensual de una operaria de sueldo fijo:
 * - mes cerrado: Total de su fila en el panel COMISION del mes;
 * - mes en curso: Total del último mes cerrado que lo tenga (estimado);
 * - si el panel no lo trae: el respaldo de config/staff.ts.
 */
export function sueldoFijoDelMes(d: Dataset, operaria: string, mes: number): { monto: number | null; origen: OrigenSalario; mesSueldo: number | null } {
  const cerrado = d.operativo.find((m) => m.mes === mes)?.cerrado ?? false;
  if (cerrado) {
    const t = totalPanel(d, operaria, mes);
    if (t !== null) return { monto: t, origen: 'panel', mesSueldo: mes };
  } else {
    for (let m = mes - 1; m >= 1; m--) {
      if (!(d.operativo.find((x) => x.mes === m)?.cerrado ?? false) || !esFija(d, operaria, m)) continue;
      const t = totalPanel(d, operaria, m);
      if (t !== null) return { monto: t, origen: 'estimado', mesSueldo: m };
    }
  }
  const respaldo = d.sueldosFijos.find((s) => normTexto(s.operaria) === normTexto(operaria))?.respaldo ?? null;
  return respaldo !== null ? { monto: respaldo, origen: 'respaldo', mesSueldo: null } : { monto: null, origen: 'sin-dato', mesSueldo: null };
}

export function rendimiento(d: Dataset, v: VistaRendimiento): Rendimiento {
  const delPeriodo = (s: Servicio) => s.mes === v.mes && (v.semana === null || s.semana === v.semana) && (v.conAgendados || s.realizado);
  const servicios = d.servicios.filter(delPeriodo);
  const alcanzables = v.semana === null ? CAPACIDAD_MENSUAL : CAPACIDAD_SEMANAL;

  // Quiénes se listan: con al menos un servicio en el período, más las de sueldo fijo vigentes.
  const nombres = new Set(servicios.filter((s) => s.operaria).map((s) => s.operaria!));
  for (const s of d.sueldosFijos) if (esFija(d, s.operaria, v.mes)) nombres.add(s.operaria);
  if (v.mostrarSinActividad) for (const m of d.operativo) for (const o of m.operarias) if (o.operaria !== 'Sin asignar') nombres.add(o.operaria);

  const filas: FilaRendimiento[] = [...nombres].map((operaria) => {
    const propios = servicios.filter((s) => s.operaria === operaria);
    const horas = suma(propios.map((s) => s.horas ?? 0));
    const unidades = horas / 4;
    const ingreso = suma(propios.map((s) => s.precio ?? 0));
    const fija = esFija(d, operaria, v.mes);
    let salario: number | null;
    let origenSalario: OrigenSalario = 'servicios';
    let mesSueldo: number | null = null;
    let sueldoMensual: number | null = null;
    if (fija) {
      const sf = sueldoFijoDelMes(d, operaria, v.mes);
      sueldoMensual = sf.monto;
      origenSalario = sf.origen;
      mesSueldo = sf.mesSueldo;
      // En la vista semanal el sueldo fijo se reparte en partes iguales entre los 4 bloques.
      salario = sf.monto === null ? null : v.semana === null ? sf.monto : sf.monto / 4;
    } else {
      salario = suma(propios.map((s) => s.pago ?? 0));
    }
    return {
      operaria,
      fija,
      alcanzables,
      unidades,
      servicios: propios.length,
      horas,
      ocupacion: unidades / alcanzables,
      salario,
      origenSalario,
      mesSueldo,
      sueldoMensual,
      ingreso,
      diferencia: salario === null ? null : ingreso - salario,
      sinPrecio: propios.filter((s) => s.precio === null).map((s) => ({ fecha: s.fecha, cliente: s.cliente, fila: s.fila })),
      kNoSumado: fija ? suma(propios.map((s) => s.pago ?? 0)) : 0,
    };
  });
  filas.sort((a, b) => (b.diferencia ?? -Infinity) - (a.diferencia ?? -Infinity) || a.operaria.localeCompare(b.operaria, 'es'));

  const totAlc = suma(filas.map((f) => f.alcanzables));
  const totUni = suma(filas.map((f) => f.unidades));
  const conSalario = filas.every((f) => f.salario !== null);
  const totSal = conSalario ? suma(filas.map((f) => f.salario!)) : null;
  const totIng = suma(filas.map((f) => f.ingreso));
  return {
    vista: v,
    filas,
    total: {
      alcanzables: totAlc,
      unidades: totUni,
      servicios: suma(filas.map((f) => f.servicios)),
      horas: suma(filas.map((f) => f.horas)),
      ocupacion: totAlc ? totUni / totAlc : null,
      salario: totSal,
      ingreso: totIng,
      diferencia: totSal === null ? null : totIng - totSal,
    },
    sinAsignar: servicios.filter((s) => !s.operaria).length,
    incluyeAgendados: v.conAgendados && servicios.some((s) => !s.realizado),
  };
}

/** Período anterior: el mes previo, o el bloque anterior (la Semana 1 se compara con la Semana 4 del mes previo). */
export function vistaAnterior(d: Dataset, v: VistaRendimiento): VistaRendimiento | null {
  const existe = (m: number) => d.operativo.some((x) => x.mes === m);
  if (v.semana === null) return existe(v.mes - 1) ? { ...v, mes: v.mes - 1 } : null;
  if (v.semana > 1) return { ...v, semana: v.semana - 1 };
  return existe(v.mes - 1) ? { ...v, mes: v.mes - 1, semana: 4 } : null;
}
