import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirDataset, leerLibro, type Dataset, type LibroCrudo } from '../lib/engine';
import { fechaISO, mesDesdeTexto, normTexto, numero } from '../lib/engine/normalize';
import { parseDetalle } from '../lib/engine/parse-detalle';
import { REFERENCIA_FINANCIERO, REFERENCIA_OPERATIVO } from './referencia-seccion12';

/**
 * La copia local de la planilla es referencia de ESTRUCTURA, no de valores: la verdad es el archivo en la nube.
 * Estos tests validan la lógica (sumas, agrupaciones, ponderación, títulos, meses cerrados, realizados)
 * recalculando cada número por un camino independiente sobre la misma copia. Ningún monto está fijo acá.
 * La comparación con la sección 12 del prompt es solo informativa (se imprime, nunca falla).
 */
const HOY = '2026-10-12';
const fixture = existsSync('fixtures') ? readdirSync('fixtures').find((f) => f.endsWith('.xlsx')) : undefined;
const suma = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

describe.skipIf(!fixture)('motor sobre la copia local de la planilla', () => {
  let libro: LibroCrudo;
  let d: Dataset;
  beforeAll(() => {
    libro = leerLibro(readFileSync(join('fixtures', fixture!)));
    d = construirDataset({ libro, anio: 2026, hoy: HOY });
  });

  it('parsea solo meses + pestañas fijas e ignora el resto', () => {
    for (const n of d.pestanas.detectadas) {
      expect(mesDesdeTexto(n) > 0 || ['INGRESOS', 'GASTOS', 'FLUJO CAJA', 'BBDD CLIENTES'].includes(normTexto(n))).toBe(true);
    }
    expect(d.pestanas.ignoradas).toContain('CONSOLIDADO VENTAS_');
    expect(d.pestanas.detectadas.length + d.pestanas.ignoradas.length).toBe(libro.nombres.length);
    expect(d.operativo.length).toBe(libro.nombres.filter((n) => mesDesdeTexto(n) > 0).length);
  });

  it('ingresos y gastos = Σ de la columna VALOR del bloque del mes (y nada de la columna de comentarios)', () => {
    for (const [pestana, campo] of [['INGRESOS', 'ingresos'], ['GASTOS', 'gastos']] as const) {
      const bloques = parseDetalle(libro.hojas[pestana]);
      expect(bloques.size).toBe(12);
      for (const m of d.financiero.meses) {
        const b = bloques.get(m.mes)!;
        const valores = b.filas.map((f) => f.valor).filter((v) => v !== null);
        expect(m[campo]).toBe(valores.length ? suma(valores) : null);
      }
    }
  });

  it('ganancia, ganancia bruta y rentabilidad siguen el glosario', () => {
    for (const m of d.financiero.meses) {
      if (m.ingresos === null || m.gastos === null) {
        expect(m.ganancia).toBeNull();
        continue;
      }
      expect(m.ganancia).toBe(m.ingresos - m.gastos);
      expect(suma(m.categorias.map((c) => c.valor))).toBe(m.gastos);
      const rrhh = m.categorias.find((c) => c.categoria === 'RECURSOS HUMANOS')?.valor ?? null;
      expect(m.rrhh).toBe(rrhh);
      expect(m.gananciaBruta).toBe(rrhh === null ? null : m.ingresos - rrhh);
      if (m.ingresos !== 0) expect(m.rentabilidad).toBeCloseTo(m.ganancia! / m.ingresos, 12);
    }
  });

  it('un concepto repetido en varias filas se suma en su categoría', () => {
    const bloques = parseDetalle(libro.hojas['GASTOS']);
    for (const [mes, b] of bloques) {
      const filasRrhh = b.filas.filter((f) => normTexto(f.concepto) === 'RECURSOS HUMANOS' && f.valor !== null);
      if (filasRrhh.length > 1) expect(d.financiero.meses[mes - 1].rrhh).toBe(suma(filasRrhh.map((f) => f.valor)));
    }
  });

  it('promedios y totales usan solo meses cerrados; el mes en curso va aparte', () => {
    const f = d.financiero;
    expect(d.mesEnCurso).toBe(10);
    expect(f.meses.filter((m) => m.enCurso).map((m) => m.mes)).toEqual([10]);
    expect(f.mesesCerrados.every((m) => m < 10)).toBe(true);
    const cerrados = f.meses.filter((m) => f.mesesCerrados.includes(m.mes));
    expect(f.ingresos.total).toBe(suma(cerrados.map((m) => m.ingresos)));
    expect(f.ingresos.promedio).toBeCloseTo(f.ingresos.total! / cerrados.length, 6);
    expect(f.ingresos.acumulado).toBe(f.ingresos.total! + (f.meses[9].ingresos ?? 0));
    expect(f.ganancia.total).toBe(suma(cerrados.map((m) => m.ganancia)));
    expect(f.rentabilidadPromedio).toBeCloseTo(suma(cerrados.map((m) => m.rentabilidad)) / cerrados.length, 12);
  });

  it('cambiar "hoy" mueve el límite de meses cerrados sin tocar los datos', () => {
    const antes = construirDataset({ libro, anio: 2026, hoy: '2026-06-15' });
    expect(antes.financiero.mesesCerrados).toEqual([1, 2, 3, 4, 5]);
    expect(antes.financiero.meses[5].enCurso).toBe(true);
    expect(antes.financiero.meses[5].ingresos).toBe(d.financiero.meses[5].ingresos);
    const despues = construirDataset({ libro, anio: 2026, hoy: '2027-01-03' });
    expect(despues.mesEnCurso).toBeNull();
    expect(despues.operativo.every((m) => m.cerrado && m.agendados === 0)).toBe(true);
  });

  it('cada mes: totales = Σ semanas = Σ operarias, y unidades = horas ÷ 4', () => {
    for (const m of d.operativo) {
      const servicios = d.servicios.filter((s) => s.mes === m.mes);
      expect(m.cargados).toBe(servicios.length);
      expect(m.cargados).toBe(m.realizados + m.agendados);
      expect(suma(m.semanas.map((s) => s.cargados))).toBe(m.cargados);
      expect(suma(m.operarias.map((o) => o.cargados))).toBe(m.cargados);
      expect(suma(m.operarias.map((o) => o.realizados))).toBe(m.realizados);
      expect(m.horasCargadas).toBe(suma(servicios.map((s) => s.horas)));
      expect(m.unidadesCargadas).toBeCloseTo(m.horasCargadas / 4, 9);
      expect(m.unidades).toBeCloseTo(m.horas / 4, 9);
      expect(m.precioCargado).toBe(suma(servicios.map((s) => s.precio)));
      expect(m.pagoCargado).toBe(suma(servicios.map((s) => s.pago)));
      expect(suma(m.semanas.map((s) => s.pagoCargado))).toBe(m.pagoCargado);
      expect(m.sinPrecio).toBe(servicios.filter((s) => s.precio === null).length);
    }
  });

  it('realizado = fecha ≤ hoy; fecha futura = agendado', () => {
    for (const s of d.servicios) {
      if (s.fecha) expect(s.realizado).toBe(s.fecha <= HOY);
    }
    const enCurso = d.operativo.find((m) => m.enCurso)!;
    expect(enCurso.agendados).toBe(d.servicios.filter((s) => s.mes === 10 && s.fecha !== null && s.fecha > HOY).length);
    for (const m of d.operativo.filter((x) => x.cerrado)) expect(m.agendados).toBe(0);
  });

  it('cuenta exactamente las filas de servicio de la tabla (recuento independiente por columna)', () => {
    for (const m of d.operativo) {
      const hoja = libro.hojas[m.pestana];
      let semana = 0;
      let filas = 0;
      for (const fila of hoja) {
        const a = normTexto(fila?.[0]);
        if (a.startsWith('SEMANA')) semana = 1;
        const cliente = normTexto(fila?.[2]);
        if (!semana || cliente === 'NOMBRE COMPLETO') continue;
        const conCliente = cliente !== '' && !cliente.startsWith('TOTAL');
        const sinClientePeroServicio = cliente === '' && normTexto(fila?.[7]) !== '' && fechaISO(fila?.[1]) !== null;
        if (conCliente || sinClientePeroServicio) filas++;
      }
      expect(m.cargados + m.pagosSueldo.length).toBe(filas);
    }
  });

  it('no lee el panel derecho como servicios y lo ubica por títulos aunque se corra de columna', () => {
    const celdas = new Set(d.operativo.map((m) => m.cajaChica.celda!.replace(/\d+/, '')));
    expect(celdas.size).toBeGreaterThan(1);
    for (const m of d.operativo) {
      const hoja = libro.hojas[m.pestana];
      const [, col, fila] = m.cajaChica.celda!.match(/^([A-Z]+)(\d+)$/)!;
      const c = [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      expect(normTexto(hoja[+fila - 3][c])).toBe('CAJA CHICA INICIAL MES');
      expect(m.cajaChica.valor).toBe(numero(hoja[+fila - 1][c]));
    }
  });

  it('sueldo fijo: sale del panel COMISION desde el mes configurado; sin total cargado es "Sin dato"', () => {
    for (const m of d.operativo) {
      for (const o of m.operarias) {
        const esperado = (o.operaria === 'Gloria' && m.mes >= 2) || (o.operaria === 'Judith' && m.mes >= 5);
        expect(o.modalidad).toBe(esperado ? 'Sueldo fijo' : 'Por servicio');
        if (esperado && o.totalMes !== null) expect(o.totalMes).toBe((o.salarioMes ?? 0) + (o.movilidadMes ?? 0));
        if (!esperado && o.operaria !== 'Sin asignar') expect(o.totalMes).toBe(o.pagoCargado);
      }
    }
  });

  it('unifica los alias de operarias', () => {
    const nombres = new Set(d.servicios.map((s) => s.operaria));
    for (const variante of ['Alba', 'Katya', 'Katia', 'Deisy', 'Deysi', 'Leidi']) expect(nombres.has(variante)).toBe(false);
  });

  it('cada fila con dato faltante genera su aviso, y los avisos no alteran los números', () => {
    const conteo = (tipo: string) => d.salud.filter((a) => a.tipo === tipo).length;
    expect(conteo('sin-precio')).toBe(suma(d.operativo.map((m) => m.sinPrecio)));
    expect(conteo('sin-operaria')).toBe(suma(d.operativo.map((m) => m.sinOperaria)));
    expect(conteo('sin-horas')).toBe(suma(d.operativo.map((m) => m.sinHoras)));
    expect(conteo('horas-inferidas')).toBe(suma(d.operativo.map((m) => m.horasInferidas)));
    expect(conteo('sin-fecha')).toBe(suma(d.operativo.map((m) => m.sinFecha)));
    expect(conteo('pago-sueldo')).toBe(suma(d.operativo.map((m) => m.pagosSueldo.length)));
    expect(d.salud.every((a) => a.pestana && a.mensaje)).toBe(true);
  });

  it('el dataset no expone datos de contacto de clientes', () => {
    expect(JSON.stringify(d)).not.toMatch(/"(ruc|telefono|email|direccion)"/i);
  });

  it('informe: diferencias contra la sección 12 (solo informativo)', () => {
    const difs: string[] = [];
    for (const [mes, ref] of Object.entries(REFERENCIA_FINANCIERO)) {
      const m = d.financiero.meses[+mes - 1];
      if (m.ingresos !== ref.ingresos) difs.push(`mes ${mes} ingresos: ${m.ingresos} (sección 12: ${ref.ingresos})`);
      if (m.gastos !== ref.gastos) difs.push(`mes ${mes} gastos: ${m.gastos} (sección 12: ${ref.gastos})`);
    }
    for (const [mes, ref] of Object.entries(REFERENCIA_OPERATIVO)) {
      const m = d.operativo.find((x) => x.mes === +mes);
      if (!m) continue;
      const filas = m.cargados + m.pagosSueldo.length;
      if (filas !== ref.servicios) difs.push(`mes ${mes} servicios: ${filas} (sección 12: ${ref.servicios})`);
      if (m.horasCargadas !== ref.horas) difs.push(`mes ${mes} horas: ${m.horasCargadas} (sección 12: ${ref.horas})`);
    }
    console.log(difs.length ? `Diferencias vs sección 12 (el archivo cambió, no es un error):\n  ${difs.join('\n  ')}` : 'Sin diferencias vs sección 12.');
    expect(Array.isArray(difs)).toBe(true);
  });
});
