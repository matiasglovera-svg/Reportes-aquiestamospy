'use client';

import { BarChart, CustomChart, GaugeChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { GRAFICO, SERIES, type Tema } from '@/config/theme';
import { useDatos } from './datos';

echarts.use([BarChart, CustomChart, LineChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, AriaComponent, CanvasRenderer]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Opcion = Record<string, any>;

export interface Paleta {
  tema: Tema;
  series: string[];
  texto: string;
  tenue: string;
  grilla: string;
  superficie: string;
  alerta: string;
  atenuado: string;
}

export function usePaleta(): Paleta {
  const { tema } = useDatos();
  return useMemo(() => ({ tema, series: SERIES[tema], ...GRAFICO[tema] }), [tema]);
}

const FUENTE = 'var(--font-barlow), system-ui, sans-serif';

/** Base común: ejes y grilla discretos, tooltip sobre la superficie, leyenda arriba. */
export function base(p: Paleta, o: { leyenda?: boolean; formatoEje?: (v: number) => string; formatoValor?: (v: number | null) => string; horizontal?: boolean; categorias: string[] }): Opcion {
  const ejeCategoria = {
    type: 'category',
    data: o.categorias,
    axisLine: { lineStyle: { color: p.grilla } },
    axisTick: { show: false },
    axisLabel: { color: p.tenue, fontFamily: FUENTE, fontSize: 12, ...(o.horizontal ? { width: 110, overflow: 'truncate' } : { hideOverlap: true }) },
    ...(o.horizontal ? { inverse: true } : {}),
  };
  const ejeValor = {
    type: 'value',
    axisLabel: { color: p.tenue, fontFamily: FUENTE, fontSize: 12, formatter: o.formatoEje, hideOverlap: true },
    splitLine: { lineStyle: { color: p.grilla, type: 'dashed' } },
    splitNumber: 4,
  };
  return {
    color: p.series,
    textStyle: { fontFamily: FUENTE, color: p.texto },
    aria: { enabled: true },
    grid: { left: 4, right: o.horizontal ? 24 : 8, top: o.leyenda ? 36 : 12, bottom: 4, containLabel: true },
    legend: o.leyenda ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, itemGap: 14, textStyle: { color: p.tenue, fontFamily: FUENTE, fontSize: 12 } } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: o.horizontal ? 'shadow' : 'line', lineStyle: { color: p.tenue, width: 1 }, shadowStyle: { color: p.grilla, opacity: 0.35 } },
      backgroundColor: p.superficie,
      borderColor: p.grilla,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: p.texto, fontFamily: FUENTE, fontSize: 13 },
      extraCssText: 'border-radius:12px;box-shadow:0 8px 24px -12px rgba(0,0,0,.35);',
      confine: true,
      valueFormatter: o.formatoValor ? (v: unknown) => o.formatoValor!(typeof v === 'number' ? v : null) : undefined,
    },
    xAxis: o.horizontal ? ejeValor : ejeCategoria,
    yAxis: o.horizontal ? ejeCategoria : ejeValor,
    animationDuration: 700,
    animationDurationUpdate: 450,
    animationEasing: 'cubicOut',
  };
}

/** Barras verticales con punta redondeada y separación de 2 px entre segmentos apilados. */
export const barra = (p: Paleta, extra: Opcion = {}): Opcion => ({
  type: 'bar',
  barMaxWidth: 26,
  itemStyle: { borderRadius: [4, 4, 0, 0], borderColor: p.superficie, borderWidth: extra.stack ? 1 : 0 },
  emphasis: { focus: 'series' },
  ...extra,
});

export const linea = (extra: Opcion = {}): Opcion => ({
  type: 'line',
  lineStyle: { width: 2 },
  symbol: 'circle',
  symbolSize: 8,
  emphasis: { focus: 'series' },
  ...extra,
});

export function Grafico({ opcion, alto = 280, descripcion }: { opcion: Opcion; alto?: number; descripcion: string }) {
  const reducido = useReducedMotion();
  const final = useMemo(() => ({ ...opcion, animation: !reducido }), [opcion, reducido]);
  return (
    <div role="img" aria-label={descripcion} style={{ height: `clamp(${Math.round(alto * 0.78)}px, 44vw, ${alto}px)` }}>
      {/* notMerge=false: al actualizar, las series hacen la transición en vez de redibujarse. */}
      <ReactEChartsCore echarts={echarts} option={final} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
    </div>
  );
}
