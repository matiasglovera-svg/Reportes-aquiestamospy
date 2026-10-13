'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { clsx, type ClassValue } from 'clsx';
import { Download, Info, MoreHorizontal } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { descargarCsv, type Reporte } from '@/lib/csv';
import { fechaHora } from '@/lib/format';
import { useDatos } from './datos';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export function Tarjeta({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[18px] border border-border bg-surface shadow-card', className)} {...p} />;
}

export function Boton({
  variante = 'primario',
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'suave' | 'fantasma' | 'peligro' }) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variante === 'primario' && 'bg-primary text-primary-fg hover:opacity-90',
        variante === 'suave' && 'border border-border bg-surface text-text hover:bg-surface-2',
        variante === 'fantasma' && 'text-muted hover:bg-surface-2 hover:text-text',
        variante === 'peligro' && 'border border-border bg-surface text-alerta hover:bg-alerta-soft',
        className,
      )}
      {...p}
    />
  );
}

export function Etiqueta({ tono = 'neutro', className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tono?: 'neutro' | 'vivo' | 'estimado' | 'alerta' | 'ok' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tono === 'neutro' && 'bg-surface-2 text-muted',
        tono === 'vivo' && 'bg-accent-soft text-accent',
        tono === 'estimado' && 'bg-amarillo/25 text-text',
        tono === 'alerta' && 'bg-alerta-soft text-alerta',
        tono === 'ok' && 'bg-accent-soft text-ok',
        className,
      )}
      {...p}
    />
  );
}

/** Selector segmentado (toggle entre pocas opciones). */
export function Segmentos<T extends string>({ valor, opciones, onCambio, etiqueta }: { valor: T; opciones: { valor: T; texto: string }[]; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex max-w-full rounded-xl border border-border bg-surface-2 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={cn(
            'h-8 min-w-0 truncate rounded-[10px] px-3 text-xs font-semibold transition-colors',
            valor === o.valor ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Selector({ className, etiqueta, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string }) {
  return (
    <select
      aria-label={etiqueta}
      className={cn('h-9 max-w-full cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2', className)}
      {...p}
    />
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('esqueleto', className)} aria-hidden />;
}

/** Destellos de marca para estados vacíos. */
export function Destellos({ className }: { className?: string }) {
  const estrella = 'M12 0l1.9 8.6L22 12l-8.1 3.4L12 24l-1.9-8.6L2 12l8.1-3.4z';
  return (
    <svg viewBox="0 0 96 64" className={cn('h-16 w-24', className)} aria-hidden>
      <path d={estrella} transform="translate(30 10) scale(1.7)" fill="var(--amarillo)" />
      <path d={estrella} transform="translate(8 6) scale(0.8)" fill="var(--turquesa)" />
      <path d={estrella} transform="translate(72 34) scale(0.9)" fill="var(--primary)" opacity="0.8" />
    </svg>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Destellos />
      <p className="font-display text-lg font-extrabold">{titulo}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export interface InfoKpi {
  formula: string;
  fuente: string;
  nota?: string;
}

/** Ícono ⓘ: fórmula, fuente (pestaña + rango) y fecha de la última lectura. */
export function Informacion({ info, titulo }: { info: InfoKpi; titulo: string }) {
  const { meta } = useDatos();
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={`Cómo se calcula: ${titulo}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
        <Info className="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
          <p className="mb-2 font-display text-base font-extrabold">{titulo}</p>
          <dl className="space-y-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fórmula</dt>
              <dd>{info.formula}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fuente</dt>
              <dd className="break-words">{info.fuente}</dd>
            </div>
            {info.nota && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Nota</dt>
                <dd>{info.nota}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Última lectura</dt>
              <dd className="num">{fechaHora(meta?.lastChecked)}</dd>
            </div>
          </dl>
          <Popover.Arrow className="fill-[var(--border)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Menú ⋯ → Descargar CSV con exactamente los datos mostrados. */
export function MenuCsv({ reporte }: { reporte: Reporte }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`Opciones de ${reporte.titulo}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
        <MoreHorizontal className="h-4 w-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-xl border border-border bg-surface p-1 text-sm shadow-card">
          <Menu.Item onSelect={() => descargarCsv(reporte)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-surface-2">
            <Download className="h-4 w-4" /> Descargar CSV
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Tarjeta con encabezado (título, ⓘ, menú CSV) para gráficos y tablas. */
export function Panel({
  titulo,
  subtitulo,
  info,
  reporte,
  acciones,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  info?: InfoKpi;
  reporte?: Reporte;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tarjeta className={cn('flex min-w-0 flex-col p-4 sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-start gap-x-2 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-extrabold leading-tight">{titulo}</h3>
          {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
        </div>
        {/* En móvil los controles bajan a una fila propia para no aplastar el título. */}
        {acciones && <div className="order-last flex w-full max-w-full sm:order-none sm:w-auto">{acciones}</div>}
        <div className="flex items-center gap-1">
          {info && <Informacion info={info} titulo={titulo} />}
          {reporte && <MenuCsv reporte={reporte} />}
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Tarjeta>
  );
}

export function TituloSeccion({ children, nota }: { children: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 first:mt-0">
      <h2 className="font-display text-2xl font-extrabold">{children}</h2>
      {nota && <span className="text-sm text-muted">{nota}</span>}
    </div>
  );
}
