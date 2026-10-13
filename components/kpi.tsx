'use client';

import { animate, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Reporte } from '@/lib/csv';
import { pct, SIN_DATO } from '@/lib/format';
import { cn, Informacion, MenuCsv, Tarjeta, type InfoKpi } from './ui';

/** Número con conteo animado al cargar y cuando cambia; resalta brevemente el valor que cambió. */
export function Numero({ valor, formato, className }: { valor: number | null; formato: (n: number) => string; className?: string }) {
  const reducido = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const previo = useRef<number | null>(null);
  const [cambio, setCambio] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || valor === null) return;
    const desde = previo.current ?? 0;
    const esCambio = previo.current !== null && previo.current !== valor;
    previo.current = valor;
    if (esCambio) {
      setCambio(true);
      window.setTimeout(() => setCambio(false), 1700);
    }
    if (reducido || desde === valor) {
      el.textContent = formato(valor);
      return;
    }
    const control = animate(desde, valor, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = formato(v)) });
    return () => control.stop();
  }, [valor, formato, reducido]);

  if (valor === null) return <span className={cn('text-muted', className)}>{SIN_DATO}</span>;
  return (
    <span ref={ref} className={cn('num', cambio && 'resaltar', className)}>
      {formato(valor)}
    </span>
  );
}

/** Mini-línea de evolución. El último punto lleva marcador. */
export function Sparkline({ valores, className }: { valores: (number | null)[]; className?: string }) {
  const puntos = valores.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (puntos.length < 2) return null;
  const min = Math.min(...puntos.map((p) => p.v));
  const max = Math.max(...puntos.map((p) => p.v));
  const x = (i: number) => 2 + (i / (valores.length - 1)) * 96;
  const y = (v: number) => (max === min ? 12 : 21 - ((v - min) / (max - min)) * 18);
  const ultimo = puntos[puntos.length - 1];
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn('h-7 w-24', className)} aria-hidden>
      <polyline points={puntos.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r="2.5" fill="var(--primary)" />
    </svg>
  );
}

/** Variación con flecha. `invertir` = que suba es malo (gastos). */
export function Variacion({ fraccion, etiqueta, invertir, enPuntos }: { fraccion: number | null; etiqueta?: string; invertir?: boolean; enPuntos?: boolean }) {
  if (fraccion === null || !Number.isFinite(fraccion)) return null;
  const sube = fraccion > 0.0005;
  const baja = fraccion < -0.0005;
  const bueno = invertir ? baja : sube;
  const malo = invertir ? sube : baja;
  const Icono = sube ? ArrowUpRight : baja ? ArrowDownRight : Minus;
  const texto = enPuntos ? `${pct(Math.abs(fraccion)).replace(' %', '')} pts` : pct(Math.abs(fraccion));
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', bueno && 'text-ok', malo && 'text-alerta', !bueno && !malo && 'text-muted')}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      <span className="num">{texto}</span>
      <span className="sr-only">{sube ? 'más' : baja ? 'menos' : 'igual'}</span>
      {etiqueta && <span className="font-normal text-muted">&nbsp;{etiqueta}</span>}
    </span>
  );
}

export function Kpi({
  titulo,
  valor,
  formato,
  info,
  reporte,
  variacion,
  serie,
  etiqueta,
  pie,
  negativoEnAlerta,
  chico,
  indice = 0,
}: {
  titulo: string;
  valor: number | null;
  formato: (n: number) => string;
  info: InfoKpi;
  reporte?: Reporte;
  variacion?: { fraccion: number | null; etiqueta: string; invertir?: boolean; enPuntos?: boolean };
  serie?: (number | null)[];
  etiqueta?: React.ReactNode;
  pie?: React.ReactNode;
  negativoEnAlerta?: boolean;
  chico?: boolean;
  /** Posición en la grilla, para la entrada escalonada. */
  indice?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(indice, 8) * 0.05, ease: 'easeOut' }} className="min-w-0">
      <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 text-sm font-medium text-muted">{titulo}</p>
          {etiqueta}
          <Informacion info={info} titulo={titulo} />
          {reporte && <MenuCsv reporte={reporte} />}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <Numero
            valor={valor}
            formato={formato}
            className={cn('font-display font-extrabold leading-none', chico ? 'text-2xl' : 'text-[2rem] sm:text-4xl', negativoEnAlerta && valor !== null && valor < 0 && 'text-alerta')}
          />
          {serie && <Sparkline valores={serie} className="mb-1 shrink-0" />}
        </div>
        {variacion && (
          <div className="mt-2">
            <Variacion {...variacion} />
          </div>
        )}
        {pie && <div className="mt-2 text-xs text-muted">{pie}</div>}
      </Tarjeta>
    </motion.div>
  );
}
