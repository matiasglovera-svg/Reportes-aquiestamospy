/**
 * Colores para gráficos. Son pasos de los tonos de marca (royal → turquesa → amarillo → durazno → navy claro)
 * ajustados para que las series se distingan entre sí, también con daltonismo, sobre cada fondo.
 * Los colores de marca exactos se usan en la interfaz (globals.css) y en el mapa de calor.
 */
export type Tema = 'light' | 'dark';

export const SERIES: Record<Tema, string[]> = {
  light: ['#3751D9', '#18A0B5', '#D6A100', '#E0603F', '#1670A8'],
  dark: ['#6A7FEA', '#1FA4A8', '#B58E10', '#C8442E', '#4A97D1'],
};

export const GRAFICO: Record<Tema, { texto: string; tenue: string; grilla: string; superficie: string; alerta: string; atenuado: string }> = {
  light: { texto: '#0A3143', tenue: '#4A6573', grilla: '#E3E5D8', superficie: '#FFFFFF', alerta: '#C9343A', atenuado: '#B9C2F2' },
  dark: { texto: '#F3F6F8', tenue: '#A9C1CD', grilla: '#1F5269', superficie: '#0F3A4F', alerta: '#FF8A8E', atenuado: '#3A4A8A' },
};

/** Mapa de calor: escala secuencial crema → turquesa → royal; más de 100 % en amarillo. */
export const CALOR = {
  light: { vacio: '#F3F4EA', pasos: ['#FBFBF3', '#BDEAF1', '#37C4D8', '#3A8FD9', '#3751D9'], sobre: '#FFD83B' },
  dark: { vacio: '#14465D', pasos: ['#1B5670', '#1F7F95', '#37C4D8', '#5C9BEF', '#8FA0FF'], sobre: '#FFD83B' },
} satisfies Record<Tema, { vacio: string; pasos: string[]; sobre: string }>;
