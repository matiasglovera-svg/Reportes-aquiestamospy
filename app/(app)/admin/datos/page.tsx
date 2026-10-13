'use client';

import { useMemo, useState } from 'react';
import { useDatos } from '@/components/datos';
import { Tabla } from '@/components/tabla';
import { Etiqueta, Panel, Selector, TituloSeccion, Vacio } from '@/components/ui';
import { ALIAS_OPERARIAS } from '@/config/aliases';
import { SUELDO_FIJO } from '@/config/staff';
import type { Reporte } from '@/lib/csv';
import type { AvisoTipo } from '@/lib/engine/types';
import { mesLargo } from '@/lib/format';

const GRUPOS: { tipos: AvisoTipo[]; titulo: string; ayuda: string }[] = [
  { tipos: ['pestanas', 'estructura'], titulo: 'Pestañas y estructura', ayuda: 'Pestañas faltantes, títulos no encontrados o encabezados que obligaron a usar la letra de columna.' },
  { tipos: ['ingresos-control'], titulo: 'Control de ingresos', ayuda: 'Detalle del mes contra el resumen izquierdo, FLUJO CAJA y la celda TOTAL del bloque.' },
  { tipos: ['gastos-control'], titulo: 'Control de gastos', ayuda: 'Detalle del mes contra el resumen izquierdo y FLUJO CAJA, y montos escritos fuera de la columna VALOR.' },
  { tipos: ['ganancia-control'], titulo: 'Control de ganancia y rentabilidad', ayuda: 'Cálculo propio contra GANANCIA REAL y CONVERSION de FLUJO CAJA.' },
  { tipos: ['rrhh-control'], titulo: 'Control de RR. HH.', ayuda: 'Σ K de operarias por servicio + sueldos fijos del panel contra RECURSOS HUMANOS de GASTOS.' },
  { tipos: ['sin-fecha', 'sin-cliente'], titulo: 'Servicios sin fecha o sin cliente', ayuda: 'Sin fecha solo cuentan como realizados cuando el mes ya cerró.' },
  { tipos: ['sin-precio'], titulo: 'Servicios sin precio', ayuda: 'Cuentan en cantidades; el precio queda "Sin dato".' },
  { tipos: ['sin-operaria'], titulo: 'Servicios sin operaria', ayuda: 'Se agrupan como "Sin asignar".' },
  { tipos: ['sin-horas', 'horas-inferidas'], titulo: 'Horas faltantes o inferidas', ayuda: 'Cuando la columna de horas no trae un número, se calculan desde el horario.' },
  { tipos: ['pago-sueldo'], titulo: 'Filas de pago de sueldo', ayuda: 'Filas de la tabla de servicios que son un pago de sueldo fijo: no se cuentan como servicio.' },
  { tipos: ['nombre-unificado', 'nombre-nuevo'], titulo: 'Nombres de operarias', ayuda: 'Nombres unificados automáticamente (una letra de diferencia) y nombres nuevos que no están en la lista.' },
  { tipos: ['sin-clasificar'], titulo: 'Sin clasificar', ayuda: 'Servicios sin tipo de precio o de cliente en la fila ni en BBDD CLIENTES.' },
];

export default function SaludDeDatos() {
  const { dataset: d, cargando } = useDatos();
  const [mes, setMes] = useState(0);
  const avisos = useMemo(() => (d?.salud ?? []).filter((a) => !mes || a.mes === mes), [d, mes]);

  if (cargando) return <p className="text-sm text-muted">Cargando…</p>;
  if (!d) return <Vacio titulo="Todavía no hay datos">Conectá OneDrive y asigná la planilla desde Conexión.</Vacio>;

  const periodo = mes ? `${mesLargo(mes)}-${d.anio}` : String(d.anio);
  const tabla = (titulo: string, lista: typeof avisos): Reporte => ({
    id: `salud-${titulo}`,
    titulo: `Salud de datos - ${titulo}`,
    periodo,
    columnas: [
      { titulo: 'Pestaña', tipo: 'texto' },
      { titulo: 'Fila', tipo: 'num' },
      { titulo: 'Nivel', tipo: 'texto' },
      { titulo: 'Aviso', tipo: 'texto' },
    ],
    filas: lista.map((a) => [a.pestana, a.fila ?? null, a.nivel === 'info' ? 'Informativo' : a.nivel === 'aviso' ? 'Revisar' : 'Error', a.mensaje]),
  });
  const alias: Reporte = {
    id: 'alias',
    titulo: 'Alias de operarias',
    periodo: String(d.anio),
    columnas: [
      { titulo: 'Se muestra como', tipo: 'texto' },
      { titulo: 'Variantes en la planilla', tipo: 'texto' },
      { titulo: 'Modalidad', tipo: 'texto' },
    ],
    filas: [
      ...Object.entries(ALIAS_OPERARIAS).map(([canonico, variantes]) => [canonico, variantes.join(', '), SUELDO_FIJO[canonico] ? `Sueldo fijo desde ${SUELDO_FIJO[canonico].fijoDesde}` : 'Por servicio']),
      ...Object.entries(SUELDO_FIJO)
        .filter(([n]) => !ALIAS_OPERARIAS[n])
        .map(([n, v]) => [n, n.toUpperCase(), `Sueldo fijo desde ${v.fijoDesde}`]),
    ],
  };

  return (
    <>
      <TituloSeccion nota="Solo administrador · los avisos son informativos: no bloquean la app ni cambian los números">Salud de datos</TituloSeccion>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Selector etiqueta="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          <option value={0}>Todo el año</option>
          {d.operativo.map((m) => (
            <option key={m.mes} value={m.mes}>
              {mesLargo(m.mes)}
            </option>
          ))}
        </Selector>
        <span className="text-sm text-muted">
          <span className="num font-semibold text-text">{avisos.filter((a) => a.nivel !== 'info').length}</span> para revisar · <span className="num">{avisos.filter((a) => a.nivel === 'info').length}</span> informativos
        </span>
      </div>

      <div className="space-y-4">
        {GRUPOS.map((g) => {
          const lista = avisos.filter((a) => g.tipos.includes(a.tipo));
          const revisar = lista.filter((a) => a.nivel !== 'info').length;
          const reporte = tabla(g.titulo, lista);
          return (
            <Panel
              key={g.titulo}
              titulo={g.titulo}
              subtitulo={g.ayuda}
              reporte={lista.length ? reporte : undefined}
              acciones={lista.length === 0 ? <Etiqueta tono="ok">Sin avisos</Etiqueta> : revisar ? <Etiqueta tono="estimado">{revisar} para revisar</Etiqueta> : <Etiqueta>{lista.length} informativos</Etiqueta>}
            >
              {lista.length > 0 && (
                <details open={lista.length <= 12}>
                  <summary className="cursor-pointer text-sm font-medium text-primary">Ver {lista.length} avisos</summary>
                  <div className="mt-2">
                    <Tabla reporte={reporte} maxAlto={360} celda={(v, col) => (col === 2 ? <Etiqueta tono={v === 'Revisar' ? 'estimado' : v === 'Error' ? 'alerta' : 'neutro'}>{v}</Etiqueta> : col === 1 && v === null ? '—' : undefined)} />
                  </div>
                </details>
              )}
            </Panel>
          );
        })}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Pestañas" subtitulo="Solo se leen los meses y las cuatro pestañas fijas.">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Detectadas ({d.pestanas.detectadas.length})</p>
            <p className="mb-3 text-sm">{d.pestanas.detectadas.join(' · ')}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ignoradas ({d.pestanas.ignoradas.length})</p>
            <p className="text-sm text-muted">{d.pestanas.ignoradas.join(' · ') || 'Ninguna'}</p>
          </Panel>
          <Panel titulo="Alias de operarias y sueldos fijos" subtitulo="Se editan en config/aliases.ts y config/staff.ts." reporte={alias}>
            <Tabla reporte={alias} maxAlto={320} />
          </Panel>
        </div>
      </div>
    </>
  );
}
