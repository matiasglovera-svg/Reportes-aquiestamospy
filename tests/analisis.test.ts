import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirDataset, leerLibro, type Dataset } from '../lib/engine';
import { comparacionAlDia, diasHabiles, margenPorTipo, proyeccionCierre, puntoEquilibrio, rankingClientes, rankingOperarias, ticketPorMes, top } from '../lib/engine/metrics-analisis';
import { calcularResumen } from '../lib/engine/metrics-resumen';
import { todosLosReportes } from '../lib/reportes';

const fixture = existsSync('fixtures') ? readdirSync('fixtures').find((f) => f.endsWith('.xlsx')) : undefined;
const suma = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

describe('días hábiles (lunes a sábado)', () => {
  it('octubre 2026 tiene 27; al 12/10 van 10', () => {
    expect(diasHabiles(2026, 10, '2026-10-12')).toEqual({ total: 27, transcurridos: 10 });
    expect(diasHabiles(2026, 10, '2026-09-30').transcurridos).toBe(0);
    expect(diasHabiles(2026, 2, '2026-12-31')).toEqual({ total: 24, transcurridos: 24 });
  });
});

describe.skipIf(!fixture)('Resumen y Análisis sobre la copia local', () => {
  let d: Dataset;
  beforeAll(() => {
    d = construirDataset({ libro: leerLibro(readFileSync(join('fixtures', fixture!))), anio: 2026, hoy: '2026-10-12' });
  });

  it('resumen: semanas, proyección y pendientes salen de los servicios del mes', () => {
    const r = calcularResumen(d, 10);
    const ss = d.servicios.filter((s) => s.mes === 10);
    expect(suma(r.semanas.map((s) => s.realizados))).toBe(ss.filter((s) => s.realizado).length);
    expect(suma(r.semanas.map((s) => s.agendados))).toBe(ss.filter((s) => !s.realizado).length);
    expect(suma(r.semanas.map((s) => s.proyeccion))).toBe(suma(ss.map((s) => s.precio)) - suma(ss.map((s) => s.pago)));
    expect(r.porCobrar).toBe(suma(ss.filter((s) => s.realizado && s.pagado !== true).map((s) => s.precio)));
    expect(r.porPagar).toBe(suma(ss.filter((s) => s.realizado && s.operariaPagada !== true).map((s) => s.pago)));
    expect(r.facturacion).toBe(d.financiero.meses[9].ingresos);
    expect(r.semanas.every((s) => s.estimada === (s.agendados > 0 || s.realizados + s.agendados === 0))).toBe(true);
  });

  it('ticket = Σ N de realizados con precio ÷ su cantidad', () => {
    for (const m of ticketPorMes(d).meses) {
      const ss = d.servicios.filter((s) => s.mes === m.mes && s.realizado && s.precio !== null);
      expect(m.servicios).toBe(ss.length);
      if (ss.length) expect(m.ticket).toBeCloseTo(suma(ss.map((s) => s.precio)) / ss.length, 6);
    }
  });

  it('margen: el modo B excluye a las de sueldo fijo; el modo A reparte exactamente su sueldo', () => {
    for (const m of d.operativo.filter((x) => x.cerrado)) {
      const a = margenPorTipo(d, m.mes, 'A');
      const b = margenPorTipo(d, m.mes, 'B');
      const fijas = m.operarias.filter((o) => o.modalidad === 'Sueldo fijo');
      const deFijas = d.servicios.filter((s) => s.mes === m.mes && s.realizado && s.precio !== null && fijas.some((o) => o.operaria === s.operaria));
      expect(b.excluidosFijos).toBe(deFijas.length);
      expect(suma(a.tipos.map((t) => t.servicios)) + a.excluidosFijos).toBe(suma(b.tipos.map((t) => t.servicios)) + b.excluidosFijos);
      for (const t of a.tipos) expect(t.margen).toBeCloseTo(t.ingresos - t.costo, 6);

      // Costo extra del modo A = sueldo × (horas de sus servicios con precio ÷ horas realizadas en el mes).
      let esperado = 0;
      for (const o of fijas) {
        if (o.totalMes === null || !o.horas) continue;
        const horasConPrecio = suma(deFijas.filter((s) => s.operaria === o.operaria).map((s) => s.horas));
        esperado += (o.totalMes * horasConPrecio) / o.horas;
      }
      expect(suma(a.tipos.map((t) => t.costo)) - suma(b.tipos.map((t) => t.costo))).toBeCloseTo(esperado, 4);
    }
  });

  it('rankings: suman lo mismo que los servicios realizados y respetan el filtro', () => {
    const todos = rankingClientes(d, null);
    const realizados = d.servicios.filter((s) => s.realizado && s.cliente);
    expect(suma(todos.map((r) => r.servicios))).toBe(realizados.length);
    expect(suma(todos.map((r) => r.dinero))).toBe(suma(realizados.map((s) => s.precio)));
    const semanales = rankingClientes(d, 9, 'Semanal');
    expect(suma(semanales.map((r) => r.servicios))).toBe(d.servicios.filter((s) => s.mes === 9 && s.realizado && s.cliente && s.tipoCliente === 'Semanal').length);
    const t = top(todos, (r) => r.servicios);
    expect(t.length).toBeLessThanOrEqual(10);
    expect(t.every((r, i) => i === 0 || t[i - 1].servicios >= r.servicios)).toBe(true);

    const ops = rankingOperarias(d, 9);
    const sep = d.operativo.find((m) => m.mes === 9)!;
    expect(suma(ops.map((o) => o.unidades))).toBeCloseTo(sep.unidades - (sep.operarias.find((o) => o.operaria === 'Sin asignar')?.unidades ?? 0), 6);
    for (const o of ops) if (o.margen !== null) expect(o.margen).toBe(o.facturado - o.cobrado!);
  });

  it('proyección al cierre y punto de equilibrio siguen sus fórmulas', () => {
    const p = proyeccionCierre(d, 10)!;
    const oct = d.operativo.find((m) => m.mes === 10)!;
    expect(p.facturacionAgendada).toBe(oct.precioCargado);
    expect(p.facturacionRitmo).toBeCloseTo((oct.precioRealizado / p.dias.transcurridos) * p.dias.total, 6);
    expect(p.gasto.total).toBeCloseTo(oct.pagoCargado + p.gasto.sueldosFijos! + p.gasto.otros!, 6);
    expect(p.gananciaAgendada).toBeCloseTo(p.facturacionAgendada - p.gasto.total!, 6);

    const pe = puntoEquilibrio(d);
    expect(pe.costosFijos).toBeCloseTo(pe.otrosGastos! + pe.sueldosFijos!, 6);
    expect(pe.margenContribucion).toBeCloseTo(pe.ticket! - pe.pagoPromedio!, 6);
    expect(pe.servicios).toBeCloseTo(pe.costosFijos! / pe.margenContribucion!, 6);
    expect(pe.facturacion).toBeCloseTo(pe.servicios! * pe.ticket!, 4);
  });

  it('comparación al día: solo cuenta servicios hasta el mismo día en ambos meses', () => {
    const c = comparacionAlDia(d, 10)!;
    expect(c.dia).toBe(12);
    const hasta = (mes: number) => d.servicios.filter((s) => s.mes === mes && s.realizado && s.fecha && +s.fecha.slice(8) <= 12).length;
    expect(c.filas[0]).toMatchObject({ actual: hasta(10), anterior: hasta(9) });
  });

  it('exportar todo: cada reporte tiene filas con tantas celdas como columnas e ids únicos por período', () => {
    const reportes = todosLosReportes(d, { mes: 10, modoMargen: 'A', conAgendados: false });
    expect(reportes.length).toBeGreaterThan(25);
    for (const r of reportes) for (const f of r.filas) expect(f.length, r.titulo).toBe(r.columnas.length);
    expect(new Set(reportes.map((r) => `${r.titulo}|${r.periodo}`)).size).toBe(reportes.length);
  });
});
