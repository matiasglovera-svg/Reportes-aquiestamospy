import { MESES, titulo } from './normalize';
import { CATEGORIA_RRHH } from './parse-gastos';
import type { Dataset, LineaDetalle } from './types';

/**
 * Flujo de caja detallado. Fuentes:
 * - Caja inicial y caja al cierre: FLUJO CAJA.
 * - Ingresos: detalle de INGRESOS. Gastos, categorías y comentarios: detalle de GASTOS.
 */

/** Un mes, o el acumulado de meses cerrados (opcionalmente hasta un mes, para comparar). */
export type PeriodoFlujo = { tipo: 'mes'; mes: number } | { tipo: 'acumulado'; hasta?: number };

export interface CategoriaFlujo {
  categoria: string;
  valor: number;
  lineas: LineaDetalle[];
}

export interface ResumenFlujo {
  periodo: PeriodoFlujo;
  etiqueta: string;
  meses: number[];
  /** Incluye el mes en curso: los valores son parciales. */
  parcial: boolean;
  cajaInicial: number | null;
  ingresos: number | null;
  gastos: number | null;
  rrhh: number | null;
  gananciaBruta: number | null;
  gananciaReal: number | null;
  margenBruto: number | null;
  margenNeto: number | null;
  cajaCierre: number | null;
  /** Gastos por categoría con sus líneas, de mayor a menor. */
  categorias: CategoriaFlujo[];
  ingresosPorConcepto: CategoriaFlujo[];
  /** Caja inicial + Ganancia real = Caja al cierre. null si falta algún dato. */
  coherente: boolean | null;
}

const nombreMes = (m: number) => titulo(MESES[m - 1]);
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Meses con algún dato financiero cargado. */
const mesesConDatos = (d: Dataset) => d.financiero.meses.filter((m) => m.ingresos !== null || m.gastos !== null).map((m) => m.mes);

function mesesDelPeriodo(d: Dataset, p: PeriodoFlujo): number[] {
  if (p.tipo === 'mes') return mesesConDatos(d).includes(p.mes) ? [p.mes] : [];
  return d.financiero.mesesCerrados.filter((m) => p.hasta === undefined || m <= p.hasta);
}

export function etiquetaPeriodo(meses: number[], p: PeriodoFlujo): string {
  if (!meses.length) return 'Sin datos';
  if (p.tipo === 'mes') return nombreMes(meses[0]);
  return meses.length === 1 ? nombreMes(meses[0]) : `${nombreMes(meses[0])} a ${nombreMes(meses[meses.length - 1])}`;
}

function agrupar(lineas: LineaDetalle[]): CategoriaFlujo[] {
  const grupos = new Map<string, LineaDetalle[]>();
  for (const l of lineas) grupos.set(l.categoria, [...(grupos.get(l.categoria) ?? []), l]);
  return [...grupos]
    .map(([categoria, ls]) => ({ categoria, valor: suma(ls.map((l) => l.valor)), lineas: ls }))
    .sort((a, b) => b.valor - a.valor);
}

export function resumenFlujo(d: Dataset, p: PeriodoFlujo): ResumenFlujo | null {
  const meses = mesesDelPeriodo(d, p);
  if (!meses.length) return null;
  const fin = meses.map((m) => d.financiero.meses[m - 1]);
  const sumar = (campo: 'ingresos' | 'gastos' | 'rrhh') => {
    const vs = fin.map((m) => m[campo]).filter((v): v is number => v !== null);
    return vs.length ? suma(vs) : null;
  };
  const ingresos = sumar('ingresos');
  const gastos = sumar('gastos');
  const rrhh = sumar('rrhh');
  const gananciaBruta = ingresos !== null && rrhh !== null ? ingresos - rrhh : null;
  const gananciaReal = ingresos !== null && gastos !== null ? ingresos - gastos : null;
  const cajaInicial = fin[0].cajaInicial;
  const cajaCierre = fin[fin.length - 1].cajaCierre;
  const enPeriodo = (l: LineaDetalle) => meses.includes(l.mes);

  return {
    periodo: p,
    etiqueta: etiquetaPeriodo(meses, p),
    meses,
    parcial: d.mesEnCurso !== null && meses.includes(d.mesEnCurso),
    cajaInicial,
    ingresos,
    gastos,
    rrhh,
    gananciaBruta,
    gananciaReal,
    margenBruto: gananciaBruta !== null && ingresos ? gananciaBruta / ingresos : null,
    margenNeto: gananciaReal !== null && ingresos ? gananciaReal / ingresos : null,
    cajaCierre,
    categorias: agrupar(d.detalle.gastos.filter(enPeriodo)),
    ingresosPorConcepto: agrupar(d.detalle.ingresos.filter(enPeriodo)),
    coherente: cajaInicial !== null && cajaCierre !== null && gananciaReal !== null ? Math.abs(cajaInicial + gananciaReal - cajaCierre) < 1 : null,
  };
}

/**
 * Período anterior para comparar: el mes previo, o el acumulado de cerrados hasta el penúltimo mes cerrado
 * (ej.: Enero a Septiembre se compara con Enero a Agosto).
 */
export function periodoAnterior(d: Dataset, p: PeriodoFlujo): PeriodoFlujo | null {
  if (p.tipo === 'mes') return mesesConDatos(d).includes(p.mes - 1) ? { tipo: 'mes', mes: p.mes - 1 } : null;
  const meses = mesesDelPeriodo(d, p);
  return meses.length >= 2 ? { tipo: 'acumulado', hasta: meses[meses.length - 2] } : null;
}

// ───────────────────────── Cascada ─────────────────────────

export type TipoPaso = 'caja' | 'ingreso' | 'gasto' | 'subtotal';

export interface PasoCascada {
  clave: string;
  etiqueta: string;
  tipo: TipoPaso;
  /** Monto del paso (positivo; los gastos restan). Para subtotales y caja, el valor que representan. */
  monto: number;
  /** Tramo dibujado: de `desde` a `hasta` (en Gs.). */
  desde: number;
  hasta: number;
  /** Es el gasto más alto del período. */
  mayor?: boolean;
}

/**
 * Caja inicial → + Ingresos → − RR. HH. → = Ganancia bruta → − resto de categorías (mayor a menor)
 * → = Ganancia real → = Caja al cierre. Los subtotales se dibujan desde el nivel de la caja inicial,
 * así su altura es exactamente la ganancia que representan.
 */
export function cascada(r: ResumenFlujo): PasoCascada[] {
  if (r.ingresos === null || r.gastos === null) return [];
  const base = r.cajaInicial ?? 0;
  const pasos: PasoCascada[] = [];
  const mayor = r.categorias[0]?.categoria;
  if (r.cajaInicial !== null) pasos.push({ clave: 'caja-inicial', etiqueta: 'Caja inicial', tipo: 'caja', monto: r.cajaInicial, desde: 0, hasta: r.cajaInicial });

  let nivel = base;
  const mover = (clave: string, etiqueta: string, tipo: 'ingreso' | 'gasto', monto: number, categoria?: string) => {
    const hasta = tipo === 'ingreso' ? nivel + monto : nivel - monto;
    pasos.push({ clave, etiqueta, tipo, monto, desde: nivel, hasta, mayor: categoria !== undefined && categoria === mayor });
    nivel = hasta;
  };

  mover('ingresos', 'Ingresos', 'ingreso', r.ingresos);
  const rrhh = r.categorias.find((c) => c.categoria === CATEGORIA_RRHH);
  if (rrhh) mover(`gasto-${rrhh.categoria}`, rrhh.categoria, 'gasto', rrhh.valor, rrhh.categoria);
  if (r.gananciaBruta !== null) pasos.push({ clave: 'ganancia-bruta', etiqueta: 'Ganancia bruta', tipo: 'subtotal', monto: r.gananciaBruta, desde: base, hasta: base + r.gananciaBruta });
  for (const c of r.categorias) if (c !== rrhh) mover(`gasto-${c.categoria}`, c.categoria, 'gasto', c.valor, c.categoria);
  if (r.gananciaReal !== null) pasos.push({ clave: 'ganancia-real', etiqueta: 'Ganancia real', tipo: 'subtotal', monto: r.gananciaReal, desde: base, hasta: base + r.gananciaReal });
  if (r.cajaCierre !== null) pasos.push({ clave: 'caja-cierre', etiqueta: 'Caja al cierre', tipo: 'caja', monto: r.cajaCierre, desde: 0, hasta: r.cajaCierre });
  return pasos;
}

// ───────────────────────── Matriz ─────────────────────────

export type GrupoFila = 'caja' | 'ingreso' | 'gasto' | 'resultado' | 'control';

export interface FilaMatriz {
  clave: string;
  titulo: string;
  grupo: GrupoFila;
  tipo: 'gs' | 'pct' | 'check';
  /** Categoría de gasto (para abrir sus líneas). */
  categoria?: string;
  /** Una celda por mes de `columnas`. Para "check": 1 = coherente, 0 = no, null = sin dato. */
  valores: (number | null)[];
  total: number | null;
  promedio: number | null;
  /** La fila es un total (se destaca). */
  destacada?: boolean;
}

export interface MatrizFlujo {
  /** Meses que se muestran (enero → mes actual con datos). */
  columnas: { mes: number; parcial: boolean }[];
  /** Meses cerrados que entran en Total y Promedio. */
  cerrados: number[];
  filas: FilaMatriz[];
}

export function matrizFlujo(d: Dataset): MatrizFlujo {
  const columnas = mesesConDatos(d)
    .filter((m) => d.mesEnCurso === null || m <= d.mesEnCurso)
    .map((mes) => ({ mes, parcial: d.mesEnCurso === mes }));
  const cerrados = columnas.filter((c) => d.financiero.mesesCerrados.includes(c.mes)).map((c) => c.mes);
  const fin = (m: number) => d.financiero.meses[m - 1];
  const totalDe = (porMes: (m: number) => number | null) => {
    const vs = cerrados.map(porMes).filter((v): v is number => v !== null);
    return vs.length ? suma(vs) : null;
  };
  const promedioDe = (porMes: (m: number) => number | null) => {
    const vs = cerrados.map(porMes).filter((v): v is number => v !== null);
    return vs.length ? suma(vs) / vs.length : null;
  };
  const fila = (clave: string, tituloFila: string, grupo: GrupoFila, porMes: (m: number) => number | null, extra: Partial<FilaMatriz> = {}): FilaMatriz => ({
    clave,
    titulo: tituloFila,
    grupo,
    tipo: 'gs',
    valores: columnas.map((c) => porMes(c.mes)),
    total: totalDe(porMes),
    promedio: promedioDe(porMes),
    ...extra,
  });
  const porCategoria = (lineas: LineaDetalle[], categoria: string) => (m: number) => {
    const ls = lineas.filter((l) => l.mes === m && l.categoria === categoria);
    return ls.length ? suma(ls.map((l) => l.valor)) : null;
  };
  const ordenar = (lineas: LineaDetalle[]) => agrupar(lineas.filter((l) => columnas.some((c) => c.mes === l.mes))).map((c) => c.categoria);
  const cerradosTot = (f: (m: number) => number | null) => totalDe(f);

  const ingresos = (m: number) => fin(m).ingresos;
  const gastos = (m: number) => fin(m).gastos;
  const bruta = (m: number) => fin(m).gananciaBruta;
  const real = (m: number) => fin(m).ganancia;
  const margen = (num: (m: number) => number | null) => (m: number) => {
    const n = num(m);
    const i = ingresos(m);
    return n !== null && i ? n / i : null;
  };
  const totalIng = cerradosTot(ingresos);
  const primero = cerrados[0];
  const ultimo = cerrados[cerrados.length - 1];

  const filas: FilaMatriz[] = [
    // La caja no se suma: el total es la caja del primer (inicial) o último (cierre) mes cerrado.
    { ...fila('caja-inicial', 'Caja inicial', 'caja', (m) => fin(m).cajaInicial), total: primero ? fin(primero).cajaInicial : null, promedio: null },
    ...ordenar(d.detalle.ingresos).map((c) => fila(`ingreso-${c}`, c, 'ingreso', porCategoria(d.detalle.ingresos, c))),
    fila('ingresos', 'Total ingresos', 'ingreso', ingresos, { destacada: true }),
    ...ordenar(d.detalle.gastos).map((c) => fila(`gasto-${c}`, c, 'gasto', porCategoria(d.detalle.gastos, c), { categoria: c })),
    fila('gastos', 'Total gastos', 'gasto', gastos, { destacada: true }),
    fila('ganancia-bruta', 'Ganancia bruta', 'resultado', bruta, { destacada: true }),
    { ...fila('margen-bruto', 'Margen bruto %', 'resultado', margen(bruta), { tipo: 'pct' }), total: totalIng ? (cerradosTot(bruta) ?? 0) / totalIng : null },
    fila('ganancia-real', 'Ganancia real', 'resultado', real, { destacada: true }),
    { ...fila('margen-neto', 'Margen neto %', 'resultado', margen(real), { tipo: 'pct' }), total: totalIng ? (cerradosTot(real) ?? 0) / totalIng : null },
    { ...fila('caja-cierre', 'Caja al cierre', 'caja', (m) => fin(m).cajaCierre, { destacada: true }), total: ultimo ? fin(ultimo).cajaCierre : null, promedio: null },
    {
      clave: 'coherencia',
      titulo: 'Caja inicial + Ganancia real = Caja al cierre',
      grupo: 'control',
      tipo: 'check',
      valores: columnas.map((c) => {
        const f = fin(c.mes);
        return f.cajaInicial === null || f.cajaCierre === null || f.ganancia === null ? null : Math.abs(f.cajaInicial + f.ganancia - f.cajaCierre) < 1 ? 1 : 0;
      }),
      total: null,
      promedio: null,
    },
  ];
  return { columnas, cerrados, filas };
}

// ───────────────────────── Lectura automática ─────────────────────────

const miles = (n: number) => `${n < 0 ? '−' : ''}${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)))}`;
const conSigno = (n: number) => `${n >= 0 ? '+' : '−'}${miles(Math.abs(n))}`;
const porc = (f: number) => `${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(Math.round(f * 1000) / 10)} %`;
const nombreCat = (c: string) => (c === CATEGORIA_RRHH ? 'Recursos Humanos' : c === 'SET' || c === 'IVA' ? c : titulo(c));

/** 3 a 5 frases armadas por reglas a partir de los datos. Una frase sin datos suficientes no se incluye. */
export function lecturaAutomatica(r: ResumenFlujo, anterior: ResumenFlujo | null): string[] {
  const frases: string[] = [];
  const contraAnterior = anterior ? (anterior.periodo.tipo === 'mes' ? nombreMes(anterior.meses[0]).toLowerCase() : anterior.etiqueta.toLowerCase()) : null;

  if (r.rrhh !== null && r.ingresos) frases.push(`Recursos Humanos fue el ${porc(r.rrhh / r.ingresos)} de los ingresos.`);

  const otra = r.categorias.find((c) => c.categoria !== CATEGORIA_RRHH);
  if (otra && r.gastos) frases.push(`Después de Recursos Humanos, el mayor gasto fue ${nombreCat(otra.categoria)}: Gs. ${miles(otra.valor)} (${porc(otra.valor / r.gastos)} del gasto total).`);

  // En el acumulado la diferencia de sumas es solo el último mes: la frase no aplica.
  if (anterior && contraAnterior && r.periodo.tipo === 'mes') {
    const crecimientos = r.categorias
      .map((c) => ({ c, delta: c.valor - (anterior.categorias.find((x) => x.categoria === c.categoria)?.valor ?? 0) }))
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta);
    if (crecimientos.length && !r.parcial) frases.push(`El gasto que más creció fue ${nombreCat(crecimientos[0].c.categoria)} (${conSigno(crecimientos[0].delta)} vs ${contraAnterior}).`);
  }

  if (r.margenNeto !== null) {
    let pts = '';
    if (anterior?.margenNeto != null && !r.parcial) {
      const dif = Math.round((r.margenNeto - anterior.margenNeto) * 1000) / 10;
      pts = ` (${dif >= 0 ? '+' : '−'}${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(Math.abs(dif))} pts vs ${contraAnterior})`;
    }
    frases.push(`El margen neto fue ${porc(r.margenNeto)}${pts}.`);
  }

  if (r.cajaCierre !== null && r.cajaInicial !== null) {
    const desde = r.periodo.tipo === 'mes' ? 'el inicio del mes' : 'el inicio del período';
    frases.push(`La caja ${r.parcial ? 'proyectada para el cierre es' : 'cerró en'} Gs. ${miles(r.cajaCierre)}, ${conSigno(r.cajaCierre - r.cajaInicial)} vs ${desde}.`);
  }
  return frases.slice(0, 5);
}
