import { ConfidentialClientApplication, type ICachePlugin } from '@azure/msal-node';
import { cifrar, descifrar } from '../crypto';
import { env, msConfigurado, prefijoCache } from '../env';
import { store } from '../store';

const AUTHORITY = 'https://login.microsoftonline.com/consumers';
const SCOPES = ['Files.Read', 'offline_access', 'User.Read'];
const CLAVE_CACHE = 'ms:cache';
const CLAVE_CUENTA = 'ms:cuenta';

export interface CuentaMs {
  homeAccountId: string;
  usuario: string;
  nombre: string | null;
  conectadaEl: string;
}

/** Hace falta que el admin vuelva a pasar por "Conectar OneDrive". */
export class ReconectarError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ReconectarError';
  }
}

/**
 * La caché de MSAL contiene el refresh token. Se guarda cifrada (AES-256-GCM) en Redis y se vuelve a
 * guardar cada vez que cambia: Microsoft rota el refresh token en cada renovación.
 */
const cachePlugin: ICachePlugin = {
  beforeCacheAccess: async (ctx) => {
    // La vista previa arranca desde la caché de producción pero guarda la suya: nunca escribe la de producción.
    const guardada = (prefijoCache() ? await store().get<string>(prefijoCache() + CLAVE_CACHE) : null) ?? (await store().get<string>(CLAVE_CACHE));
    if (guardada) ctx.tokenCache.deserialize(descifrar(guardada));
  },
  afterCacheAccess: async (ctx) => {
    if (ctx.cacheHasChanged) await store().set(prefijoCache() + CLAVE_CACHE, cifrar(ctx.tokenCache.serialize()));
  },
};

function cliente(): ConfidentialClientApplication {
  if (!msConfigurado()) throw new Error('Faltan MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI o TOKEN_ENCRYPTION_KEY.');
  return new ConfidentialClientApplication({
    auth: { clientId: env.msClientId(), clientSecret: env.msClientSecret(), authority: AUTHORITY },
    cache: { cachePlugin },
  });
}

export function urlDeAutorizacion(state: string): Promise<string> {
  return cliente().getAuthCodeUrl({ scopes: SCOPES, redirectUri: env.msRedirectUri(), state, prompt: 'select_account' });
}

export async function completarAutorizacion(code: string): Promise<CuentaMs> {
  const r = await cliente().acquireTokenByCode({ code, scopes: SCOPES, redirectUri: env.msRedirectUri() });
  if (!r?.account) throw new Error('Microsoft no devolvió la cuenta.');
  const cuenta: CuentaMs = {
    homeAccountId: r.account.homeAccountId,
    usuario: r.account.username,
    nombre: r.account.name ?? null,
    conectadaEl: new Date().toISOString(),
  };
  await store().set(CLAVE_CUENTA, cuenta);
  return cuenta;
}

export const cuentaConectada = () => store().get<CuentaMs>(CLAVE_CUENTA);

export async function desconectar(): Promise<void> {
  await store().del(CLAVE_CACHE, CLAVE_CUENTA);
}

/** Token de acceso vigente para Graph (MSAL lo renueva con el refresh token cuando hace falta). */
export async function tokenDeAcceso(): Promise<string> {
  const cuenta = await cuentaConectada();
  if (!cuenta) throw new ReconectarError('OneDrive no está conectado.');
  const app = cliente();
  try {
    const account = await app.getTokenCache().getAccountByHomeId(cuenta.homeAccountId);
    if (!account) throw new ReconectarError('La sesión de Microsoft ya no está guardada.');
    const r = await app.acquireTokenSilent({ account, scopes: SCOPES });
    if (!r?.accessToken) throw new ReconectarError('Microsoft no devolvió un token.');
    return r.accessToken;
  } catch (e) {
    if (e instanceof ReconectarError) throw e;
    const nombre = (e as { name?: string }).name ?? '';
    const codigo = (e as { errorCode?: string }).errorCode ?? '';
    // Sin refresh token válido (vencido, revocado o consentimiento retirado) solo se arregla reconectando.
    if (nombre === 'InteractionRequiredAuthError' || /invalid_grant|interaction_required|consent_required|login_required|no_tokens_found/.test(codigo)) {
      throw new ReconectarError('El acceso a OneDrive venció o fue revocado.');
    }
    throw e;
  }
}
