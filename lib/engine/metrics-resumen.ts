import type { Dataset } from './types';

export interface ResumenSemana {
  semana: number;
  realizados: number;
  agendados: number;
  /** Σ N − Σ K de todos los servicios cargados del bloque. No incluye sueldos fijos ni otros gastos. */
  proyeccion: number;
  /** El bloque todavía tiene servicios agendados (o ninguno cargado): su proyección es una estimación. */
  estimada: boolean;
}

export interface Resumen {
  mes: number;
  enCurso: boolean;
  facturacion: number | null;
  promedioCerrados: number | null;
  rrhh: number | null;
  cajaChica: { valor: number | null; fuente: string };
  semanas: ResumenSemana[];
  realizados: number;
  agendados: number;
  /** Σ N de servicios realizados que el cliente todavía no pagó (D sin ✔). */
  porCobrar: number;
  serviciosPorCobrar: number;
  /** Σ K de servicios realizados que la operaria todavía no cobró (G sin ✔). */
  porPagar: number;
  serviciosPorPagar: number;
}

/** Mes que muestra el Resumen: el mes en curso, o el último con datos si el archivo es de otro año. */
export function mesDeResumen(d: Dataset): number | null {
  if (d.mesEnCurso && d.operativo.some((m) => m.mes === d.mesEnCurso)) return d.mesEnCurso;
  const conDatos = d.operativo.filter((m) => m.cargados > 0).map((m) => m.mes);
  return conDatos.length ? Math.max(...conDatos) : null;
}

export function calcularResumen(d: Dataset, mes: number): Resumen {
  const fin = d.financiero.meses[mes - 1];
  const op = d.operativo.find((m) => m.mes === mes);
  const servicios = d.servicios.filter((s) => s.mes === mes && s.realizado);
  const sinCobrar = servicios.filter((s) => s.pagado !== true && s.precio !== null);
  const sinPagar = servicios.filter((s) => s.operariaPagada !== true && !!s.pago);

  const panel = op?.cajaChica.valor ?? null;
  return {
    mes,
    enCurso: d.mesEnCurso === mes,
    facturacion: fin.ingresos,
    promedioCerrados: d.financiero.ingresos.promedio,
    rrhh: fin.rrhh,
    cajaChica:
      panel !== null
        ? { valor: panel, fuente: `${op!.pestana}!${op!.cajaChica.celda} (panel CAJA CHICA INICIAL MES)` }
        : { valor: fin.cajaCierre, fuente: 'FLUJO CAJA, fila CAJA AL CIERRE' },
    semanas: (op?.semanas ?? []).map((s) => ({
      semana: s.semana,
      realizados: s.realizados,
      agendados: s.agendados,
      proyeccion: s.precioCargado - s.pagoCargado,
      estimada: s.agendados > 0 || s.cargados === 0,
    })),
    realizados: op?.realizados ?? 0,
    agendados: op?.agendados ?? 0,
    porCobrar: sinCobrar.reduce((a, s) => a + (s.precio ?? 0), 0),
    serviciosPorCobrar: sinCobrar.length,
    porPagar: sinPagar.reduce((a, s) => a + (s.pago ?? 0), 0),
    serviciosPorPagar: sinPagar.length,
  };
}
