import { MESES, titulo } from './normalize';
import type { GastosCrudo } from './parse-gastos';
import type { IngresosCrudo } from './parse-ingresos';
import type { EsSueldoFijo } from './metrics-operativo';
import type { Aviso, Financiero, FlujoCaja, MesCrudo } from './types';

const gs = (n: number) => `Gs. ${Math.round(n).toLocaleString('es-PY')}`;
const nombreMes = (mes: number) => titulo(MESES[mes - 1]);

/** Controles cruzados entre fuentes. Informan la diferencia; nunca corrigen ni fuerzan un valor. */
export function controlesCruzados(
  fin: Financiero,
  ingresos: IngresosCrudo,
  gastos: GastosCrudo,
  flujo: FlujoCaja,
  meses: MesCrudo[],
  esSueldoFijo: EsSueldoFijo,
): Aviso[] {
  const avisos: Aviso[] = [];
  const comparar = (
    tipo: Aviso['tipo'],
    pestana: string,
    mes: number,
    que: string,
    propio: number | null,
    otro: number | null,
    contra: string,
  ) => {
    if (propio === null || otro === null || Math.abs(propio - otro) < 1) return;
    avisos.push({
      tipo,
      nivel: 'aviso',
      pestana,
      mes,
      mensaje: `${nombreMes(mes)}: ${que} ${gs(propio)} ≠ ${contra} ${gs(otro)} (diferencia ${gs(propio - otro)}).`,
    });
  };

  for (const m of fin.meses) {
    const i = m.mes - 1;
    comparar('ingresos-control', 'INGRESOS', m.mes, 'detalle', m.ingresos, ingresos.resumen[i], 'resumen izquierdo');
    comparar('ingresos-control', 'INGRESOS', m.mes, 'detalle', m.ingresos, flujo.totalIngresos[i], 'FLUJO CAJA');
    comparar('ingresos-control', 'INGRESOS', m.mes, 'Σ VALOR', m.ingresos, ingresos.detalle.get(m.mes)?.totalCelda ?? null, 'celda TOTAL del bloque');
    comparar('gastos-control', 'GASTOS', m.mes, 'detalle', m.gastos, gastos.resumen[i], 'resumen izquierdo');
    comparar('gastos-control', 'GASTOS', m.mes, 'detalle', m.gastos, flujo.totalGastos[i], 'FLUJO CAJA');
    comparar('gastos-control', 'GASTOS', m.mes, 'Σ VALOR', m.gastos, gastos.detalle.get(m.mes)?.totalCelda ?? null, 'celda TOTAL del bloque');
    comparar('ganancia-control', 'FLUJO CAJA', m.mes, 'ganancia calculada', m.ganancia, m.planilla.gananciaReal, 'GANANCIA REAL');
    if (m.rentabilidad !== null && m.planilla.conversion !== null && Math.abs(m.rentabilidad - m.planilla.conversion) > 0.0005) {
      avisos.push({
        tipo: 'ganancia-control',
        nivel: 'aviso',
        pestana: 'FLUJO CAJA',
        mes: m.mes,
        mensaje: `${nombreMes(m.mes)}: rentabilidad calculada ${(m.rentabilidad * 100).toFixed(1)} % ≠ CONVERSION ${(m.planilla.conversion * 100).toFixed(1)} %.`,
      });
    }
    // Montos numéricos fuera de la columna VALOR: no se suman, pero conviene que Matías los vea.
    for (const f of gastos.detalle.get(m.mes)?.filas ?? []) {
      if (f.valor === null && f.obs !== null && /^\d[\d.,]*$/.test(f.obs)) {
        avisos.push({
          tipo: 'gastos-control',
          nivel: 'aviso',
          pestana: 'GASTOS',
          mes: m.mes,
          fila: f.fila,
          mensaje: `${nombreMes(m.mes)}: "${f.concepto ?? 'sin concepto'}" tiene ${gs(Number(f.obs))} en la columna de comentarios y nada en VALOR: no se suma.`,
        });
      }
    }
  }

  // Coherencia de caja: Caja inicial + Ganancia real = Caja al cierre (FLUJO CAJA).
  for (const m of fin.meses) {
    if (m.cajaInicial === null || m.cajaCierre === null || m.ganancia === null) continue;
    const esperado = m.cajaInicial + m.ganancia;
    if (Math.abs(esperado - m.cajaCierre) < 1) continue;
    avisos.push({
      tipo: 'caja-control',
      nivel: 'aviso',
      pestana: 'FLUJO CAJA',
      mes: m.mes,
      mensaje: `${nombreMes(m.mes)}: caja inicial ${gs(m.cajaInicial)} + ganancia real ${gs(m.ganancia)} = ${gs(esperado)}, pero CAJA AL CIERRE dice ${gs(m.cajaCierre)} (diferencia ${gs(m.cajaCierre - esperado)}).`,
    });
  }

  // Control RR. HH.: Σ K de operarias por servicio + sueldos fijos del panel ≈ RECURSOS HUMANOS de GASTOS.
  for (const mc of meses) {
    const m = fin.meses[mc.mes - 1];
    if (!m.cerrado || m.rrhh === null) continue;
    const porServicio = mc.servicios.filter((s) => !(s.operaria && esSueldoFijo(s.operaria, mc.mes))).reduce((a, s) => a + (s.pago ?? 0), 0);
    const fijos = mc.panel.comision.filter((f) => esSueldoFijo(f.operaria, mc.mes)).reduce((a, f) => a + (f.total ?? 0), 0);
    const dif = m.rrhh - (porServicio + fijos);
    avisos.push({
      tipo: 'rrhh-control',
      nivel: Math.abs(dif) < 1 ? 'info' : 'aviso',
      pestana: mc.pestana,
      mes: mc.mes,
      mensaje:
        `${nombreMes(mc.mes)}: pago por servicio ${gs(porServicio)} + sueldos fijos ${gs(fijos)} = ${gs(porServicio + fijos)}; ` +
        `RECURSOS HUMANOS en GASTOS ${gs(m.rrhh)}` +
        (Math.abs(dif) < 1 ? ' ✔' : ` (diferencia ${gs(dif)})`) +
        '.',
    });
  }
  return avisos;
}
