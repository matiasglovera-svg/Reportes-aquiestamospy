import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirDataset, leerLibro, type Dataset, type LibroCrudo } from '../lib/engine';
import { cascada, lecturaAutomatica, matrizFlujo, periodoAnterior, resumenFlujo } from '../lib/engine/metrics-flujo';
import { normTexto } from '../lib/engine/normalize';
import { parseDetalle } from '../lib/engine/parse-detalle';

const fixture = existsSync('fixtures') ? readdirSync('fixtures').find((f) => f.endsWith('.xlsx')) : undefined;
const suma = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

describe.skipIf(!fixture)('Flujo de caja detallado (lógica sobre la copia local)', () => {
  let libro: LibroCrudo;
  let d: Dataset;
  beforeAll(() => {
    libro = leerLibro(readFileSync(join('fixtures', fixture!)));
    d = construirDataset({ libro, anio: 2026, hoy: '2026-10-12' });
  });

  it('las líneas de detalle son exactamente las filas con VALOR, con su comentario y su celda', () => {
    for (const [pestana, lineas] of [['GASTOS', d.detalle.gastos], ['INGRESOS', d.detalle.ingresos]] as const) {
      const bloques = parseDetalle(libro.hojas[pestana]);
      const filas = [...bloques.values()].flatMap((b) => b.filas.filter((f) => f.valor !== null).map((f) => ({ mes: b.mes, f })));
      expect(lineas.length).toBe(filas.length);
      for (const l of lineas) {
        const [, col, fila] = l.celda.match(/^([A-Z]+)(\d+)$/)!;
        const c = [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        expect(libro.hojas[pestana][+fila - 1][c]).toBe(l.valor);
        const original = filas.find((x) => x.mes === l.mes && x.f.fila === +fila)!;
        expect(l.obs).toBe(original.f.obs);
      }
    }
  });

  it('un mes: totales, categorías y ganancias coinciden con el módulo Financiero', () => {
    for (const m of d.financiero.meses.filter((x) => x.ingresos !== null)) {
      const r = resumenFlujo(d, { tipo: 'mes', mes: m.mes })!;
      expect(r.ingresos).toBe(m.ingresos);
      expect(r.gastos).toBe(m.gastos);
      expect(r.rrhh).toBe(m.rrhh);
      expect(r.gananciaBruta).toBe(m.gananciaBruta);
      expect(r.gananciaReal).toBe(m.ganancia);
      expect(r.cajaInicial).toBe(m.cajaInicial);
      expect(r.cajaCierre).toBe(m.cajaCierre);
      expect(suma(r.categorias.map((c) => c.valor))).toBe(m.gastos ?? 0);
      expect(suma(r.ingresosPorConcepto.map((c) => c.valor))).toBe(m.ingresos ?? 0);
      expect(r.categorias.every((c, i) => i === 0 || r.categorias[i - 1].valor >= c.valor)).toBe(true);
      for (const c of r.categorias) expect(suma(c.lineas.map((l) => l.valor))).toBe(c.valor);
      if (r.ingresos) expect(r.margenNeto).toBeCloseTo(r.gananciaReal! / r.ingresos, 12);
    }
  });

  it('acumulado: suma de meses cerrados; caja inicial del primero y caja al cierre del último', () => {
    const r = resumenFlujo(d, { tipo: 'acumulado' })!;
    const cerrados = d.financiero.mesesCerrados;
    expect(r.meses).toEqual(cerrados);
    expect(r.parcial).toBe(false);
    expect(r.ingresos).toBe(d.financiero.ingresos.total);
    expect(r.gastos).toBe(d.financiero.gastos.total);
    expect(r.cajaInicial).toBe(d.financiero.meses[cerrados[0] - 1].cajaInicial);
    expect(r.cajaCierre).toBe(d.financiero.meses[cerrados[cerrados.length - 1] - 1].cajaCierre);
    expect(r.etiqueta).toBe('Enero a Septiembre');
  });

  it('período anterior: mes previo, o acumulado hasta el penúltimo mes cerrado', () => {
    expect(periodoAnterior(d, { tipo: 'mes', mes: 9 })).toEqual({ tipo: 'mes', mes: 8 });
    expect(periodoAnterior(d, { tipo: 'mes', mes: 1 })).toBeNull();
    expect(periodoAnterior(d, { tipo: 'acumulado' })).toEqual({ tipo: 'acumulado', hasta: 8 });
    expect(resumenFlujo(d, { tipo: 'mes', mes: 10 })!.parcial).toBe(true);
  });

  it('cascada: cada paso arranca donde terminó el anterior y los subtotales miden la ganancia', () => {
    for (const p of [{ tipo: 'acumulado' as const }, { tipo: 'mes' as const, mes: 9 }, { tipo: 'mes' as const, mes: 3 }]) {
      const r = resumenFlujo(d, p)!;
      const pasos = cascada(r);
      expect(pasos[0]).toMatchObject({ clave: 'caja-inicial', desde: 0, hasta: r.cajaInicial });
      expect(pasos[pasos.length - 1]).toMatchObject({ clave: 'caja-cierre', desde: 0, hasta: r.cajaCierre });
      const movimientos = pasos.filter((x) => x.tipo === 'ingreso' || x.tipo === 'gasto');
      expect(movimientos[0].desde).toBe(r.cajaInicial);
      for (let i = 1; i < movimientos.length; i++) expect(movimientos[i].desde).toBeCloseTo(movimientos[i - 1].hasta, 6);
      expect(movimientos[movimientos.length - 1].hasta).toBeCloseTo(r.cajaInicial! + r.gananciaReal!, 6);
      expect(pasos.find((x) => x.clave === 'ganancia-bruta')!.hasta - pasos.find((x) => x.clave === 'ganancia-bruta')!.desde).toBe(r.gananciaBruta);
      expect(pasos.find((x) => x.clave === 'ganancia-real')!.hasta - r.cajaInicial!).toBe(r.gananciaReal);
      // Orden: RR. HH. va antes de la ganancia bruta; el resto, de mayor a menor después.
      const iBruta = pasos.findIndex((x) => x.clave === 'ganancia-bruta');
      expect(pasos.slice(0, iBruta).filter((x) => x.tipo === 'gasto').map((x) => x.etiqueta)).toEqual(['RECURSOS HUMANOS']);
      // "Otros gastos" agrupa los chicos y va al final; el resto, de mayor a menor.
      const resto = pasos.slice(iBruta).filter((x) => x.tipo === 'gasto' && !x.agrupa).map((x) => x.monto);
      expect(resto.every((v, i) => i === 0 || resto[i - 1] >= v)).toBe(true);
      expect(pasos.filter((x) => x.mayor).map((x) => x.etiqueta)).toEqual([r.categorias[0].categoria]);
      const otros = pasos.find((x) => x.agrupa);
      if (otros) {
        expect(otros.monto).toBe(otros.agrupa!.reduce((s, c) => s + c.valor, 0));
        expect(otros.agrupa!.every((c) => c.valor < r.gastos! * 0.02)).toBe(true);
        expect(pasos.filter((x) => x.tipo === 'gasto').length + otros.agrupa!.length - 1).toBe(r.categorias.length);
      }
    }
  });

  it('matriz: columnas enero → mes actual; totales y promedios solo con meses cerrados', () => {
    const mz = matrizFlujo(d);
    expect(mz.columnas.map((c) => c.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mz.columnas.filter((c) => c.parcial).map((c) => c.mes)).toEqual([10]);
    expect(mz.cerrados).toEqual(d.financiero.mesesCerrados);
    const f = (clave: string) => mz.filas.find((x) => x.clave === clave)!;
    expect(f('ingresos').total).toBe(d.financiero.ingresos.total);
    expect(f('gastos').total).toBe(d.financiero.gastos.total);
    expect(f('ganancia-real').total).toBe(d.financiero.ganancia.total);
    expect(f('caja-inicial').total).toBe(d.financiero.meses[0].cajaInicial);
    expect(f('caja-cierre').total).toBe(d.financiero.meses[8].cajaCierre);
    // Las categorías de cada mes suman el total de gastos del mes.
    const cats = mz.filas.filter((x) => x.grupo === 'gasto' && x.categoria);
    mz.columnas.forEach((c, i) => expect(suma(cats.map((x) => x.valores[i]))).toBe(d.financiero.meses[c.mes - 1].gastos ?? 0));
    expect(f('margen-neto').total).toBeCloseTo(d.financiero.ganancia.total! / d.financiero.ingresos.total!, 12);
    // Coherencia de caja: el indicador coincide con los avisos de Salud de datos.
    const conProblema = mz.columnas.filter((_, i) => f('coherencia').valores[i] === 0).map((c) => c.mes);
    expect(conProblema).toEqual(d.salud.filter((a) => a.tipo === 'caja-control').map((a) => a.mes));
  });

  it('lectura automática: entre 3 y 5 frases, todas con números del período', () => {
    const r = resumenFlujo(d, { tipo: 'mes', mes: 9 })!;
    const frases = lecturaAutomatica(r, resumenFlujo(d, periodoAnterior(d, r.periodo)!));
    expect(frases.length).toBeGreaterThanOrEqual(3);
    expect(frases.length).toBeLessThanOrEqual(5);
    expect(frases[0]).toMatch(/^Recursos Humanos fue el \d+(,\d)? % de los ingresos\.$/);
    expect(frases.some((x) => x.startsWith('La caja cerró en Gs.'))).toBe(true);
    // Sin período anterior no se arma la frase de crecimiento.
    expect(lecturaAutomatica(r, null).some((x) => x.includes('más creció'))).toBe(false);
  });

  it('las categorías salen siempre del detalle de GASTOS, nunca de FLUJO CAJA', () => {
    const r = resumenFlujo(d, { tipo: 'mes', mes: 9 })!;
    const bloque = parseDetalle(libro.hojas['GASTOS']).get(9)!;
    const rrhh = bloque.filas.filter((x) => normTexto(x.concepto) === 'RECURSOS HUMANOS' && x.valor !== null);
    expect(r.categorias.find((c) => c.categoria === 'RECURSOS HUMANOS')!.valor).toBe(suma(rrhh.map((x) => x.valor)));
  });
});
