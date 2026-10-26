import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirDataset, leerLibro, type Dataset, type LibroCrudo } from '../lib/engine';
import { rendimiento, sueldoFijoDelMes, vistaAnterior } from '../lib/engine/metrics-rendimiento';

const fixture = existsSync('fixtures') ? readdirSync('fixtures').find((f) => f.endsWith('.xlsx')) : undefined;
const suma = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const HOY = '2026-10-12';

describe.skipIf(!fixture)('Rendimiento por operaria (lógica sobre la copia local)', () => {
  let libro: LibroCrudo;
  let d: Dataset;
  beforeAll(() => {
    libro = leerLibro(readFileSync(join('fixtures', fixture!)));
    d = construirDataset({ libro, anio: 2026, hoy: HOY });
  });
  const vista = (mes: number, semana: number | null = null, conAgendados = false, mostrarSinActividad = false) => ({ mes, semana, conAgendados, mostrarSinActividad });

  it('unidades = horas ÷ 4, ocupación = unidades ÷ alcanzables (48 por mes, 12 por semana)', () => {
    for (const v of [vista(9), vista(9, 2), vista(10, 1, true)]) {
      const r = rendimiento(d, v);
      for (const f of r.filas) {
        expect(f.alcanzables).toBe(v.semana === null ? 48 : 12);
        expect(f.unidades).toBeCloseTo(f.horas / 4, 9);
        expect(f.ocupacion).toBeCloseTo(f.unidades / f.alcanzables, 9);
      }
    }
  });

  it('cada fila suma exactamente los servicios de esa operaria en el período', () => {
    const r = rendimiento(d, vista(9));
    for (const f of r.filas) {
      const ss = d.servicios.filter((s) => s.mes === 9 && s.realizado && s.operaria === f.operaria);
      expect(f.servicios).toBe(ss.length);
      expect(f.ingreso).toBe(suma(ss.map((s) => s.precio)));
      expect(f.sinPrecio.length).toBe(ss.filter((s) => s.precio === null).length);
      if (!f.fija) expect(f.salario).toBe(suma(ss.map((s) => s.pago)));
      if (f.salario !== null) expect(f.diferencia).toBe(f.ingreso - f.salario);
    }
    // Todos los servicios con operaria quedan en alguna fila; los sin operaria se informan aparte.
    const conOperaria = d.servicios.filter((s) => s.mes === 9 && s.realizado && s.operaria).length;
    expect(suma(r.filas.map((f) => f.servicios))).toBe(conOperaria);
    expect(r.sinAsignar).toBe(d.servicios.filter((s) => s.mes === 9 && s.realizado && !s.operaria).length);
  });

  it('fila TOTAL: sumas de cada columna y ocupación total = Σ unidades ÷ Σ alcanzables', () => {
    const r = rendimiento(d, vista(8));
    expect(r.total.alcanzables).toBe(48 * r.filas.length);
    expect(r.total.unidades).toBeCloseTo(suma(r.filas.map((f) => f.unidades)), 9);
    expect(r.total.ocupacion).toBeCloseTo(r.total.unidades / r.total.alcanzables, 12);
    expect(r.total.salario).toBe(suma(r.filas.map((f) => f.salario)));
    expect(r.total.ingreso).toBe(suma(r.filas.map((f) => f.ingreso)));
    expect(r.total.diferencia).toBe(r.total.ingreso - r.total.salario!);
  });

  it('sueldo fijo en mes cerrado: Total del panel COMISION, sin sumar los K de sus filas de servicio', () => {
    const r = rendimiento(d, vista(8));
    for (const nombre of ['Gloria', 'Judith']) {
      const f = r.filas.find((x) => x.operaria === nombre)!;
      const panel = d.operativo.find((m) => m.mes === 8)!.operarias.find((o) => o.operaria === nombre)!;
      expect(f.fija).toBe(true);
      expect(f.origenSalario).toBe('panel');
      expect(f.salario).toBe(panel.totalMes);
      expect(f.kNoSumado).toBe(suma(d.servicios.filter((s) => s.mes === 8 && s.realizado && s.operaria === nombre).map((s) => s.pago)));
    }
  });

  it('sueldo fijo en mes en curso: estimado con el último mes cerrado; respaldo de config si el panel no lo trae', () => {
    const r = rendimiento(d, vista(10));
    const gloria = r.filas.find((x) => x.operaria === 'Gloria')!;
    expect(gloria.origenSalario).toBe('estimado');
    expect(gloria.mesSueldo).toBe(9);
    expect(gloria.salario).toBe(d.operativo.find((m) => m.mes === 9)!.operarias.find((o) => o.operaria === 'Gloria')!.totalMes);
    // Sin panel en ningún mes cerrado previo, se usa el respaldo configurado.
    const sinPanel = { ...d, operativo: d.operativo.map((m) => ({ ...m, operarias: m.operarias.map((o) => (o.operaria === 'Judith' ? { ...o, totalMes: null } : o)) })) };
    expect(sueldoFijoDelMes(sinPanel, 'Judith', 10)).toEqual({ monto: 3_044_000, origen: 'respaldo', mesSueldo: null });
  });

  it('vista semanal: el sueldo fijo es el mensual ÷ 4 y las 4 semanas suman el sueldo completo', () => {
    const mensual = rendimiento(d, vista(9)).filas.find((x) => x.operaria === 'Judith')!.salario!;
    const semanas = [1, 2, 3, 4].map((s) => rendimiento(d, vista(9, s)).filas.find((x) => x.operaria === 'Judith')!.salario!);
    semanas.forEach((s) => expect(s).toBe(mensual / 4));
    expect(suma(semanas)).toBe(mensual);
    // Las semanas de una operaria por servicio suman su mes.
    const op = rendimiento(d, vista(9)).filas.find((x) => !x.fija && x.servicios > 5)!;
    const porSemana = [1, 2, 3, 4].map((s) => rendimiento(d, vista(9, s)).filas.find((x) => x.operaria === op.operaria)?.salario ?? 0);
    expect(suma(porSemana)).toBe(op.salario);
  });

  it('listado: con actividad + sueldo fijo siempre; "mostrar sin actividad" agrega el resto del año', () => {
    const r = rendimiento(d, vista(9, 1));
    for (const f of r.filas) expect(f.servicios > 0 || f.fija).toBe(true);
    expect(r.filas.map((f) => f.operaria)).toEqual(expect.arrayContaining(['Gloria', 'Judith']));
    const todas = rendimiento(d, vista(9, 1, false, true));
    expect(todas.filas.length).toBeGreaterThan(r.filas.length);
    // Judith es de sueldo fijo desde mayo: en abril se lista solo si tuvo servicios, como cualquier otra.
    const abril = rendimiento(d, vista(4));
    expect(abril.filas.find((f) => f.operaria === 'Judith')?.fija ?? false).toBe(false);
  });

  it('"Incluir agendados" suma los servicios con fecha futura del mes en curso', () => {
    const sin = rendimiento(d, vista(10));
    const con = rendimiento(d, vista(10, null, true));
    const agendados = d.servicios.filter((s) => s.mes === 10 && !s.realizado && s.operaria).length;
    expect(con.total.servicios - sin.total.servicios).toBe(agendados);
    expect(con.incluyeAgendados).toBe(d.servicios.some((s) => s.mes === 10 && !s.realizado));
    expect(sin.incluyeAgendados).toBe(false);
  });

  it('orden por defecto: diferencia de mayor a menor', () => {
    const r = rendimiento(d, vista(9));
    const difs = r.filas.map((f) => f.diferencia ?? -Infinity);
    expect(difs.every((x, i) => i === 0 || difs[i - 1] >= x)).toBe(true);
  });

  it('período anterior: mes previo, semana previa, y la Semana 1 contra la Semana 4 del mes anterior', () => {
    expect(vistaAnterior(d, vista(9))).toMatchObject({ mes: 8, semana: null });
    expect(vistaAnterior(d, vista(9, 3))).toMatchObject({ mes: 9, semana: 2 });
    expect(vistaAnterior(d, vista(9, 1))).toMatchObject({ mes: 8, semana: 4 });
    expect(vistaAnterior(d, vista(1))).toBeNull();
  });

  it('Salud de datos registra los montos K en filas de sueldo fijo', () => {
    const avisos = d.salud.filter((a) => a.tipo === 'sueldo-fijo-k');
    for (const a of avisos) expect(a.mensaje).toMatch(/(Gloria|Judith) \(sueldo fijo\) tiene Gs\./);
    const conK = d.servicios.filter((s) => s.pago && s.operaria && (s.operaria === 'Gloria' ? s.mes >= 2 : s.operaria === 'Judith' ? s.mes >= 5 : false));
    expect(avisos.length).toBe(new Set(conK.map((s) => `${s.mes}-${s.operaria}`)).size);
  });
});
