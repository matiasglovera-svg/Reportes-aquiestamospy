import {
  booleano,
  celdaRef,
  fechaISO,
  horasDesdeTexto,
  letraCol,
  normTexto,
  numero,
  texto,
  tipoClienteDesde,
  tipoPrecioDesde,
  type Resolutor,
} from './normalize';
import type { Aviso, Celda, ClienteBase, FilaComision, Hoja, MesCrudo, PanelMes, Servicio } from './types';

/** La tabla de servicios ocupa A–U; de V en adelante es el panel. */
const ULTIMA_COL_SERVICIOS = 20;
const FILAS_PANEL = 130;

/** Posición por letra (referencia / respaldo cuando el encabezado no aparece). */
const RESPALDO = {
  fecha: 1,
  cliente: 2,
  pagado: 3,
  horas: 4,
  horario: 5,
  operariaPagada: 6,
  operaria: 7,
  salario: 8,
  movilidad: 9,
  total: 10,
  precio: 13,
  tipoPrecio: 17,
  tipoCliente: 18,
};
type Columnas = typeof RESPALDO;

const ENCABEZADOS: Record<keyof Columnas, (t: string) => boolean> = {
  fecha: (t) => t === 'FECHA',
  cliente: (t) => t === 'NOMBRE COMPLETO',
  pagado: (t) => t === 'STATUS PAGO',
  horas: (t) => t === 'HORAS TRABAJADAS',
  horario: (t) => t === 'HORARIO',
  operariaPagada: (t) => t === 'STATUS PROFESIONALES',
  operaria: (t) => t === 'PROFESIONAL',
  salario: (t) => t.startsWith('SALARIO'),
  movilidad: (t) => t.startsWith('MOVILIDAD'),
  total: (t) => t.startsWith('TOTAL'),
  precio: (t) => t.startsWith('PRECIO FINAL'),
  tipoPrecio: (t) => t === 'TIPO PRECIO',
  tipoCliente: (t) => t === 'TIPO CLIENTE',
};

function esEncabezado(fila: Celda[]): boolean {
  for (let c = 0; c <= ULTIMA_COL_SERVICIOS && c < fila.length; c++) {
    if (normTexto(fila[c]) === 'NOMBRE COMPLETO') return true;
  }
  return false;
}

function mapearEncabezado(fila: Celda[]): { cols: Columnas; faltantes: (keyof Columnas)[] } {
  const cols = { ...RESPALDO };
  const faltantes: (keyof Columnas)[] = [];
  const max = Math.min(fila.length - 1, ULTIMA_COL_SERVICIOS);
  for (const clave of Object.keys(ENCABEZADOS) as (keyof Columnas)[]) {
    let hallada = -1;
    for (let c = 0; c <= max && hallada < 0; c++) {
      const t = normTexto(fila[c]);
      if (t && ENCABEZADOS[clave](t)) hallada = c;
    }
    if (hallada >= 0) cols[clave] = hallada;
    else faltantes.push(clave);
  }
  return { cols, faltantes };
}

export interface ContextoMes {
  mes: number;
  pestana: string;
  hoy: string;
  mesCerrado: boolean;
  clientes: Map<string, ClienteBase>;
  resolverOperaria: Resolutor;
  resolverCliente: Resolutor;
  patronPagoSueldo: RegExp;
  avisos: Aviso[];
}

export function parseMes(hoja: Hoja, ctx: ContextoMes): MesCrudo {
  const { mes, pestana, avisos } = ctx;
  const aviso = (a: Omit<Aviso, 'pestana' | 'mes'>) => avisos.push({ ...a, pestana, mes });
  const out: MesCrudo = { mes, pestana, servicios: [], pagosSueldo: [], panel: parsePanel(hoja, ctx) };

  const operaria = (crudo: string | null, fila: number): string | null => {
    if (!crudo) return null;
    const r = ctx.resolverOperaria(crudo);
    if (r.unificadoAuto) {
      aviso({ tipo: 'nombre-unificado', nivel: 'aviso', fila, mensaje: `Operaria "${crudo}" unificada automáticamente con "${r.nombre}".` });
    } else if (r.nuevo) {
      aviso({ tipo: 'nombre-nuevo', nivel: 'info', fila, mensaje: `Operaria nueva detectada: "${r.nombre}".` });
    }
    return r.nombre;
  };

  let semana = 0;
  let cols = RESPALDO;
  for (let r = 0; r < hoja.length; r++) {
    const fila = hoja[r] ?? [];
    const nFila = r + 1;

    const marca = normTexto(fila[0]).match(/^SEMANA\s*(\d+)/);
    if (marca) {
      semana = +marca[1];
      continue;
    }
    if (esEncabezado(fila)) {
      const m = mapearEncabezado(fila);
      cols = m.cols;
      if (semana && m.faltantes.length) {
        aviso({
          tipo: 'estructura',
          nivel: 'info',
          fila: nFila,
          mensaje: `Semana ${semana}: encabezado no encontrado para ${m.faltantes
            .map((k) => `${k} (se usa columna ${letraCol(RESPALDO[k])})`)
            .join(', ')}.`,
        });
      }
      continue;
    }
    if (!semana) continue;

    const clienteCrudo = texto(fila[cols.cliente]);
    const operariaCruda = texto(fila[cols.operaria]);
    const fecha = fechaISO(fila[cols.fecha]);
    // Sin cliente solo es servicio si la fila tiene fecha y operaria (las filas de subtotales no tienen ninguna).
    if (!clienteCrudo && !(operariaCruda && fecha)) continue;
    if (clienteCrudo && normTexto(clienteCrudo).startsWith('TOTAL')) continue;

    const salario = numero(fila[cols.salario]);
    const movilidad = numero(fila[cols.movilidad]);
    const k = numero(fila[cols.total]);
    const pago = k ?? (salario !== null || movilidad !== null ? (salario ?? 0) + (movilidad ?? 0) : null);
    const precio = numero(fila[cols.precio]);

    const eCruda = fila[cols.horas];
    const horario = texto(fila[cols.horario]);
    let horas = typeof eCruda === 'number' && eCruda > 0 ? eCruda : null;
    let horasInferidas = false;
    if (horas === null) {
      horas = horasDesdeTexto(texto(eCruda)) ?? horasDesdeTexto(horario);
      horasInferidas = horas !== null;
    }

    if (clienteCrudo && precio === null && horas === null && ctx.patronPagoSueldo.test(normTexto(clienteCrudo))) {
      const nombre = operaria(operariaCruda, nFila);
      out.pagosSueldo.push({ mes, semana, fila: nFila, concepto: clienteCrudo, operaria: nombre, salario, movilidad, total: pago });
      aviso({
        tipo: 'pago-sueldo',
        nivel: 'info',
        fila: nFila,
        mensaje: `"${clienteCrudo}" (${nombre ?? 'sin operaria'}) es un pago de sueldo, no un servicio: no se cuenta como servicio.`,
      });
      continue;
    }

    const cliente = clienteCrudo ? ctx.resolverCliente(clienteCrudo).nombre : null;
    const base = clienteCrudo ? ctx.clientes.get(normTexto(clienteCrudo)) : undefined;
    const tpFila = tipoPrecioDesde(fila[cols.tipoPrecio]);
    const tcFila = tipoClienteDesde(fila[cols.tipoCliente]);
    const tpBase = base && base.tipoPrecio !== 'Sin clasificar' ? base.tipoPrecio : null;
    const tcBase = base && base.tipoCliente !== 'Sin clasificar' ? base.tipoCliente : null;

    const s: Servicio = {
      mes,
      semana,
      fila: nFila,
      fecha,
      cliente,
      pagado: booleano(fila[cols.pagado]),
      horas,
      horasInferidas,
      horario,
      operaria: operaria(operariaCruda, nFila),
      operariaPagada: booleano(fila[cols.operariaPagada]),
      salario,
      movilidad,
      pago,
      precio,
      tipoPrecio: tpFila ?? tpBase ?? 'Sin clasificar',
      tipoCliente: tcFila ?? tcBase ?? 'Sin clasificar',
      origenTipoPrecio: tpFila ? 'fila' : tpBase ? 'bbdd' : 'ninguno',
      origenTipoCliente: tcFila ? 'fila' : tcBase ? 'bbdd' : 'ninguno',
      realizado: fecha ? fecha <= ctx.hoy : ctx.mesCerrado,
    };
    out.servicios.push(s);

    const quien = `${cliente ?? 'Sin nombre'} / ${s.operaria ?? 'Sin asignar'}`;
    if (!cliente) aviso({ tipo: 'sin-cliente', nivel: 'aviso', fila: nFila, mensaje: `Servicio sin nombre de cliente (${s.operaria}, ${fecha}).` });
    if (!fecha) aviso({ tipo: 'sin-fecha', nivel: 'aviso', fila: nFila, mensaje: `Servicio sin fecha (${quien}).` });
    if (precio === null) aviso({ tipo: 'sin-precio', nivel: 'aviso', fila: nFila, mensaje: `Servicio sin precio (${quien}).` });
    if (!s.operaria) aviso({ tipo: 'sin-operaria', nivel: 'aviso', fila: nFila, mensaje: `Servicio sin operaria asignada (${cliente ?? 'Sin nombre'}).` });
    if (horas === null) aviso({ tipo: 'sin-horas', nivel: 'aviso', fila: nFila, mensaje: `Servicio sin horas ni horario (${quien}).` });
    else if (horasInferidas) aviso({ tipo: 'horas-inferidas', nivel: 'info', fila: nFila, mensaje: `Horas inferidas del horario: ${horas} h (${quien}).` });
    if (s.origenTipoPrecio === 'ninguno' || s.origenTipoCliente === 'ninguno') {
      const que = [s.origenTipoPrecio === 'ninguno' && 'tipo de precio', s.origenTipoCliente === 'ninguno' && 'tipo de cliente'].filter(Boolean).join(' y ');
      aviso({ tipo: 'sin-clasificar', nivel: 'info', fila: nFila, mensaje: `Sin clasificar (${que}): ${cliente ?? 'Sin nombre'}.` });
    }
  }
  return out;
}

/** Panel derecho: se ubica por títulos porque su columna se corre entre meses. */
function parsePanel(hoja: Hoja, ctx: ContextoMes): PanelMes {
  const panel: PanelMes = { cajaChica: { valor: null, celda: null }, comision: [], salarioTotalMesAnterior: null, proyeccionGanancias: null };
  const vistos = new Set<string>();
  const primera = (clave: string) => !vistos.has(clave) && !!vistos.add(clave);

  for (let r = 0; r < Math.min(hoja.length, FILAS_PANEL); r++) {
    const fila = hoja[r] ?? [];
    for (let c = ULTIMA_COL_SERVICIOS; c < fila.length; c++) {
      const t = normTexto(texto(fila[c]));
      if (!t) continue;
      if (t === 'CAJA CHICA INICIAL MES' && primera('caja')) {
        const v = numero(hoja[r + 2]?.[c]);
        panel.cajaChica = { valor: v, celda: celdaRef(r + 2, c) };
      } else if (t === 'PERSONAL DE LIMPIEZA (COMISION)' && primera('comision')) {
        panel.comision = parseComision(hoja, r, c, ctx);
      } else if (t === 'SALARIO TOTAL MES ANTERIOR' && primera('salAnt')) {
        panel.salarioTotalMesAnterior = numero(fila[c + 1]);
      } else if (t === 'PROYECCION DE GANANCIAS' && primera('proy')) {
        panel.proyeccionGanancias = numero(fila[c + 1]);
      }
    }
  }
  if (!vistos.has('caja')) ctx.avisos.push({ tipo: 'estructura', nivel: 'aviso', pestana: ctx.pestana, mes: ctx.mes, mensaje: 'No se encontró el título "CAJA CHICA INICIAL MES".' });
  if (!vistos.has('comision')) ctx.avisos.push({ tipo: 'estructura', nivel: 'aviso', pestana: ctx.pestana, mes: ctx.mes, mensaje: 'No se encontró la tabla "PERSONAL DE LIMPIEZA (COMISION)".' });
  return panel;
}

function parseComision(hoja: Hoja, filaTitulo: number, col: number, ctx: ContextoMes): FilaComision[] {
  let h = -1;
  for (let r = filaTitulo + 1; r <= filaTitulo + 4 && h < 0; r++) if (normTexto(hoja[r]?.[col]) === 'PROFESIONAL') h = r;
  if (h < 0) return [];
  const enc = hoja[h];
  const buscar = (pref: string, respaldo: number) => {
    for (let c = col + 1; c <= col + 6; c++) if (normTexto(enc[c]).startsWith(pref)) return c;
    return respaldo;
  };
  const cSal = buscar('SALARIO', col + 1);
  const cMov = buscar('MOVILIDAD', col + 2);
  const cTot = buscar('TOTAL', col + 3);

  const filas: FilaComision[] = [];
  let vacias = 0;
  for (let r = h + 1; r < h + 40 && r < hoja.length && vacias < 3; r++) {
    const nombre = texto(hoja[r]?.[col]);
    if (!nombre) {
      vacias++;
      continue;
    }
    vacias = 0;
    const n = normTexto(nombre);
    if (n === 'TOTAL' || n.includes('PERSONAL DE LIMPIEZA')) break;
    const canonico = ctx.resolverOperaria(nombre).nombre;
    // La planilla a veces repite un nombre (ej. KATYA en agosto): vale la primera fila.
    if (filas.some((f) => f.operaria === canonico)) continue;
    filas.push({ operaria: canonico, salario: numero(hoja[r][cSal]), movilidad: numero(hoja[r][cMov]), total: numero(hoja[r][cTot]), fila: r + 1 });
  }
  return filas;
}
