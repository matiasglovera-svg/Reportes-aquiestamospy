// Imprime los valores de control y el informe de Salud de datos del archivo en fixtures/.
// Uso: npm run salud [-- aaaa-mm-dd]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { construirDataset, leerLibro } from '../lib/engine';
import { MESES, titulo } from '../lib/engine/normalize';

const archivo = readdirSync('fixtures').find((f) => f.endsWith('.xlsx'));
if (!archivo) {
  console.error('No hay ningún .xlsx en fixtures/.');
  process.exit(1);
}
const hoy = process.argv[2] ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());

const t0 = performance.now();
const libro = leerLibro(readFileSync(join('fixtures', archivo)));
const t1 = performance.now();
const d = construirDataset({ libro, anio: 2026, hoy });
const t2 = performance.now();

const n = (v: number | null) => (v === null ? 'Sin dato' : Math.round(v).toLocaleString('es-PY'));
const p = (v: number | null) => (v === null ? 'Sin dato' : `${(v * 100).toFixed(1).replace('.', ',')} %`);
const mes = (m: number) => titulo(MESES[m - 1]).slice(0, 3);

console.log(`Archivo: ${archivo} · hoy ${hoy} · lectura ${Math.round(t1 - t0)} ms · cálculo ${Math.round(t2 - t1)} ms\n`);

console.log('FINANCIERO');
console.table(
  d.financiero.meses
    .filter((m) => m.ingresos !== null || m.gastos !== null)
    .map((m) => ({
      Mes: mes(m.mes) + (m.enCurso ? ' (en curso)' : ''),
      Ingresos: n(m.ingresos),
      Gastos: n(m.gastos),
      'RR. HH.': n(m.rrhh),
      Ganancia: n(m.ganancia),
      'Gan. bruta': n(m.gananciaBruta),
      'Rentab.': p(m.rentabilidad),
      'Caja al cierre': n(m.cajaCierre),
    })),
);
const f = d.financiero;
console.log(
  `Meses cerrados (${f.mesesCerrados.length}): ingresos prom. ${n(f.ingresos.promedio)} / total ${n(f.ingresos.total)} · ` +
    `gastos prom. ${n(f.gastos.promedio)} · ganancia prom. ${n(f.ganancia.promedio)} / total ${n(f.ganancia.total)} · ` +
    `rentabilidad prom. ${p(f.rentabilidadPromedio)}\n`,
);

console.log('OPERATIVO');
console.table(
  d.operativo.map((m) => ({
    Mes: mes(m.mes) + (m.enCurso ? ' (en curso)' : ''),
    Cargados: m.cargados,
    Realizados: m.realizados,
    Agendados: m.agendados,
    Unidades: m.unidadesCargadas,
    Horas: m.horasCargadas,
    'Σ N precio': n(m.precioCargado),
    'Σ K pago': n(m.pagoCargado),
    'Pagos sueldo': n(m.pagosSueldo.reduce((a, x) => a + (x.total ?? 0), 0)),
    Semanas: m.semanas.map((s) => s.cargados).join(' / '),
    'Caja chica': n(m.cajaChica.valor),
  })),
);

console.log('\nSALUD DE DATOS');
console.log(`Pestañas detectadas (${d.pestanas.detectadas.length}): ${d.pestanas.detectadas.join(', ')}`);
console.log(`Pestañas ignoradas (${d.pestanas.ignoradas.length}): ${d.pestanas.ignoradas.join(', ')}\n`);

const porTipo = new Map<string, typeof d.salud>();
for (const a of d.salud) porTipo.set(a.tipo, [...(porTipo.get(a.tipo) ?? []), a]);
const MAX = 12;
for (const [tipo, lista] of porTipo) {
  console.log(`▸ ${tipo} (${lista.length})`);
  for (const a of lista.slice(0, MAX)) console.log(`   [${a.pestana}${a.fila ? ` fila ${a.fila}` : ''}] ${a.mensaje}`);
  if (lista.length > MAX) console.log(`   … y ${lista.length - MAX} más`);
}
