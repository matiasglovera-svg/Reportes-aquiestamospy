'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './ui';

/** Pestañas de un módulo (en el teléfono son la forma de llegar a las subpantallas). */
function Pestanas({ etiqueta, items }: { etiqueta: string; items: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label={etiqueta} className="mb-4 inline-flex max-w-full rounded-xl border border-border bg-surface-2 p-0.5">
      {items.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={ruta === p.href ? 'page' : undefined}
          className={cn('h-9 min-w-0 truncate rounded-[10px] px-3 text-sm font-semibold leading-9 transition-colors', ruta === p.href ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}

export function PestanasFinanciero() {
  return (
    <Pestanas
      etiqueta="Vistas de Financiero"
      items={[
        { href: '/financiero', texto: 'Resumen financiero' },
        { href: '/financiero/flujo', texto: 'Flujo de caja detallado' },
      ]}
    />
  );
}

export function PestanasOperativo() {
  return (
    <Pestanas
      etiqueta="Vistas de Operativo"
      items={[
        { href: '/operativo', texto: 'Resumen operativo' },
        { href: '/operativo/rendimiento', texto: 'Rendimiento por operaria' },
      ]}
    />
  );
}
