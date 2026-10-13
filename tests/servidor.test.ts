import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aCsv, nombreCsv, type Reporte } from '../lib/csv';
import { gs, gsCorto, pct } from '../lib/format';

const fixture = existsSync('fixtures') ? readdirSync('fixtures').find((f) => f.endsWith('.xlsx')) : undefined;

// OneDrive simulado: un archivo cuyo cTag y contenido controla cada test.
const drive = { cTag: 'v1', descargas: 0, consultas: 0, fallar: null as Error | null };
vi.mock('../lib/graph/drive', () => ({
  metadatos: async () => {
    drive.consultas++;
    if (drive.fallar) throw drive.fallar;
    return { id: 'item-1', name: 'PLANILLA.xlsx', cTag: drive.cTag, lastModifiedDateTime: '2026-10-12T22:00:00Z' };
  },
  descargar: async () => {
    drive.descargas++;
    return new Uint8Array(readFileSync(join('fixtures', fixture!)));
  },
}));

describe.skipIf(!fixture)('caché de datos con cTag', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    Object.assign(drive, { cTag: 'v1', descargas: 0, consultas: 0, fallar: null });
    delete (globalThis as { __aeStore?: unknown }).__aeStore;
    delete process.env.DATA_SOURCE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
  });

  const preparar = async () => {
    const { guardarArchivo } = await import('../lib/files');
    await guardarArchivo({ anio: 2026, itemId: 'item-1', nombre: 'PLANILLA.xlsx' });
    return (await import('../lib/cache')).obtenerDatos;
  };

  it('sin archivo configurado no hay dataset ni error', async () => {
    const { obtenerDatos } = await import('../lib/cache');
    const r = await obtenerDatos();
    expect(r.dataset).toBeNull();
    expect(r.meta).toMatchObject({ fuente: 'ninguna', anios: [], error: null });
  });

  it('descarga y calcula la primera vez; dentro de los 55 s no vuelve a consultar OneDrive', async () => {
    const obtenerDatos = await preparar();
    const a = await obtenerDatos(2026);
    expect(a.dataset?.servicios.length).toBeGreaterThan(0);
    expect(a.meta).toMatchObject({ fuente: 'onedrive', version: 'v1', anio: 2026, error: null });
    await obtenerDatos(2026);
    await obtenerDatos(2026);
    expect(drive).toMatchObject({ consultas: 1, descargas: 1 });
  });

  it('si el cTag no cambió no se descarga de nuevo; si cambió, sí', async () => {
    const obtenerDatos = await preparar();
    await obtenerDatos(2026);
    await obtenerDatos(2026, { forzar: true });
    expect(drive).toMatchObject({ consultas: 2, descargas: 1 });
    drive.cTag = 'v2';
    const r = await obtenerDatos(2026, { forzar: true });
    expect(drive).toMatchObject({ consultas: 3, descargas: 2 });
    expect(r.meta.version).toBe('v2');
  });

  it('si OneDrive falla se siguen sirviendo los últimos datos, con el error a la vista', async () => {
    const obtenerDatos = await preparar();
    const ok = await obtenerDatos(2026);
    drive.fallar = new Error('Microsoft Graph respondió 503 (serviceNotAvailable).');
    const r = await obtenerDatos(2026, { forzar: true });
    expect(r.dataset?.servicios.length).toBe(ok.dataset!.servicios.length);
    expect(r.meta.error).toContain('503');
    expect(r.meta.reconectar).toBe(false);
    expect(r.meta.lastChecked).toBe(ok.meta.lastChecked);
    drive.fallar = null;
    expect((await obtenerDatos(2026, { forzar: true })).meta.error).toBeNull();
  });

  it('un token vencido pide reconectar', async () => {
    const obtenerDatos = await preparar();
    await obtenerDatos(2026);
    const { ReconectarError } = await import('../lib/graph/msal');
    drive.fallar = new ReconectarError('El acceso a OneDrive venció o fue revocado.');
    const r = await obtenerDatos(2026, { forzar: true });
    expect(r.meta.reconectar).toBe(true);
    expect(r.dataset).not.toBeNull();
  });

  it('otra instancia sin memoria recupera el dataset del almacenamiento', async () => {
    const obtenerDatos = await preparar();
    const a = await obtenerDatos(2026);
    const almacen = (globalThis as { __aeStore?: unknown }).__aeStore;
    vi.resetModules();
    (globalThis as { __aeStore?: unknown }).__aeStore = almacen;
    const { obtenerDatos: enOtraInstancia } = await import('../lib/cache');
    const b = await enOtraInstancia(2026);
    expect(b.dataset?.financiero.ingresos.total).toBe(a.dataset!.financiero.ingresos.total);
    expect(drive.descargas).toBe(1);
  });
});

describe('cifrado del token', () => {
  it('ida y vuelta, y rechaza un texto alterado', async () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const { cifrar, descifrar } = await import('../lib/crypto');
    const c = cifrar('{"RefreshToken":{"secreto":"abc"}}');
    expect(c).not.toContain('secreto');
    expect(descifrar(c)).toBe('{"RefreshToken":{"secreto":"abc"}}');
    expect(cifrar('x')).not.toBe(cifrar('x'));
    const alterado = Buffer.from(c, 'base64');
    alterado[alterado.length - 1] ^= 1;
    expect(() => descifrar(alterado.toString('base64'))).toThrow();
  });
});

describe('formato y CSV', () => {
  it('guaraníes, porcentajes y abreviados', () => {
    expect(gs(14824000)).toBe('Gs. 14.824.000');
    expect(gs(-420581)).toBe('−Gs. 420.581');
    expect(gs(null)).toBe('Sin dato');
    expect(pct(0.2074)).toBe('20,7 %');
    expect(pct(-1.255)).toBe('−125,5 %');
    expect(gsCorto(14824000)).toBe('14,8 M');
    expect(gsCorto(850000)).toBe('850 mil');
  });

  it('CSV para Excel en español', () => {
    const r: Reporte = {
      id: 'x',
      titulo: 'Financiero por mes',
      periodo: 'Octubre-2026',
      columnas: [
        { titulo: 'Mes', tipo: 'texto' },
        { titulo: 'Ingresos', tipo: 'gs' },
        { titulo: 'Rentabilidad', tipo: 'pct' },
        { titulo: 'Unidades', tipo: 'num' },
        { titulo: 'Fecha', tipo: 'fecha' },
      ],
      filas: [
        ['Enero; "prueba"', 12806000, -0.0328, 132.5, '2026-01-31'],
        ['=SUMA(A1)', null, null, null, null],
      ],
    };
    const csv = aCsv(r);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')).toEqual(['Mes;Ingresos;Rentabilidad (%);Unidades;Fecha', '"Enero; ""prueba""";12806000;-3,28;132,5;31/01/2026', "'=SUMA(A1);;;;", '']);
    expect(nombreCsv(r, '20261012-1907')).toBe('AquiEstamos_Financiero-por-mes_Octubre-2026_20261012-1907.csv');
  });
});
