import { lectorPorTitulo } from './parse-detalle';
import type { FlujoCaja, Hoja } from './types';

/** FLUJO CAJA: filas ubicadas por su título en la columna A. Las filas por categoría de gasto no se usan. */
export function parseFlujo(hoja: Hoja): FlujoCaja {
  const leer = lectorPorTitulo(hoja);
  return {
    cajaInicial: leer('CAJA INICIAL'),
    gananciaBruta: leer('GANANCIA BRUTA'),
    gananciaReal: leer('GANANCIA REAL'),
    cajaCierre: leer('CAJA AL CIERRE'),
    conversion: leer('CONVERSION'),
    totalIngresos: leer('TOTAL INGRESOS'),
    totalGastos: leer('TOTAL GASTOS'),
    flujoReal: leer('FLUJO DE CAJA REAL'),
  };
}
