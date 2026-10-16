/** Lectura de variables de entorno del servidor. Nunca importar desde componentes de cliente. */
export const env = {
  msClientId: () => process.env.MS_CLIENT_ID ?? '',
  msClientSecret: () => process.env.MS_CLIENT_SECRET ?? '',
  msRedirectUri: () => process.env.MS_REDIRECT_URI ?? '',
  sessionSecret: () => process.env.SESSION_SECRET ?? '',
  tokenKey: () => process.env.TOKEN_ENCRYPTION_KEY ?? '',
  appUsers: () => process.env.APP_USERS ?? '',
  // La integración de Vercel puede crear las variables con cualquiera de los dos nombres.
  redisUrl: () => process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '',
  redisToken: () => process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '',
  timezone: () => process.env.APP_TIMEZONE || 'America/Asuncion',
  produccion: () => process.env.NODE_ENV === 'production',
  /** Solo desarrollo: leer la planilla de fixtures/ en vez de OneDrive. Se ignora en producción. */
  fuenteLocal: () => process.env.NODE_ENV !== 'production' && process.env.DATA_SOURCE === 'local',
  build: () => process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  /** Despliegue de vista previa de Vercel (una rama distinta de main). */
  esPreview: () => process.env.VERCEL_ENV === 'preview',
};

/**
 * La vista previa lee el mismo OneDrive y la misma configuración que producción, pero guarda su caché
 * con este prefijo para no pisar la de producción, y no puede cambiar la configuración.
 */
export const prefijoCache = () => (env.esPreview() ? 'preview:' : '');

export const msConfigurado = () => !!(env.msClientId() && env.msClientSecret() && env.msRedirectUri() && env.tokenKey());
export const redisConfigurado = () => !!(env.redisUrl() && env.redisToken());
