import type { Periodo } from './metrics-financiero';
import type { MesCrudo, OpMes, OpOperaria, OpSemana, OpTotales, Servicio } from './types';

export const SIN_ASIGNAR = 'Sin asignar';
const SEMANAS = [1, 2, 3, 4];

function vacio(): OpTotales {
  return {
    cargados: 0,
    realizados: 0,
    agendados: 0,
    unidades: 0,
    unidadesCargadas: 0,
    horas: 0,
    horasCargadas: 0,
    precioCargado: 0,
    precioRealizado: 0,
    pagoCargado: 0,
    pagoRealizado: 0,
    salario: 0,
    movilidad: 0,
  };
}

/** Los servicios sin horas / precio / pago cuentan en cantidades y no aportan a esa suma. */
function sumar(t: OpTotales, s: Servicio): void {
  const h = s.horas ?? 0;
  t.cargados++;
  t.horasCargadas += h;
  t.unidadesCargadas += h / 4;
  t.precioCargado += s.precio ?? 0;
  t.pagoCargado += s.pago ?? 0;
  t.salario += s.salario ?? 0;
  t.movilidad += s.movilidad ?? 0;
  if (s.realizado) {
    t.realizados++;
    t.horas += h;
    t.unidades += h / 4;
    t.precioRealizado += s.precio ?? 0;
    t.pagoRealizado += s.pago ?? 0;
  } else {
    t.agendados++;
  }
}

function porSemana(servicios: Servicio[]): OpSemana[] {
  const semanas = [...new Set([...SEMANAS, ...servicios.map((s) => s.semana)])].sort((a, b) => a - b);
  return semanas.map((semana) => {
    const t: OpSemana = { semana, ...vacio() };
    for (const s of servicios) if (s.semana === semana) sumar(t, s);
    return t;
  });
}

export type EsSueldoFijo = (operaria: string, mes: number) => boolean;

export function calcularOperativo(meses: MesCrudo[], periodo: Periodo, esSueldoFijo: EsSueldoFijo): OpMes[] {
  return meses.map((m) => {
    const total = vacio();
    for (const s of m.servicios) sumar(total, s);

    const grupos = new Map<string, Servicio[]>();
    for (const s of m.servicios) {
      const k = s.operaria ?? SIN_ASIGNAR;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(s);
    }
    // Una operaria de sueldo fijo figura aunque no tenga servicios cargados si el panel le asigna un total.
    for (const f of m.panel.comision) {
      if (esSueldoFijo(f.operaria, m.mes) && f.total && !grupos.has(f.operaria)) grupos.set(f.operaria, []);
    }

    const operarias: OpOperaria[] = [...grupos].map(([operaria, servicios]) => {
      const t = vacio();
      for (const s of servicios) sumar(t, s);
      const fijo = operaria !== SIN_ASIGNAR && esSueldoFijo(operaria, m.mes);
      const panel = m.panel.comision.find((f) => f.operaria === operaria);
      // Sueldo fijo: vale la fila del panel; un total en 0 (mes sin cerrar) es "Sin dato", no 0.
      const conDato = fijo && !!panel?.total;
      const salarioMes = fijo ? (conDato ? panel!.salario : null) : t.salario;
      const movilidadMes = fijo ? (conDato ? panel!.movilidad : null) : t.movilidad;
      const totalMes = fijo ? (conDato ? panel!.total : null) : t.pagoCargado;
      return {
        operaria,
        modalidad: fijo ? 'Sueldo fijo' : 'Por servicio',
        ...t,
        salarioMes,
        movilidadMes,
        totalMes,
        gsPorHora: totalMes !== null && t.horasCargadas > 0 ? totalMes / t.horasCargadas : null,
        semanas: porSemana(servicios),
      };
    });
    operarias.sort((a, b) => b.unidadesCargadas - a.unidadesCargadas || a.operaria.localeCompare(b.operaria, 'es'));

    return {
      mes: m.mes,
      pestana: m.pestana,
      cerrado: periodo.cerrado(m.mes),
      enCurso: periodo.mesEnCurso === m.mes,
      ...total,
      semanas: porSemana(m.servicios),
      operarias,
      sinFecha: m.servicios.filter((s) => !s.fecha).length,
      sinPrecio: m.servicios.filter((s) => s.precio === null).length,
      sinOperaria: m.servicios.filter((s) => !s.operaria).length,
      sinHoras: m.servicios.filter((s) => s.horas === null).length,
      horasInferidas: m.servicios.filter((s) => s.horasInferidas).length,
      pagosSueldo: m.pagosSueldo,
      cajaChica: m.panel.cajaChica,
    };
  });
}
