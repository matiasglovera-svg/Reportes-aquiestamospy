import { Ratelimit } from '@upstash/ratelimit';
import { prefijoCache } from './env';
import { redis } from './store';

const INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

const memoria = new Map<string, { n: number; hasta: number }>();
let upstash: Ratelimit | null | undefined;

function limitador(): Ratelimit | null {
  if (upstash === undefined) {
    const r = redis();
    upstash = r ? new Ratelimit({ redis: r, limiter: Ratelimit.fixedWindow(INTENTOS, '15 m'), prefix: `${prefijoCache()}rl:login` }) : null;
  }
  return upstash;
}

/** 5 intentos de login cada 15 minutos por IP + usuario. */
export async function intentoPermitido(id: string): Promise<{ ok: boolean; reintentarEn: number }> {
  const rl = limitador();
  if (rl) {
    const r = await rl.limit(id);
    return { ok: r.success, reintentarEn: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)) };
  }
  const ahora = Date.now();
  const e = memoria.get(id);
  if (!e || e.hasta < ahora) {
    memoria.set(id, { n: 1, hasta: ahora + VENTANA_MS });
    return { ok: true, reintentarEn: 0 };
  }
  e.n++;
  return { ok: e.n <= INTENTOS, reintentarEn: Math.ceil((e.hasta - ahora) / 1000) };
}

/** Un login correcto no debe consumir el cupo de intentos. */
export async function limpiarIntentos(id: string): Promise<void> {
  memoria.delete(id);
  await limitador()
    ?.resetUsedTokens(id)
    .catch(() => undefined);
}
