'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PasoCascada, ResumenFlujo } from '@/lib/engine/metrics-flujo';
import { gs, gsCorto, pct } from '@/lib/format';
import { nombreCategoria } from '@/lib/reportes';
import { base, Grafico, usePaleta, type Opcion } from './chart';

/** Colores de marca de la cascada: ingresos turquesa, gastos royal, el mayor en amarillo, subtotales navy (crema en oscuro). */
const COLORES = {
  light: { ingreso: '#37C4D8', gasto: '#3751D9', mayor: '#FFD83B', subtotal: '#0A3143', alerta: '#C9343A' },
  dark: { ingreso: '#37C4D8', gasto: '#6A7FEA', mayor: '#FFD83B', subtotal: '#FBFBF3', alerta: '#FF8A8E' },
};

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function useAngosto(): boolean {
  const [angosto, setAngosto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const cambiar = () => setAngosto(mq.matches);
    cambiar();
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, []);
  return angosto;
}

export const etiquetaPaso = (p: PasoCascada) => (p.tipo === 'gasto' ? nombreCategoria(p.etiqueta) : p.etiqueta);

/** Gráfico de cascada del flujo de caja. En pantallas angostas se dibuja horizontal. */
export function Cascada({ pasos, resumen, anteriores, etiquetaAnterior }: { pasos: PasoCascada[]; resumen: ResumenFlujo; anteriores: PasoCascada[]; etiquetaAnterior: string | null }) {
  const p = usePaleta();
  const angosto = useAngosto();
  const c = COLORES[p.tema];

  const opcion = useMemo<Opcion>(() => {
    const nombres = pasos.map(etiquetaPaso);
    const color = (x: PasoCascada) => {
      if ((x.tipo === 'subtotal' || x.tipo === 'caja') && x.monto < 0) return c.alerta;
      if (x.tipo === 'ingreso') return c.ingreso;
      if (x.tipo === 'gasto') return x.mayor ? c.mayor : c.gasto;
      return c.subtotal;
    };
    const opBase = base(p, { categorias: nombres, horizontal: angosto, formatoEje: gsCorto });

    return {
      ...opBase,
      grid: { ...opBase.grid, right: angosto ? 56 : 8, top: 24, bottom: angosto ? 4 : 8 },
      [angosto ? 'yAxis' : 'xAxis']: {
        ...(angosto ? opBase.yAxis : opBase.xAxis),
        // En escritorio las etiquetas van inclinadas para que no se pisen con muchas categorías.
        axisLabel: { ...(angosto ? opBase.yAxis : opBase.xAxis).axisLabel, interval: 0, width: angosto ? 96 : 110, overflow: 'truncate', hideOverlap: false, rotate: angosto ? 0 : 35 },
      },
      tooltip: {
        ...opBase.tooltip,
        trigger: 'item',
        formatter: (prm: { dataIndex: number }) => {
          const x = pasos[prm.dataIndex];
          const filas: string[] = [`<b>${escapar(etiquetaPaso(x))}</b>`, `${x.tipo === 'gasto' ? 'Resta' : x.tipo === 'ingreso' ? 'Suma' : 'Monto'}: <b>${gs(x.monto)}</b>`];
          if (resumen.ingresos && x.tipo !== 'caja') filas.push(`${pct(x.monto / resumen.ingresos)} de los ingresos`);
          if (x.tipo === 'gasto' && resumen.gastos) filas.push(`${pct(x.monto / resumen.gastos)} del total de gastos`);
          if (x.agrupa) filas.push(...x.agrupa.map((g) => `· ${escapar(nombreCategoria(g.categoria))}: ${gs(g.valor)}`));
          const ant = anteriores.find((a) => a.clave === x.clave);
          if (etiquetaAnterior && ant) {
            const dif = x.monto - ant.monto;
            filas.push(`${dif >= 0 ? '+' : '−'}${gs(Math.abs(dif))} vs ${escapar(etiquetaAnterior)}${ant.monto ? ` (${dif >= 0 ? '+' : '−'}${pct(Math.abs(dif / ant.monto))})` : ''}`);
          } else if (etiquetaAnterior && x.tipo === 'gasto') {
            filas.push(`Sin gasto en ${escapar(etiquetaAnterior)}`);
          }
          return filas.join('<br/>');
        },
      },
      series: [
        {
          type: 'custom',
          name: 'Flujo de caja',
          encode: angosto ? { y: 0, x: [1, 2] } : { x: 0, y: [1, 2] },
          data: pasos.map((x, i) => ({ value: [i, x.desde, x.hasta], itemStyle: { color: color(x) } })),
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[]; visual: (k: string) => string }) => {
            const i = api.value(0);
            const desde = api.value(1);
            const hasta = api.value(2);
            const x = pasos[i];
            const texto = x.tipo === 'gasto' ? `−${gsCorto(x.monto)}` : x.tipo === 'ingreso' ? `+${gsCorto(x.monto)}` : gsCorto(x.monto);
            const fuente = '600 11px Barlow, system-ui, sans-serif';
            if (angosto) {
              const a = api.coord([desde, i]);
              const b = api.coord([hasta, i]);
              const alto = api.size([0, 1])[1] * 0.62;
              const izq = Math.min(a[0], b[0]);
              const ancho = Math.max(2, Math.abs(a[0] - b[0]));
              return {
                type: 'group',
                children: [
                  { type: 'rect', shape: { x: izq, y: a[1] - alto / 2, width: ancho, height: alto, r: 3 }, style: { fill: api.visual('color') } },
                  { type: 'text', style: { text: texto, x: izq + ancho + 4, y: a[1], fill: p.tenue, font: fuente, align: 'left', verticalAlign: 'middle' } },
                ],
              };
            }
            const a = api.coord([i, desde]);
            const b = api.coord([i, hasta]);
            const ancho = api.size([1, 0])[0] * 0.62;
            const arriba = Math.min(a[1], b[1]);
            return {
              type: 'group',
              children: [
                { type: 'rect', shape: { x: a[0] - ancho / 2, y: arriba, width: ancho, height: Math.max(2, Math.abs(a[1] - b[1])), r: 3 }, style: { fill: api.visual('color') } },
                { type: 'text', style: { text: texto, x: a[0], y: arriba - 4, fill: p.tenue, font: fuente, align: 'center', verticalAlign: 'bottom' } },
              ],
            };
          },
        },
      ],
    };
  }, [pasos, resumen, anteriores, etiquetaAnterior, angosto, p, c]);

  const descripcion = `Cascada del flujo de caja de ${resumen.etiqueta}: ${pasos.map((x) => `${etiquetaPaso(x)} ${x.tipo === 'gasto' ? 'menos ' : ''}${gs(x.monto)}`).join('; ')}`;
  return (
    <div>
      <Grafico opcion={opcion} alto={angosto ? pasos.length * 36 + 48 : 400} descripcion={descripcion} />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ['Ingresos', c.ingreso],
          ['Gastos', c.gasto],
          ['Mayor gasto', c.mayor],
          ['Subtotales y caja', c.subtotal],
          ['Negativo', c.alerta],
        ].map(([t, col]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-border" style={{ background: col }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
