'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './ui';

const PESTANAS = [
  { href: '/financiero', texto: 'Resumen financiero' },
  { href: '/financiero/flujo', texto: 'Flujo de caja detallado' },
];

/** Pestañas del módulo Financiero (en el teléfono es la única forma de llegar al flujo de caja). */
export function PestanasFinanciero() {
  const ruta = usePathname();
  return (
    <nav aria-label="Vistas de Financiero" className="mb-4 inline-flex max-w-full rounded-xl border border-border bg-surface-2 p-0.5">
      {PESTANAS.map((p) => (
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
