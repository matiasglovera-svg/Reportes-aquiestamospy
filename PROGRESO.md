# Progreso

Estado al 13/10/2026. Todo lo que no depende de cuentas externas está hecho y probado con la copia local de la planilla. Falta conectar las cuentas y publicar.

## Fase 0 — Repo inicial ✔
- Repo git, .gitignore (excluye fixtures/, *.xlsx, .env*), .env.example, scripts hash-password y gen-secrets, logos en public/brand/.
- **Pendiente de Matías:** Azure, GitHub, Vercel, Upstash y contraseñas.

## Fase 1 — Parser y motor de cálculo ✔
- lib/engine/: lectura de solo las pestañas necesarias, parsers por títulos, normalización y alias, métricas, controles de Salud de datos.
- Tests de lógica (sin montos fijos). npm run salud imprime el informe.
- Diferencias de la copia local contra la sección 12 (el archivo cambió, no es un error): gastos de marzo, ingresos de septiembre e ingresos de octubre.

## Fase 2 — Login, sesión, OneDrive, /api/data ✔ (falta probar contra Microsoft real)
- Login con bcrypt, sesión iron-session de 12 h, middleware, roles, límite de 5 intentos cada 15 min.
- OAuth con MSAL (authority consumers), token cifrado en Redis, búsqueda de archivo, itemId por año.
- /api/data con lock de 55 s, comparación de cTag, caché en memoria + Redis.
- Probado: login, roles, límite de intentos, cabeceras, cookie segura en producción, y la lógica de caché con un OneDrive simulado.
- **No probado:** el flujo OAuth y las llamadas reales a Graph. Requiere las credenciales de Azure.

## Fase 3 — Sistema de diseño y Resumen ✔
- Tokens de marca, tema claro/oscuro con preferencia recordada, Barlow / Barlow Semi Condensed, logo por tema, ondas y destellos.
- Componentes: tarjeta KPI (conteo animado, variación, sparkline, ⓘ), gráficos ECharts, tabla con primera columna fija, mapa de calor, indicador en vivo, aviso de datos actualizados.
- Módulo Resumen completo.

## Fase 4 — Financiero ✔
## Fase 5 — Operativo ✔
## Fase 6 — Resumen › Análisis ✔
- Toggle A/B de margen, proyección al cierre, comparaciones, rankings, punto de equilibrio.

## Fase 7 — CSV, Salud de datos, QA ✔ · Deploy pendiente
- CSV por tarjeta/tabla/gráfico y "Exportar todo" en ZIP.
- /admin/datos con avisos agrupados, pestaña y fila.
- QA Playwright: 10 pruebas en verde (login, cada módulo, ambos temas, 390 px y 1440 px, sin scroll horizontal ni errores de consola, exportaciones, roles).
- Tests unitarios: 45 en verde. Build de producción correcto.
- README.md entregado.
- **Pendiente:** publicar en Vercel y conectar OneDrive (depende de Matías).

## Pendientes
1. Matías: cuentas y credenciales (pedido único en el chat).
2. Con las credenciales: probar OAuth y Graph de punta a punta, publicar, correr el QA contra producción.
3. Revisar en la planilla real los avisos de Salud de datos (control de RR. HH. de septiembre, montos en comentarios de marzo).

## Sección 17 — Flujo de caja detallado (en rama `feature/flujo-caja-detallado`)
- Motor: líneas de detalle de INGRESOS y GASTOS con su comentario en el dataset; `lib/engine/metrics-flujo.ts` (períodos, comparación, cascada, matriz, lectura automática); control de coherencia de caja en Salud de datos.
- Vista `/financiero/flujo`: 6 indicadores con variación, cascada (horizontal en el teléfono), lectura automática, "¿Dónde se fue la plata?" con las líneas reales, matriz estilo Excel con ✓/⚠, CSV de matriz, distribución y líneas (también en Exportar todo).
- Vista previa aislada: caché con prefijo `preview:` y configuración en solo lectura.
- Tests: 53 unitarios en verde; Playwright: 12 pruebas en verde (incluye la vista nueva en ambos temas, 390 y 1440 px). Hubo un fallo intermitente en la primera carga del servidor de desarrollo que no se repitió.
- OK de Matías el 16/10/2026, con dos ajustes: Análisis al final de Resumen y Financiero como submenú desplegable.
- Merge a main y publicado en producción el 16/10/2026; rama borrada. Verificado en producción: login, protección de rutas y API. La revisión visual con datos la hace Matías.

## Sección 18 — Rendimiento por operaria (en rama `feature/rendimiento-operaria`)
- Motor: `lib/engine/metrics-rendimiento.ts` (unidades, ocupación, salario con reglas de sueldo fijo, ingreso, diferencia, período anterior); aviso nuevo de montos K en filas de sueldo fijo.
- Pantalla `/operativo/rendimiento`: gráfico de dinero generado, 3 tarjetas con variación, tabla ordenable con ⓘ por columna y fila TOTAL, tarjetas en el teléfono, CSV con filtros.
- Operativo como submenú desplegable, igual que Financiero.
- Tests: 64 unitarios en verde; Playwright: 15 en verde.
- OK de Matías el 26/10/2026. Merge a main y publicado en producción; rama borrada. Verificado en producción: login, protección de rutas y API. La revisión visual con datos la hace Matías.
