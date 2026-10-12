import { normTexto } from './normalize';
import { lectorPorTitulo, parseDetalle } from './parse-detalle';
import type { BloqueDetalle, Hoja, PorMes } from './types';

export const CATEGORIA_RRHH = 'RECURSOS HUMANOS';

export const CATEGORIAS_GASTO = [
  CATEGORIA_RRHH,
  'IVA',
  'PAUTA',
  'MARKETING',
  'SOFTWARE DE GESTION',
  'SET',
  'CAPACITACION',
  'EMERGENCIAS O IMPREVISTOS',
  'UNIFORMES Y ROPA DE TRABAJO',
  'CONTABILIDAD Y ASESORIA LEGAL',
  'OTRO',
];

/** Concepto de la planilla → categoría normalizada. Un concepto desconocido queda como categoría propia. */
export function categoriaGasto(concepto: string | null): string {
  const t = normTexto(concepto);
  if (!t) return 'SIN CONCEPTO';
  if (/^UNIFORMES? Y ROPA DE TRABAJO$/.test(t)) return 'UNIFORMES Y ROPA DE TRABAJO';
  return t;
}

export interface GastosCrudo {
  /** Fuente única: tablas de detalle de la derecha. */
  detalle: Map<number, BloqueDetalle>;
  /** Resumen izquierdo (fila TOTAL EGRESOS): solo control; sus filas por categoría están corridas. */
  resumen: PorMes;
}

export function parseGastos(hoja: Hoja): GastosCrudo {
  return { detalle: parseDetalle(hoja), resumen: lectorPorTitulo(hoja)('TOTAL EGRESOS') };
}
