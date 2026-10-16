import { ALIAS_CLIENTES, ALIAS_OPERARIAS, OPERARIAS_CONOCIDAS } from '../../config/aliases';
import { PATRON_PAGO_SUELDO, SUELDO_FIJO } from '../../config/staff';
import { controlesCruzados } from './data-health';
import { calcularFinanciero, type Periodo } from './metrics-financiero';
import { calcularOperativo, type EsSueldoFijo } from './metrics-operativo';
import { crearResolutor, mesDesdeTexto, normTexto } from './normalize';
import { parseClientes } from './parse-clientes';
import { parseFlujo } from './parse-flujo';
import { parseGastos } from './parse-gastos';
import { parseIngresos } from './parse-ingresos';
import { parseMes } from './parse-month';
import { esPestanaNecesaria } from './read-workbook';
import { categoriaGasto } from './parse-gastos';
import type { Aviso, BloqueDetalle, Dataset, Hoja, LibroCrudo, LineaDetalle, MesCrudo } from './types';

export interface Entrada {
  libro: LibroCrudo;
  /** Año del archivo. */
  anio: number;
  /** Fecha de hoy (aaaa-mm-dd) en America/Asuncion. */
  hoy: string;
  aliasOperarias?: Record<string, string[]>;
  operariasConocidas?: string[];
  aliasClientes?: Record<string, string[]>;
  sueldoFijo?: Record<string, { fijoDesde: string }>;
}

/** Motor puro: libro ya leído + fecha de hoy → dataset. Sin I/O ni reloj. */
export function construirDataset(e: Entrada): Dataset {
  const { libro, anio, hoy } = e;
  const avisos: Aviso[] = [];
  const hoja = (nombre: string): Hoja | undefined => {
    const real = Object.keys(libro.hojas).find((n) => normTexto(n) === nombre);
    if (!real) avisos.push({ tipo: 'pestanas', nivel: 'error', pestana: nombre, mensaje: `Falta la pestaña "${nombre}".` });
    return real ? libro.hojas[real] : undefined;
  };

  const anioHoy = +hoy.slice(0, 4);
  const mesHoy = +hoy.slice(5, 7);
  const periodo: Periodo = {
    cerrado: (mes) => anio < anioHoy || (anio === anioHoy && mes < mesHoy),
    mesEnCurso: anio === anioHoy ? mesHoy : null,
  };

  const sueldoFijo = e.sueldoFijo ?? SUELDO_FIJO;
  const desde = new Map(Object.entries(sueldoFijo).map(([n, v]) => [normTexto(n), v.fijoDesde]));
  const esSueldoFijo: EsSueldoFijo = (operaria, mes) => {
    const d = desde.get(normTexto(operaria));
    return !!d && `${anio}-${String(mes).padStart(2, '0')}` >= d;
  };

  const resolverOperaria = crearResolutor(e.aliasOperarias ?? ALIAS_OPERARIAS, e.operariasConocidas ?? OPERARIAS_CONOCIDAS, {
    autoUnificar: true,
    marcarNuevos: true,
  });
  const resolverCliente = crearResolutor(e.aliasClientes ?? ALIAS_CLIENTES, [], { autoUnificar: false, marcarNuevos: false });

  const clientes = parseClientes(hoja('BBDD CLIENTES') ?? []);
  const ingresos = parseIngresos(hoja('INGRESOS') ?? []);
  const gastos = parseGastos(hoja('GASTOS') ?? []);
  const flujo = parseFlujo(hoja('FLUJO CAJA') ?? []);

  const meses: MesCrudo[] = [];
  for (const [nombre, grilla] of Object.entries(libro.hojas)) {
    const mes = mesDesdeTexto(nombre);
    if (!mes) continue;
    meses.push(
      parseMes(grilla, {
        mes,
        pestana: nombre,
        hoy,
        mesCerrado: periodo.cerrado(mes),
        clientes,
        resolverOperaria,
        resolverCliente,
        patronPagoSueldo: PATRON_PAGO_SUELDO,
        avisos,
      }),
    );
  }
  meses.sort((a, b) => a.mes - b.mes);

  const financiero = calcularFinanciero(ingresos, gastos, flujo, periodo);
  const operativo = calcularOperativo(meses, periodo, esSueldoFijo);
  avisos.push(...controlesCruzados(financiero, ingresos, gastos, flujo, meses, esSueldoFijo));

  // Líneas del detalle con su comentario: la columna VALOR del rango es "Q6:Q21" → letra Q.
  const lineas = (bloques: Map<number, BloqueDetalle>, categorizar: (c: string | null) => string): LineaDetalle[] =>
    [...bloques.values()]
      .sort((a, b) => a.mes - b.mes)
      .flatMap((b) =>
        b.filas
          .filter((f) => f.valor !== null)
          .map((f) => ({ mes: b.mes, celda: `${b.rango.replace(/[0-9].*$/, '')}${f.fila}`, concepto: f.concepto ?? 'Sin concepto', categoria: categorizar(f.concepto), valor: f.valor!, obs: f.obs })),
      );

  return {
    version: 1,
    anio,
    hoy,
    mesEnCurso: periodo.mesEnCurso,
    financiero,
    operativo,
    servicios: meses.flatMap((m) => m.servicios),
    flujo,
    salud: avisos,
    pestanas: {
      detectadas: Object.keys(libro.hojas),
      ignoradas: libro.nombres.filter((n) => !esPestanaNecesaria(n)),
    },
    detalle: { ingresos: lineas(ingresos.detalle, (c) => normTexto(c) || 'SIN CONCEPTO'), gastos: lineas(gastos.detalle, categoriaGasto) },
  };
}

export { leerLibro } from './read-workbook';
export * from './types';
