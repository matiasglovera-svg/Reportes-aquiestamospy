import { fecha } from './format';

export type TipoColumna = 'texto' | 'gs' | 'pct' | 'num' | 'fecha';
export type Valor = string | number | null;

/** Un reporte tabular: lo que se ve en pantalla y lo que se exporta salen de acá. */
export interface Reporte {
  id: string;
  titulo: string;
  periodo: string;
  columnas: { titulo: string; tipo: TipoColumna }[];
  filas: Valor[][];
}

const decimal = (n: number, maxDecimales: number) => String(Math.round(n * 10 ** maxDecimales) / 10 ** maxDecimales).replace('.', ',');

function celda(v: Valor, tipo: TipoColumna): string {
  if (v === null || v === '') return '';
  if (typeof v === 'number') {
    if (tipo === 'gs') return decimal(v, 2);
    if (tipo === 'pct') return decimal(v * 100, 2);
    return decimal(v, 4);
  }
  const s = tipo === 'fecha' ? fecha(v) : v;
  // Un texto que empieza con = + - @ se abriría como fórmula en Excel.
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * CSV para Excel en español: separador ";", decimales con coma, UTF-8 con BOM,
 * fechas dd/mm/aaaa y montos sin símbolo de moneda. Los porcentajes van como número (20,7).
 */
export function aCsv(r: Reporte): string {
  const lineas = [r.columnas.map((c) => celda(c.tipo === 'pct' ? `${c.titulo} (%)` : c.titulo, 'texto')).join(';')];
  for (const f of r.filas) lineas.push(f.map((v, i) => celda(v, r.columnas[i]?.tipo ?? 'texto')).join(';'));
  return `﻿${lineas.join('\r\n')}\r\n`;
}

const limpio = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** aaaammdd-hhmm en hora de Asunción. */
export function selloDeTiempo(ahora: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}

export const nombreCsv = (r: Reporte, sello = selloDeTiempo()) => `AquiEstamos_${limpio(r.titulo)}_${limpio(r.periodo)}_${sello}.csv`;

function bajar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarCsv(r: Reporte): void {
  bajar(new Blob([aCsv(r)], { type: 'text/csv;charset=utf-8' }), nombreCsv(r));
}

/** ZIP con un CSV por reporte. */
export async function descargarZip(reportes: Reporte[], periodo: string): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const sello = selloDeTiempo();
  for (const r of reportes) zip.file(nombreCsv(r, sello), aCsv(r));
  bajar(await zip.generateAsync({ type: 'blob' }), `AquiEstamos_Reportes_${limpio(periodo)}_${sello}.zip`);
}
