import { describe, expect, it } from 'vitest';
import { construirDataset } from '../lib/engine';
import { crearResolutor, fechaISO, horasDesdeTexto, levenshtein, normTexto, numero, texto, titulo } from '../lib/engine/normalize';
import { categoriaGasto } from '../lib/engine/parse-gastos';
import type { Celda, Hoja } from '../lib/engine/types';

describe('normalización', () => {
  it('texto: mayúsculas, sin tildes, espacios colapsados', () => {
    expect(normTexto('  María   del  Cármen ')).toBe('MARIA DEL CARMEN');
    expect(titulo('MARIA DEL CARMEN')).toBe('Maria del Carmen');
  });

  it('errores de Excel y vacíos son null, nunca 0', () => {
    expect(texto('#N/A')).toBeNull();
    expect(texto('#REF!')).toBeNull();
    expect(texto('   ')).toBeNull();
    expect(numero(null)).toBeNull();
    expect(numero('')).toBeNull();
    expect(numero(0)).toBe(0);
  });

  it('horas desde el horario', () => {
    expect(horasDesdeTexto('08:00HS A 12:00HS')).toBe(4);
    expect(horasDesdeTexto('07:30HS A 13:30HS')).toBe(6);
    expect(horasDesdeTexto('13:00 a 21:00')).toBe(8);
    expect(horasDesdeTexto('A CONFIRMAR')).toBeNull();
    expect(horasDesdeTexto('12:00HS A 08:00HS')).toBeNull();
  });

  it('fechas: número de serie o dd/mm/aaaa; lo demás no se inventa', () => {
    expect(fechaISO(46059)).toBe('2026-02-06');
    expect(fechaISO('06/02/2026')).toBe('2026-02-06');
    expect(fechaISO('31/02/2026')).toBeNull();
    expect(fechaISO('viernes')).toBeNull();
    expect(fechaISO(4)).toBeNull();
  });

  it('categorías de gasto', () => {
    expect(categoriaGasto('UNIFORME Y ROPA DE TRABAJO')).toBe('UNIFORMES Y ROPA DE TRABAJO');
    expect(categoriaGasto(' Recursos  Humanos ')).toBe('RECURSOS HUMANOS');
  });
});

describe('nombres de operarias', () => {
  const resolver = crearResolutor({ Kathya: ['KATYA', 'KATIA'], Olga: ['OLGA'], 'Olga Nueva': ['OLGA NUEVA'] }, ['Gessenia', 'Mirta'], {
    autoUnificar: true,
    marcarNuevos: true,
  });

  it('levenshtein', () => {
    expect(levenshtein('GESENIA', 'GESSENIA')).toBe(1);
    expect(levenshtein('MIRTA', 'MIRIAN')).toBe(2);
  });

  it('alias y canónicos', () => {
    expect(resolver(' katia ')).toEqual({ nombre: 'Kathya', unificadoAuto: false, nuevo: false });
    expect(resolver('OLGA NUEVA').nombre).toBe('Olga Nueva');
  });

  it('unifica a distancia 1 solo nombres de 5+ letras, y lo marca', () => {
    expect(resolver('GESENIA')).toEqual({ nombre: 'Gessenia', unificadoAuto: true, nuevo: false });
    expect(resolver('OLGO')).toEqual({ nombre: 'Olgo', unificadoAuto: false, nuevo: true });
    expect(resolver('ROSALBA')).toEqual({ nombre: 'Rosalba', unificadoAuto: false, nuevo: true });
  });
});

describe('motor con un libro sintético', () => {
  const fila = (...c: Celda[]) => c;
  const encabezado = fila('DIA', 'FECHA', 'NOMBRE COMPLETO', 'STATUS PAGO', 'HORAS TRABAJADAS', 'HORARIO', 'STATUS PROFESIONALES', 'PROFESIONAL', 'SALARIO ($)', 'MOVILIDAD ($)', 'TOTAL ($)', null, null, 'PRECIO FINAL ($)', null, null, null, 'TIPO PRECIO', 'TIPO CLIENTE');
  const servicio = (serie: number | null, cliente: string, horas: Celda, operaria: string | null, precio: number | null) =>
    fila('LUNES', serie, cliente, true, horas, '08:00HS A 14:00HS', false, operaria, 60000, 20000, 80000, null, null, precio, null, null, null, '#N/A' as Celda, null);
  // 46300 = 05/10/2026 · 46321 = 26/10/2026
  const octubre: Hoja = [
    fila('SEMANA 1'),
    encabezado,
    servicio(46300, 'Ana Pérez', 4, 'KATYA', 150000),
    servicio(46300, 'ana  perez', '08:00HS A 14:00HS', null, null),
    fila(null, 'TOTAL', null, null, null, null, null, null, 120000, 40000, 160000),
    fila('SEMANA 2'),
    encabezado,
    servicio(46321, 'Ana Pérez', 8, 'Mirta', 300000),
    servicio(null, 'Sin Fecha SA', 4, 'Mirta', 100000),
  ];
  const bbdd: Hoja = [fila('CLIENTE', 'RUC', 'TIPO PRECIO', 'TIPO CLIENTE'), fila('ANA PEREZ', '80000000-1', 'PRECIO PROMO', 'SEMANAL')];
  const d = construirDataset({
    libro: { nombres: ['OCTUBRE', 'BBDD CLIENTES', 'OTRA'], ocultas: [], hojas: { OCTUBRE: octubre, 'BBDD CLIENTES': bbdd } },
    anio: 2026,
    hoy: '2026-10-12',
  });
  const oct = d.operativo[0];

  it('fecha futura = agendado; sin fecha en mes abierto no cuenta como realizado', () => {
    expect([oct.cargados, oct.realizados, oct.agendados]).toEqual([4, 2, 2]);
    expect(oct.unidades).toBe(1 + 1.5);
    expect(oct.unidadesCargadas).toBe(1 + 1.5 + 2 + 1);
    expect(oct.sinFecha).toBe(1);
  });

  it('precio faltante cuenta en cantidades y queda sin dato', () => {
    expect(oct.sinPrecio).toBe(1);
    expect(d.servicios[1].precio).toBeNull();
    expect(oct.precioCargado).toBe(550000);
  });

  it('horas inferidas, operaria sin asignar y alias', () => {
    expect(d.servicios[1]).toMatchObject({ horas: 6, horasInferidas: true, operaria: null });
    expect(oct.operarias.map((o) => o.operaria).sort()).toEqual(['Kathya', 'Mirta', 'Sin asignar']);
  });

  it('clasificación: respaldo en BBDD CLIENTES y "Sin clasificar"', () => {
    expect(d.servicios[0]).toMatchObject({ cliente: 'Ana Perez', tipoPrecio: 'Promo', tipoCliente: 'Semanal', origenTipoPrecio: 'bbdd' });
    expect(d.servicios[3]).toMatchObject({ tipoPrecio: 'Sin clasificar', origenTipoCliente: 'ninguno' });
  });

  it('faltan pestañas financieras: se avisa y los valores quedan sin dato', () => {
    expect(d.financiero.meses[9].ingresos).toBeNull();
    expect(d.financiero.ingresos.total).toBeNull();
    expect(d.salud.filter((a) => a.tipo === 'pestanas').map((a) => a.pestana)).toEqual(['INGRESOS', 'GASTOS', 'FLUJO CAJA']);
    expect(d.pestanas.ignoradas).toEqual(['OTRA']);
  });
});
