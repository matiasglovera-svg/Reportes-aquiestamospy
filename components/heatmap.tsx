'use client';

import * as Popover from '@radix-ui/react-popover';
import { CALOR } from '@/config/theme';
import { num, pct } from '@/lib/format';
import type { Ocupacion } from '@/lib/reportes';
import { useDatos } from './datos';

/** Color y si el texto encima debe ser oscuro. Más de 100 % = sobreasignación, en amarillo. */
function color(ocupacion: number, tema: 'light' | 'dark'): { fondo: string; oscuro: boolean } {
  const c = CALOR[tema];
  if (ocupacion <= 0) return { fondo: c.vacio, oscuro: tema === 'light' };
  if (ocupacion > 1) return { fondo: c.sobre, oscuro: true };
  const i = Math.min(c.pasos.length - 1, Math.floor(ocupacion * c.pasos.length));
  return { fondo: c.pasos[i], oscuro: tema === 'light' ? i < 4 : i >= 2 };
}

/** Mapa de calor de ocupación: filas = operarias, columnas = semanas o meses. */
export function MapaCalor({ datos }: { datos: Ocupacion }) {
  const { tema } = useDatos();
  const c = CALOR[tema];
  if (!datos.filas.length) return <p className="py-6 text-center text-sm text-muted">Sin servicios en este período.</p>;
  return (
    <div>
      <div className="relative -mx-1 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Operaria
              </th>
              {datos.columnas.map((col) => (
                <th key={col} scope="col" className="min-w-14 px-1 py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((f) => (
              <tr key={f.operaria}>
                <th scope="row" className="sticky left-0 z-10 max-w-36 truncate whitespace-nowrap bg-surface px-2 py-1 text-left font-medium">
                  {f.operaria}
                </th>
                {f.celdas.map((celda, i) => {
                  const k = color(celda.ocupacion, tema);
                  return (
                    <td key={i} className="p-0">
                      <Popover.Root>
                        <Popover.Trigger
                          className="num grid h-9 w-full place-items-center rounded-lg text-xs font-semibold transition-transform hover:scale-[1.04]"
                          style={{ background: k.fondo, color: celda.ocupacion <= 0 ? 'var(--muted)' : k.oscuro ? '#0A3143' : '#FFFFFF' }}
                          aria-label={`${f.operaria}, ${datos.columnas[i]}: ${pct(celda.ocupacion)} de ocupación`}
                        >
                          {celda.ocupacion > 0 ? pct(celda.ocupacion).replace(/,\d/, '') : '·'}
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content sideOffset={4} collisionPadding={12} className="z-50 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-card">
                            <p className="font-semibold">
                              {f.operaria} · {datos.columnas[i]}
                            </p>
                            <p className="num text-muted">
                              {num(celda.unidades, 2)} / {celda.capacidad} unidades · {num(celda.horas, 1)} h
                            </p>
                            <p className="num">
                              Ocupación {pct(celda.ocupacion)}
                              {celda.ocupacion > 1 && ' · sobreasignada'}
                            </p>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          0 %
          <span className="flex overflow-hidden rounded">
            {c.pasos.map((p) => (
              <span key={p} className="h-3 w-6" style={{ background: p }} />
            ))}
          </span>
          100 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded" style={{ background: c.sobre }} /> Más de 100 % (sobreasignación)
        </span>
        <span>Tocá una celda para ver el detalle.</span>
      </div>
    </div>
  );
}
