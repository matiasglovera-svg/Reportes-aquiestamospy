'use client';

import type { Reporte, TipoColumna, Valor } from '@/lib/csv';
import { fecha, gs, num, pct, SIN_DATO } from '@/lib/format';
import { cn } from './ui';

export function formatear(v: Valor, tipo: TipoColumna): string {
  if (v === null) return SIN_DATO;
  if (typeof v === 'string') return tipo === 'fecha' ? fecha(v) : v;
  if (tipo === 'gs') return gs(v);
  if (tipo === 'pct') return pct(v);
  return num(v, 2);
}

/**
 * Tabla de un reporte: scroll horizontal interno y primera columna fija.
 * `barras`: índices de columnas numéricas que llevan barra de datos dentro de la celda.
 */
export function Tabla({
  reporte,
  barras = [],
  resaltarFila,
  celda,
  maxAlto,
}: {
  reporte: Reporte;
  barras?: number[];
  resaltarFila?: (fila: Valor[]) => boolean;
  /** Reemplaza el contenido de una celda (devolver undefined = formato estándar). */
  celda?: (v: Valor, col: number, fila: Valor[]) => React.ReactNode | undefined;
  maxAlto?: number;
}) {
  const maximos = new Map(barras.map((c) => [c, Math.max(0, ...reporte.filas.map((f) => (typeof f[c] === 'number' ? Math.abs(f[c] as number) : 0)))]));
  return (
    <div className="relative -mx-1 overflow-auto" style={maxAlto ? { maxHeight: maxAlto } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {reporte.columnas.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted',
                  c.tipo === 'texto' || c.tipo === 'fecha' ? 'text-left' : 'text-right',
                  i === 0 && 'left-0 z-20',
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reporte.filas.map((f, r) => (
            <tr key={r} className={cn(resaltarFila?.(f) && 'bg-accent-soft/50')}>
              {f.map((v, i) => {
                const tipo = reporte.columnas[i].tipo;
                const numerica = tipo !== 'texto' && tipo !== 'fecha';
                const max = maximos.get(i);
                const propio = celda?.(v, i, f);
                const Celda = i === 0 ? 'th' : 'td';
                return (
                  <Celda
                    key={i}
                    scope={i === 0 ? 'row' : undefined}
                    className={cn(
                      'relative whitespace-nowrap border-b border-border px-3 py-2 font-normal',
                      numerica ? 'num text-right' : 'text-left',
                      i === 0 && 'sticky left-0 z-[5] bg-surface font-medium',
                      v === null && 'text-muted',
                      typeof v === 'number' && v < 0 && (tipo === 'gs' || tipo === 'pct') && 'text-alerta',
                    )}
                  >
                    {max ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-2 rounded bg-primary/15"
                        style={{ width: `calc(${(typeof v === 'number' ? Math.abs(v) / max : 0) * 100}% - 1rem)` }}
                      />
                    ) : null}
                    <span className="relative">{propio !== undefined ? propio : formatear(v, tipo)}</span>
                  </Celda>
                );
              })}
            </tr>
          ))}
          {!reporte.filas.length && (
            <tr>
              <td colSpan={reporte.columnas.length} className="px-3 py-6 text-center text-muted">
                Sin datos para este período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
