import { Redis } from '@upstash/redis';
import { env, redisConfigurado } from './env';

/** Almacenamiento clave-valor: Upstash Redis, o memoria del proceso si no está configurado (solo sirve para desarrollo). */
export interface Store {
  get<T>(clave: string): Promise<T | null>;
  set(clave: string, valor: unknown, ttlSegundos?: number): Promise<void>;
  del(...claves: string[]): Promise<void>;
  /** Guarda solo si la clave no existe. Devuelve true si la guardó (sirve de lock). */
  setNx(clave: string, valor: unknown, ttlSegundos: number): Promise<boolean>;
}

function crearRedis(): Store {
  const r = new Redis({ url: env.redisUrl(), token: env.redisToken() });
  return {
    get: <T>(k: string) => r.get<T>(k),
    set: async (k, v, ttl) => {
      await (ttl ? r.set(k, v, { ex: ttl }) : r.set(k, v));
    },
    del: async (...ks) => {
      if (ks.length) await r.del(...ks);
    },
    setNx: async (k, v, ttl) => (await r.set(k, v, { nx: true, ex: ttl })) === 'OK',
  };
}

function crearMemoria(): Store {
  const datos = new Map<string, { v: unknown; exp: number }>();
  const vivo = (k: string) => {
    const e = datos.get(k);
    if (e && e.exp && e.exp < Date.now()) datos.delete(k);
    return datos.get(k);
  };
  return {
    get: async <T>(k: string) => (vivo(k)?.v as T | undefined) ?? null,
    set: async (k, v, ttl) => void datos.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }),
    del: async (...ks) => ks.forEach((k) => datos.delete(k)),
    setNx: async (k, v, ttl) => {
      if (vivo(k)) return false;
      datos.set(k, { v, exp: Date.now() + ttl * 1000 });
      return true;
    },
  };
}

const g = globalThis as unknown as { __aeStore?: Store };

export function store(): Store {
  return (g.__aeStore ??= redisConfigurado() ? crearRedis() : crearMemoria());
}

export function redis(): Redis | null {
  return redisConfigurado() ? new Redis({ url: env.redisUrl(), token: env.redisToken() }) : null;
}
