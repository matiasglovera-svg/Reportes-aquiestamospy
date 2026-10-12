import { letraCol, mesDesdeTexto, normTexto, numero, texto } from './normalize';
import type { BloqueDetalle, Hoja, PorMes } from './types';

const MAX_FILAS_BLOQUE = 60;

/**
 * Tablas de detalle por mes (INGRESOS y GASTOS comparten disposición): un título con el nombre del mes y,
 * unas filas más abajo, el encabezado CONCEPTO / VALOR / (OBS | COMENTARIO | MES | FECHA).
 * Solo se suma la columna VALOR; lo que esté en la tercera columna queda como observación.
 */
export function parseDetalle(hoja: Hoja): Map<number, BloqueDetalle> {
  const bloques = new Map<number, BloqueDetalle>();
  for (let r = 0; r < hoja.length; r++) {
    const fila = hoja[r] ?? [];
    for (let c = 0; c < fila.length; c++) {
      const mes = mesDesdeTexto(fila[c]);
      if (!mes || bloques.has(mes)) continue;

      let h = -1;
      for (let k = r + 1; k <= r + 6 && h < 0; k++) {
        if (normTexto(hoja[k]?.[c]) === 'CONCEPTO' && normTexto(hoja[k]?.[c + 1]) === 'VALOR') h = k;
      }
      if (h < 0) continue;

      const bloque: BloqueDetalle = { mes, rango: '', filas: [], suma: null, totalCelda: null };
      let fin = h;
      for (let k = h + 1; k <= h + MAX_FILAS_BLOQUE && k < hoja.length; k++) {
        const concepto = texto(hoja[k]?.[c]);
        if (concepto && mesDesdeTexto(concepto)) break;
        if (normTexto(concepto) === 'TOTAL') {
          bloque.totalCelda = numero(hoja[k]?.[c + 1]);
          break;
        }
        fin = k;
        const valor = numero(hoja[k]?.[c + 1]);
        const obs = texto(hoja[k]?.[c + 2]);
        if (concepto === null && valor === null && obs === null) continue;
        bloque.filas.push({ fila: k + 1, concepto, valor, obs });
        if (valor !== null) bloque.suma = (bloque.suma ?? 0) + valor;
      }
      bloque.rango = `${letraCol(c + 1)}${h + 2}:${letraCol(c + 1)}${fin + 1}`;
      bloques.set(mes, bloque);
    }
  }
  return bloques;
}

/**
 * Tablas con una fila de meses (ENERO, FEBRERO, …) y filas identificadas por su título en la primera columna
 * (resumen izquierdo de INGRESOS/GASTOS y FLUJO CAJA).
 */
export function lectorPorTitulo(hoja: Hoja): (titulo: string) => PorMes {
  let filaMeses = -1;
  let colEnero = -1;
  for (let r = 0; r < Math.min(hoja.length, 30) && filaMeses < 0; r++) {
    const fila = hoja[r] ?? [];
    for (let c = 0; c < Math.min(fila.length, 14); c++) {
      if (mesDesdeTexto(fila[c]) === 1 && mesDesdeTexto(fila[c + 1]) === 2) {
        filaMeses = r;
        colEnero = c;
        break;
      }
    }
  }
  return (titulo) => {
    const vacio: PorMes = Array(12).fill(null);
    if (filaMeses < 0) return vacio;
    const buscado = normTexto(titulo);
    for (let r = filaMeses + 1; r < hoja.length; r++) {
      const fila = hoja[r] ?? [];
      for (let c = 0; c < colEnero; c++) {
        if (normTexto(fila[c]) === buscado) return vacio.map((_, i) => numero(fila[colEnero + i]));
      }
    }
    return vacio;
  };
}
