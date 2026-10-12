import { lectorPorTitulo, parseDetalle } from './parse-detalle';
import type { BloqueDetalle, Hoja, PorMes } from './types';

export interface IngresosCrudo {
  /** Fuente principal: tablas de detalle de la derecha. */
  detalle: Map<number, BloqueDetalle>;
  /** Resumen izquierdo (fila TOTAL INGRESOS): solo control. */
  resumen: PorMes;
}

export function parseIngresos(hoja: Hoja): IngresosCrudo {
  return { detalle: parseDetalle(hoja), resumen: lectorPorTitulo(hoja)('TOTAL INGRESOS') };
}
