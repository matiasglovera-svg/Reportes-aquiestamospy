import type { Celda, TipoCliente, TipoPrecio } from './types';

export const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const;

/** Mayúsculas, sin tildes, trim, espacios colapsados. */
export function normTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Número de mes (1–12) si el texto es exactamente un nombre de mes; si no, 0. */
export function mesDesdeTexto(v: unknown): number {
  return MESES.indexOf(normTexto(v) as (typeof MESES)[number]) + 1;
}

/** Texto limpio; null para vacío o errores de Excel escritos como texto. */
export function texto(c: Celda | undefined): string | null {
  if (c === null || c === undefined || typeof c === 'boolean') return null;
  const s = String(c).replace(/\s+/g, ' ').trim();
  if (s === '' || /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)$/i.test(s)) return null;
  return s;
}

export function numero(c: Celda | undefined): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (typeof c === 'string' && /^-?\d+([.,]\d+)?$/.test(c.trim())) return Number(c.trim().replace(',', '.'));
  return null;
}

export function booleano(c: Celda | undefined): boolean | null {
  if (typeof c === 'boolean') return c;
  const t = normTexto(c);
  if (t === 'TRUE' || t === 'VERDADERO') return true;
  if (t === 'FALSE' || t === 'FALSO') return false;
  return null;
}

/** Fecha de Excel (número de serie o texto dd/mm/aaaa) → aaaa-mm-dd. No inventa: lo que no entiende es null. */
export function fechaISO(c: Celda | undefined): string | null {
  if (typeof c === 'number' && c > 30000 && c < 80000) {
    return new Date(Math.round((Math.floor(c) - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  if (typeof c === 'string') {
    const m = c.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
      const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
      if (d.getUTCMonth() === +m[2] - 1) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

/** "08:00HS A 12:00HS" → 4. */
export function horasDesdeTexto(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})\D+?(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = +m[3] + +m[4] / 60 - (+m[1] + +m[2] / 60);
  return h > 0 && h <= 16 ? h : null;
}

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const MINUSCULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);

/** "MARIA DEL CARMEN" → "Maria del Carmen". */
export function titulo(s: string): string {
  return normTexto(s)
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p.toLowerCase() : p.charAt(0) + p.slice(1).toLowerCase()))
    .join(' ');
}

export interface NombreResuelto {
  nombre: string;
  /** Unificado por distancia de Levenshtein ≤ 1 (se informa en Salud de datos). */
  unificadoAuto: boolean;
  /** No figura en alias ni en la lista de conocidos. */
  nuevo: boolean;
}

export type Resolutor = (crudo: string) => NombreResuelto;

/**
 * Arma el resolutor de nombres: alias → canónico conocido → Levenshtein ≤ 1 (nombres de ≥ 5 letras) → nombre nuevo.
 * Con `autoUnificar: false` (clientes) solo normaliza y aplica alias.
 */
export function crearResolutor(
  alias: Record<string, string[]>,
  conocidos: string[],
  opciones: { autoUnificar: boolean; marcarNuevos: boolean },
): Resolutor {
  const mapa = new Map<string, string>();
  for (const [canonico, variantes] of Object.entries(alias)) {
    mapa.set(normTexto(canonico), canonico);
    for (const v of variantes) mapa.set(normTexto(v), canonico);
  }
  for (const c of conocidos) if (!mapa.has(normTexto(c))) mapa.set(normTexto(c), c);
  const canonicos = [...new Set(mapa.values())];

  return (crudo) => {
    const n = normTexto(crudo);
    const directo = mapa.get(n);
    if (directo) return { nombre: directo, unificadoAuto: false, nuevo: false };
    if (opciones.autoUnificar && n.length >= 5) {
      const cerca = canonicos.filter((c) => levenshtein(n, normTexto(c)) <= 1);
      if (cerca.length === 1) return { nombre: cerca[0], unificadoAuto: true, nuevo: false };
    }
    return { nombre: titulo(n), unificadoAuto: false, nuevo: opciones.marcarNuevos };
  };
}

export function tipoPrecioDesde(c: Celda | undefined): TipoPrecio | null {
  const t = normTexto(texto(c));
  if (t.includes('VIEJO')) return 'Viejo';
  if (t.includes('PROMO')) return 'Promo';
  if (t.includes('NUEVO')) return 'Nuevo';
  return null;
}

export function tipoClienteDesde(c: Celda | undefined): TipoCliente | null {
  const t = normTexto(texto(c));
  if (t.includes('SEMANAL')) return 'Semanal';
  if (t.includes('QUINCENAL')) return 'Quincenal';
  if (t.includes('OCASIONAL')) return 'Ocasional';
  return null;
}

/** Índice de columna (base 0) → letra de Excel. */
export function letraCol(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function celdaRef(fila0: number, col0: number): string {
  return `${letraCol(col0)}${fila0 + 1}`;
}
