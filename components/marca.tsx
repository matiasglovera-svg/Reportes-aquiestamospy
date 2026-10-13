/* eslint-disable @next/next/no-img-element */
import { cn } from './ui';

/**
 * Logo de marca: versión color en tema claro y versión crema en oscuro.
 * El padding reserva la zona de protección (≈ alto de la estrella).
 */
export function Logo({ className, alto = 44 }: { className?: string; alto?: number }) {
  const zona = Math.round(alto * 0.18);
  return (
    <span className={cn('inline-block', className)} style={{ padding: zona }}>
      <img src="/brand/logo-color.png" alt="Aquí Estamos" style={{ height: alto }} className="block w-auto dark:hidden" />
      <img src="/brand/logo-claro.png" alt="Aquí Estamos" style={{ height: alto }} className="hidden w-auto dark:block" />
    </span>
  );
}

/** Ondas turquesa + royal del universo gráfico de la marca. */
export function Ondas({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M0 192l60-16c60-16 180-48 300-42.700C480 139 600 181 720 197.300 840 213 960 203 1080 176c120-27 240-69 300-90.700l60-21.300V320H0z" fill="var(--turquesa)" opacity="0.55" />
      <path d="M0 256l60-10.700C120 235 240 213 360 213.300 480 213 600 235 720 245.300 840 256 960 256 1080 234.700 1200 213 1320 171 1380 149.300l60-21.300V320H0z" fill="var(--royal)" opacity="0.85" />
    </svg>
  );
}
