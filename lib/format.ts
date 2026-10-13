export const SIN_DATO = 'Sin dato';

export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const mesLargo = (mes: number) => MESES_LARGO[mes - 1] ?? '';
export const mesCorto = (mes: number) => MESES_CORTO[mes - 1] ?? '';

const entero = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// El signo menos tipográfico (−) no se confunde con un guion.
const signo = (n: number, texto: string) => (n < 0 ? `−${texto}` : texto);

/** Gs. 14.824.000 */
export function gs(n: number | null | undefined): string {
  if (n === null || n === undefined) return SIN_DATO;
  return signo(Math.round(n), `Gs. ${entero.format(Math.abs(Math.round(n)))}`);
}

/** Abreviado para ejes y espacios chicos: 14,8 M · 850 mil */
export function gsCorto(n: number | null | undefined): string {
  if (n === null || n === undefined) return SIN_DATO;
  const a = Math.abs(n);
  if (a >= 1e6) return signo(n, `${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(a / 1e6)} M`);
  if (a >= 1e4) return signo(n, `${entero.format(a / 1e3)} mil`);
  return signo(n, entero.format(a));
}

/** Fracción → 20,7 % */
export function pct(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined) return SIN_DATO;
  const v = Math.round(fraccion * 1000) / 10;
  return signo(v, `${unDecimal.format(Math.abs(v))} %`);
}

export function num(n: number | null | undefined, decimales = 0): string {
  if (n === null || n === undefined) return SIN_DATO;
  return signo(n, new Intl.NumberFormat('es-PY', { maximumFractionDigits: decimales }).format(Math.abs(n)));
}

/** aaaa-mm-dd → dd/mm/aaaa */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return SIN_DATO;
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Instante ISO → "12/10/2026 19:07" en hora de Asunción. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return SIN_DATO;
  return new Intl.DateTimeFormat('es-PY', { timeZone: 'America/Asuncion', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "hace 32 s", "hace 4 min", "hace 2 h". */
export function hace(iso: string | null | undefined, ahora: number = Date.now()): string {
  if (!iso) return 'sin lecturas';
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}
