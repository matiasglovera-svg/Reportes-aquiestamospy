import * as XLSX from 'xlsx';
import { mesDesdeTexto, normTexto } from './normalize';
import type { Celda, Hoja, LibroCrudo } from './types';

export const PESTANAS_FIJAS = ['INGRESOS', 'GASTOS', 'FLUJO CAJA', 'BBDD CLIENTES'];

/** Una pestaña se parsea si es un mes o una de las fijas (comparando el nombre normalizado). */
export function esPestanaNecesaria(nombre: string): boolean {
  return mesDesdeTexto(nombre) > 0 || PESTANAS_FIJAS.includes(normTexto(nombre));
}

interface CeldaXlsx {
  t: string;
  v?: unknown;
}

function aCelda(c: CeldaXlsx | undefined): Celda {
  if (!c || c.t === 'e' || c.t === 'z' || c.v === undefined || c.v === null) return null;
  if (typeof c.v === 'number' || typeof c.v === 'boolean' || typeof c.v === 'string') return c.v;
  return String(c.v);
}

/**
 * Convierte el .xlsx en grillas planas, parseando SOLO las pestañas necesarias
 * (CONSOLIDADO VENTAS_ tiene ~30 MB de XML y no se toca). Sin I/O: recibe los bytes.
 * Los meses viejos suelen estar ocultos en la planilla: se leen igual; `ocultas` es solo informativo.
 */
export function leerLibro(bytes: Uint8Array): LibroCrudo {
  const indice = XLSX.read(bytes, { type: 'array', bookSheets: true });
  const nombres = indice.SheetNames;
  const necesarias = nombres.filter(esPestanaNecesaria);

  const wb = XLSX.read(bytes, {
    type: 'array',
    sheets: necesarias,
    cellFormula: false,
    cellStyles: false,
    cellHTML: false,
    cellText: false,
    dense: true,
  });

  const ocultas = (wb.Workbook?.Sheets ?? []).filter((s) => s.Hidden && s.name).map((s) => s.name as string);
  const hojas: Record<string, Hoja> = {};
  for (const nombre of necesarias) {
    const ws = wb.Sheets[nombre] as unknown as { '!data'?: (CeldaXlsx | undefined)[][] } | undefined;
    const filas = ws?.['!data'] ?? [];
    const hoja: Hoja = [];
    for (let r = 0; r < filas.length; r++) {
      const fila = filas[r];
      hoja[r] = fila ? Array.from(fila, aCelda) : [];
    }
    hojas[nombre] = hoja;
  }
  return { nombres, ocultas, hojas };
}
