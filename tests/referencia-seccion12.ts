/**
 * Valores de la sección 12 del prompt maestro (archivo al 12/10/2026).
 * NO son valores esperados: la verdad es el archivo en la nube. Se usan solo para imprimir diferencias.
 */
export const REFERENCIA_FINANCIERO: Record<number, { ingresos: number; gastos: number }> = {
  1: { ingresos: 12806000, gastos: 13226581 },
  2: { ingresos: 14151000, gastos: 12706345 },
  3: { ingresos: 19921000, gastos: 44928959 },
  4: { ingresos: 16768000, gastos: 15119408 },
  5: { ingresos: 19263000, gastos: 15385816 },
  6: { ingresos: 19125000, gastos: 15159172 },
  7: { ingresos: 20113000, gastos: 16177611 },
  8: { ingresos: 18196000, gastos: 15024000 },
  9: { ingresos: 18582000, gastos: 18071299 },
};

export const REFERENCIA_OPERATIVO: Record<number, { servicios: number; horas: number }> = {
  1: { servicios: 107, horas: 472 },
  2: { servicios: 125, horas: 530 },
  3: { servicios: 169, horas: 708 },
  4: { servicios: 143, horas: 592 },
  5: { servicios: 170, horas: 717 },
  6: { servicios: 160, horas: 687 },
  7: { servicios: 168, horas: 735 },
  8: { servicios: 154, horas: 690 },
  9: { servicios: 197, horas: 846 },
};
