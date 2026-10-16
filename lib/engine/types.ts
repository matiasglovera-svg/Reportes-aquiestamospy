/** Valor crudo de una celda. Los errores de Excel (#N/A, #REF!, …) llegan como null. */
export type Celda = string | number | boolean | null;
/** Hoja como grilla [fila][columna], base 0. */
export type Hoja = Celda[][];

export interface LibroCrudo {
  /** Todas las pestañas del archivo, en orden. */
  nombres: string[];
  ocultas: string[];
  /** Solo las pestañas que se parsearon. */
  hojas: Record<string, Hoja>;
}

export type TipoPrecio = 'Viejo' | 'Promo' | 'Nuevo' | 'Sin clasificar';
export type TipoCliente = 'Semanal' | 'Quincenal' | 'Ocasional' | 'Sin clasificar';
export type OrigenTipo = 'fila' | 'bbdd' | 'ninguno';

export interface Servicio {
  mes: number;
  semana: number;
  /** Fila en la pestaña del mes (base 1). */
  fila: number;
  /** aaaa-mm-dd, o null si la planilla no trae fecha. */
  fecha: string | null;
  cliente: string | null;
  pagado: boolean | null;
  horas: number | null;
  horasInferidas: boolean;
  horario: string | null;
  operaria: string | null;
  operariaPagada: boolean | null;
  salario: number | null;
  movilidad: number | null;
  /** Pago a la operaria por el servicio (columna K, o I + J si K está vacío). */
  pago: number | null;
  precio: number | null;
  tipoPrecio: TipoPrecio;
  tipoCliente: TipoCliente;
  origenTipoPrecio: OrigenTipo;
  origenTipoCliente: OrigenTipo;
  /** Fecha ≤ hoy; sin fecha solo cuenta como realizado si el mes ya cerró. */
  realizado: boolean;
}

/** Fila de la tabla de servicios que es un pago de sueldo fijo, no un servicio. */
export interface PagoSueldo {
  mes: number;
  semana: number;
  fila: number;
  concepto: string;
  operaria: string | null;
  salario: number | null;
  movilidad: number | null;
  total: number | null;
}

export interface FilaComision {
  operaria: string;
  salario: number | null;
  movilidad: number | null;
  total: number | null;
  fila: number;
}

export interface PanelMes {
  cajaChica: { valor: number | null; celda: string | null };
  comision: FilaComision[];
  /** Solo referencia de control, no fuente. */
  salarioTotalMesAnterior: number | null;
  proyeccionGanancias: number | null;
}

export interface MesCrudo {
  mes: number;
  pestana: string;
  servicios: Servicio[];
  pagosSueldo: PagoSueldo[];
  panel: PanelMes;
}

export interface FilaDetalle {
  fila: number;
  concepto: string | null;
  valor: number | null;
  obs: string | null;
}

export interface BloqueDetalle {
  mes: number;
  /** Rango de la columna VALOR, ej. "Q6:Q21". */
  rango: string;
  filas: FilaDetalle[];
  /** Σ de la columna VALOR; null si el bloque no tiene ningún valor cargado. */
  suma: number | null;
  /** Celda TOTAL del propio bloque (control). */
  totalCelda: number | null;
}

/** Valores por mes, índice 0 = enero. */
export type PorMes = (number | null)[];

export interface FlujoCaja {
  cajaInicial: PorMes;
  gananciaBruta: PorMes;
  gananciaReal: PorMes;
  cajaCierre: PorMes;
  conversion: PorMes;
  totalIngresos: PorMes;
  totalGastos: PorMes;
  flujoReal: PorMes;
}

export interface ClienteBase {
  tipoPrecio: TipoPrecio;
  tipoCliente: TipoCliente;
}

export interface FinMes {
  mes: number;
  cerrado: boolean;
  enCurso: boolean;
  ingresos: number | null;
  gastos: number | null;
  rrhh: number | null;
  /** Ingresos − Gastos. */
  ganancia: number | null;
  /** Ingresos − RR. HH. */
  gananciaBruta: number | null;
  /** Ganancia / Ingresos (fracción, no porcentaje). */
  rentabilidad: number | null;
  categorias: { categoria: string; valor: number }[];
  cajaInicial: number | null;
  cajaCierre: number | null;
  fuente: { ingresos: string | null; gastos: string | null };
  /** Valores de la planilla, solo para control cruzado y para el ⓘ. */
  planilla: { gananciaReal: number | null; conversion: number | null; gananciaBruta: number | null };
}

export interface Agregado {
  promedio: number | null;
  total: number | null;
  /** Total de meses cerrados + mes en curso. */
  acumulado: number | null;
}

export interface Financiero {
  meses: FinMes[];
  /** Meses cerrados con ingresos y gastos cargados (los que entran en promedios y totales). */
  mesesCerrados: number[];
  ingresos: Agregado;
  gastos: Agregado;
  rrhh: Agregado;
  ganancia: Agregado;
  gananciaBruta: Agregado;
  /** Promedio simple de la rentabilidad mensual de los meses cerrados. */
  rentabilidadPromedio: number | null;
}

export interface OpTotales {
  cargados: number;
  realizados: number;
  agendados: number;
  /** Unidades ponderadas (horas ÷ 4) de servicios realizados. */
  unidades: number;
  unidadesCargadas: number;
  horas: number;
  horasCargadas: number;
  /** Σ N de todos los servicios cargados / de los realizados. */
  precioCargado: number;
  precioRealizado: number;
  /** Σ K de todos los servicios cargados / de los realizados. */
  pagoCargado: number;
  pagoRealizado: number;
  salario: number;
  movilidad: number;
}

export interface OpSemana extends OpTotales {
  semana: number;
}

export interface OpOperaria extends OpTotales {
  operaria: string;
  modalidad: 'Por servicio' | 'Sueldo fijo';
  /** Lo que cobra en el mes: Σ I/J/K, o la fila del panel COMISION si es sueldo fijo (null = Sin dato). */
  salarioMes: number | null;
  movilidadMes: number | null;
  totalMes: number | null;
  gsPorHora: number | null;
  semanas: OpSemana[];
}

export interface OpMes extends OpTotales {
  mes: number;
  pestana: string;
  cerrado: boolean;
  enCurso: boolean;
  semanas: OpSemana[];
  operarias: OpOperaria[];
  sinFecha: number;
  sinPrecio: number;
  sinOperaria: number;
  sinHoras: number;
  horasInferidas: number;
  pagosSueldo: PagoSueldo[];
  cajaChica: { valor: number | null; celda: string | null };
}

export type AvisoTipo =
  | 'pestanas'
  | 'ingresos-control'
  | 'gastos-control'
  | 'ganancia-control'
  | 'rrhh-control'
  | 'sin-fecha'
  | 'sin-precio'
  | 'sin-operaria'
  | 'sin-horas'
  | 'sin-cliente'
  | 'horas-inferidas'
  | 'pago-sueldo'
  | 'nombre-unificado'
  | 'nombre-nuevo'
  | 'sin-clasificar'
  | 'estructura'
  | 'caja-control';

export interface Aviso {
  tipo: AvisoTipo;
  nivel: 'info' | 'aviso' | 'error';
  pestana: string;
  mes?: number;
  fila?: number;
  mensaje: string;
}

/** Una línea con valor de las tablas de detalle de INGRESOS o GASTOS. */
export interface LineaDetalle {
  mes: number;
  /** Celda de la columna VALOR, ej. "Q27". */
  celda: string;
  concepto: string;
  /** Concepto normalizado (categoría de gasto o concepto de ingreso). */
  categoria: string;
  valor: number;
  /** Texto de la columna OBS / COMENTARIO / FECHA / MES; null si está vacía. */
  obs: string | null;
}

export interface Dataset {
  version: 1;
  anio: number;
  /** aaaa-mm-dd según America/Asuncion. */
  hoy: string;
  /** Mes en curso (1–12) si el archivo es del año actual; si no, null. */
  mesEnCurso: number | null;
  financiero: Financiero;
  operativo: OpMes[];
  servicios: Servicio[];
  flujo: FlujoCaja;
  salud: Aviso[];
  pestanas: { detectadas: string[]; ignoradas: string[] };
  /** Líneas con valor del detalle de INGRESOS y GASTOS (para ver en qué y por qué). */
  detalle: { ingresos: LineaDetalle[]; gastos: LineaDetalle[] };
}
