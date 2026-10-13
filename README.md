# Reportes Aquí Estamos

Aplicación web privada que muestra reportes financieros, operativos y de resumen de Aquí Estamos. Lee **en vivo** la planilla de Excel guardada en el OneDrive personal de Matías. **Nunca escribe en el Excel.**

- Producción: `https://reportes-aquiestamospy.vercel.app`
- Usuarios: Matías (administrador) y Ariel (solo reportes).

## Cómo funciona

1. Mientras alguien tiene la app abierta, el navegador pide datos cada 60 segundos.
2. El servidor consulta a OneDrive si el archivo cambió (como máximo una vez cada 55 segundos, aunque haya varias pestañas abiertas).
3. Si cambió, lo descarga, lee **solo** las pestañas de meses, `INGRESOS`, `GASTOS`, `FLUJO CAJA` y `BBDD CLIENTES`, recalcula todo y guarda el resultado.
4. Si no cambió, responde con lo que ya tenía guardado.

Los cambios del Excel aparecen cuando el archivo queda **guardado en OneDrive** (Autoguardado activado). El reflejo tarda como máximo 1 a 2 minutos.

**La verdad es el archivo en la nube.** No hay montos fijos en el código: si un valor cambia en la planilla, el reporte cambia.

Reglas principales:

- Los datos se ubican por títulos y encabezados, no por celdas fijas.
- Ingresos y gastos salen de las tablas de detalle de la derecha (columna `VALOR`). Lo escrito en comentarios no se suma.
- Promedios y totales usan solo meses cerrados. El mes en curso se muestra aparte.
- Un dato que falta se muestra como `Sin dato`, nunca como 0.
- Cada indicador tiene un ícono ⓘ con la fórmula, la fuente y la hora de la última lectura.

## Reconectar OneDrive

Si aparece el aviso amarillo "Reconectar OneDrive" (los reportes siguen mostrando los últimos datos guardados):

1. Entrar como `matias` → **Admin › Conexión**.
2. Botón **Reconectar OneDrive** e iniciar sesión con la cuenta de Microsoft donde está la planilla.
3. Al volver, la tarjeta "Cuenta de Microsoft" debe mostrar "Conectado como…".

Si falla con "No se pudo completar la conexión", lo más probable es que el secreto de Azure esté vencido (ver más abajo).

## Agregar el archivo de 2027

1. Subir a OneDrive la planilla 2027, con la misma estructura que la de 2026.
2. **Admin › Conexión** → "Agregar o cambiar la planilla de un año".
3. Escribir parte del nombre, poner el año `2027`, **Buscar en OneDrive** y elegir **Usar para 2027**.
4. En la barra superior aparece el selector de año. Por defecto se muestra el año actual.

Se guarda el identificador del archivo: si después se renombra o se mueve de carpeta, sigue funcionando.

## Editar alias de nombres y sueldos fijos

- **Alias** (por ejemplo, que `KATYA` y `KATIA` se muestren como "Kathya"): `config/aliases.ts`.
- **Sueldos fijos** (quién cobra sueldo fijo y desde qué mes): `config/staff.ts`. Ahí también están la capacidad semanal (12 unidades) y mensual (48).

Después de editar, hacer commit y push: Vercel publica solo. La tabla de alias vigente se ve en **Admin › Salud de datos**.

## Cambiar contraseñas

1. En una terminal, dentro del proyecto: `npm run hash-password`. Pide la contraseña (no se ve al escribir) y muestra el hash.
2. En Vercel → proyecto → **Settings › Environment Variables** → editar `APP_USERS` y reemplazar el `hash` del usuario por el nuevo (la versión "Para Vercel", tal cual).
3. **Deployments** → último despliegue → **Redeploy** para que tome el cambio.

Formato de `APP_USERS`:

```json
[{"user":"matias","hash":"<hash>","role":"admin"},{"user":"ariel","hash":"<hash>","role":"viewer"}]
```

Cambiar `SESSION_SECRET` cierra todas las sesiones abiertas.

## Vencimiento del secreto de Azure

El secreto de cliente (`MS_CLIENT_SECRET`) se creó con vencimiento a **24 meses**. Cuando vence, la app no puede renovar el acceso a OneDrive.

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID › Registros de aplicaciones › Reportes-AquiEstamos › Certificados y secretos**. Ahí figura la fecha de vencimiento.
2. **Nuevo secreto de cliente** → copiar la columna **Valor**.
3. En Vercel, reemplazar `MS_CLIENT_SECRET` y hacer **Redeploy**.
4. En la app: **Admin › Conexión › Reconectar OneDrive**.

Conviene agendar un recordatorio un mes antes del vencimiento.

## Variables de entorno

Están descriptas en `.env.example`. En Vercel se cargan en **Settings › Environment Variables**.

| Variable | Para qué |
|---|---|
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI` | App registrada en Azure |
| `SESSION_SECRET` | Firma de la sesión (`npm run gen-secrets`) |
| `TOKEN_ENCRYPTION_KEY` | Cifrado del acceso a Microsoft (`npm run gen-secrets`) |
| `APP_USERS` | Usuarios y contraseñas (hashes) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Las crea la integración de Upstash |
| `APP_TIMEZONE` | `America/Asuncion` |

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # tests del motor de cálculo (Vitest)
npm run e2e          # QA visual con Playwright (login, módulos, temas, 390 y 1440 px)
npm run salud        # tablas de control e informe de Salud de datos en consola
npm run typecheck
```

Para trabajar sin OneDrive, copiar una planilla a `fixtures/` y poner `DATA_SOURCE=local` en `.env.local`. Esa opción **se ignora en producción**. La carpeta `fixtures/` y cualquier `.xlsx` están excluidos del repositorio.

En `.env.local`, cada `$` del hash de `APP_USERS` se escribe como `\$` (el script `hash-password` muestra las dos formas).

### Estructura

```
app/            pantallas y rutas de API
components/     tarjetas, gráficos, tablas, mapa de calor, navegación
config/         alias, sueldos fijos, colores de gráficos
lib/engine/     lectura de la planilla y motor de cálculo (puro, sin I/O)
lib/graph/      Microsoft (MSAL) y OneDrive (Graph)
lib/cache.ts    refresco con cTag y caché en Redis
lib/reportes.ts cada reporte como tabla (pantalla y CSV salen de acá)
tests/          Vitest y Playwright
```

Decisiones y supuestos: `DECISIONES.md`. Estado del proyecto: `PROGRESO.md`.
