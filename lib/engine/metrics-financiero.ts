import { CATEGORIA_RRHH, categoriaGasto, type GastosCrudo } from './parse-gastos';
import type { IngresosCrudo } from './parse-ingresos';
import type { Agregado, Financiero, FinMes, FlujoCaja } from './types';

export interface Periodo {
  /** El mes (1–12) ya terminó según la fecha de hoy. */
  cerrado: (mes: number) => boolean;
  mesEnCurso: number | null;
}

export function calcularFinanciero(ingresos: IngresosCrudo, gastos: GastosCrudo, flujo: FlujoCaja, periodo: Periodo): Financiero {
  const meses: FinMes[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const bi = ingresos.detalle.get(mes);
    const bg = gastos.detalle.get(mes);
    const ing = bi?.suma ?? null;
    const gas = bg?.suma ?? null;

    const porCategoria = new Map<string, number>();
    for (const f of bg?.filas ?? []) {
      if (f.valor === null) continue;
      const cat = categoriaGasto(f.concepto);
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + f.valor);
    }
    // Sin ninguna fila de RR. HH. con valor no hay dato; no se asume 0.
    const rrhh = porCategoria.get(CATEGORIA_RRHH) ?? null;
    const ganancia = ing !== null && gas !== null ? ing - gas : null;

    meses.push({
      mes,
      cerrado: periodo.cerrado(mes),
      enCurso: periodo.mesEnCurso === mes,
      ingresos: ing,
      gastos: gas,
      rrhh,
      ganancia,
      gananciaBruta: ing !== null && rrhh !== null ? ing - rrhh : null,
      rentabilidad: ganancia !== null && ing ? ganancia / ing : null,
      categorias: [...porCategoria].map(([categoria, valor]) => ({ categoria, valor })),
      cajaInicial: flujo.cajaInicial[mes - 1],
      cajaCierre: flujo.cajaCierre[mes - 1],
      fuente: { ingresos: bi ? `INGRESOS!${bi.rango}` : null, gastos: bg ? `GASTOS!${bg.rango}` : null },
      planilla: {
        gananciaReal: flujo.gananciaReal[mes - 1],
        conversion: flujo.conversion[mes - 1],
        gananciaBruta: flujo.gananciaBruta[mes - 1],
      },
    });
  }

  const cerrados = meses.filter((m) => m.cerrado && m.ingresos !== null && m.gastos !== null);
  const enCurso = meses.find((m) => m.enCurso);
  const agregar = (campo: 'ingresos' | 'gastos' | 'rrhh' | 'ganancia' | 'gananciaBruta'): Agregado => {
    const valores = cerrados.map((m) => m[campo]).filter((v): v is number => v !== null);
    if (!valores.length) return { promedio: null, total: null, acumulado: enCurso?.[campo] ?? null };
    const total = valores.reduce((a, b) => a + b, 0);
    return { promedio: total / valores.length, total, acumulado: total + (enCurso?.[campo] ?? 0) };
  };
  const rent = cerrados.map((m) => m.rentabilidad).filter((v): v is number => v !== null);

  return {
    meses,
    mesesCerrados: cerrados.map((m) => m.mes),
    ingresos: agregar('ingresos'),
    gastos: agregar('gastos'),
    rrhh: agregar('rrhh'),
    ganancia: agregar('ganancia'),
    gananciaBruta: agregar('gananciaBruta'),
    rentabilidadPromedio: rent.length ? rent.reduce((a, b) => a + b, 0) / rent.length : null,
  };
}
