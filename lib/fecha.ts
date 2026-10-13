/** "Hoy" como aaaa-mm-dd en la zona horaria de la app (America/Asuncion por defecto). */
export function hoyEn(zona: string, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
