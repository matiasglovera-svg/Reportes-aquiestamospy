# Decisiones

Supuestos y criterios tomados sin consultar (sección 16.2). Si alguno no va, se cambia en el lugar indicado.

## Datos

1. **La verdad es el archivo en la nube.** No hay montos, meses ni excepciones fijas en el código ni en los tests. La copia de `fixtures/` solo sirve para validar la lógica.
2. **Pestañas ocultas de meses: se leen.** En la planilla, enero–agosto (menos abril) están ocultas; si se ignoraran no habría histórico. Se ignoran todas las demás pestañas, ocultas o no.
3. **Filas de pago de sueldo** (`PAGO GLORIA`, `PAGO DE SALARIO`: cliente que empieza con "PAGO", sin precio ni horas): no son servicios. No cuentan en cantidades ni en pago por servicio; se listan en Salud de datos. Patrón editable en `config/staff.ts`.
4. **Cliente en blanco con fecha y operaria** (ej. febrero fila 26): es un servicio, cliente "Sin nombre", con aviso.
5. **Caja chica en vivo** = celda numérica 2 filas debajo del título `CAJA CHICA INICIAL MES` (como indica la sección 5.1). En la planilla esa celda es la caja al cierre proyectada; la de al lado del título es la caja inicial.
6. **Sueldo fijo sin total cargado en el panel** (típico del mes en curso): se muestra `Sin dato`, no 0.
7. **RR. HH. sin ninguna fila con valor** en el detalle de GASTOS: `Sin dato`. Un 0 escrito en la planilla sí es 0.
8. **Horas:** cualquier número positivo vale (ej. 3 h = 0,75 unidades). Sin horas ni horario: el servicio cuenta en cantidades y aporta 0 a horas y unidades, con aviso.
9. **K vacío:** el pago del servicio es I + J si alguno está cargado; si no, `Sin dato`.
10. **Encabezado no encontrado** (enero–marzo titulan la columna E como `FRECUENCIA` en las semanas 2–4): se usa la letra de columna de la sección 5.1 y se informa.
11. **Nombres:** "Maria" y "Maria del Carmen" son personas distintas; "Olga" y "Olga Nueva" también. Los nombres no listados en el prompt (Tranquilina, Cinthia, Shirley, Yenny, Gabriela, Doris, Pabla, Mirian, Liz, Marlene, Patricia) se agregaron como conocidos en `config/aliases.ts`. La unificación automática (Levenshtein ≤ 1) solo se hace contra nombres configurados.
12. **Control de RR. HH.:** Σ K de operarias por servicio + Total del panel de las de sueldo fijo, contra RECURSOS HUMANOS de GASTOS. Los K que la planilla trae en filas de operarias de sueldo fijo no se suman (ya están en su sueldo).
13. **Montos numéricos en la columna de comentarios de GASTOS con VALOR vacío:** no se suman (regla 5.3) y generan un aviso genérico, para cualquier mes.

## Técnicas

14. **SheetJS 0.20.3 desde el CDN oficial** (la versión de npm está desactualizada y con vulnerabilidades conocidas).
15. **Fechas de Excel** convertidas por aritmética del número de serie, sin depender de la zona horaria del servidor.

## Resumen y Análisis

16. **Pendientes (por cobrar / por pagar):** se calculan sobre los servicios realizados del mes elegido, no de todo el año.
17. **Proyección por semana:** un bloque se muestra como "estimado" (línea punteada) si todavía tiene servicios agendados o no tiene ninguno cargado.
18. **Margen por tipo de precio:** entra solo lo realizado y con precio. En modo A, si el sueldo fijo del mes todavía no está cargado, los servicios de esa operaria quedan fuera (no se inventa un costo) y se informa cuántos.
19. **Días hábiles:** lunes a sábado; "transcurridos" incluye el día de hoy. No se descuentan feriados.
20. **Sueldos fijos para proyección y punto de equilibrio:** los del último mes cerrado que los tenga cargados en el panel.
21. **Punto de equilibrio:** ticket promedio = promedio de los tickets mensuales de meses cerrados; pago promedio = Σ K ÷ servicios realizados de operarias por servicio en meses cerrados.
22. **Comparación al día X:** en ambos meses se cuentan solo servicios con fecha hasta el día X. La proyección al cierre se muestra solo para el mes en curso.
23. **Ranking de operarias por margen:** una operaria de sueldo fijo sin total cargado en algún mes del período no figura (su margen sería "Sin dato").
24. **Horas por operaria en el mes en curso:** no se muestra variación contra el mes anterior, porque compararía un mes incompleto con uno completo.

## Diseño

25. **Colores de gráficos:** los colores de marca exactos se usan en la interfaz y en el mapa de calor. Para las series de los gráficos se usan pasos de esos mismos tonos (royal, turquesa, amarillo, durazno, azul), ajustados con un validador para que se distingan entre sí también con daltonismo, sobre fondo claro y oscuro. Están en config/theme.ts.
26. **Un solo eje por gráfico.** "Servicios por mes" muestra realizados y unidades ponderadas en el mismo eje (son magnitudes comparables).
27. **Gastos por categoría:** el gráfico apila RR. HH. y las tres categorías de mayor peso del año; el resto se agrupa en "Resto". El CSV trae todas las categorías.
28. **Mapa de calor en HTML** (no ECharts): permite primera columna fija y detalle al tocar en el teléfono.
29. **Componentes estilo shadcn/ui escritos a mano** sobre Radix (popover y menú), sin usar su instalador.
30. **Selector de período:** un selector de mes en la barra superior, más conmutadores "mes / acumulado" en los rankings. No hay selector de rango libre de fechas.
31. **Nota fija sobre marzo eliminada** (sección 16.1). Cualquier monto en la columna de comentarios de GASTOS se informa en Salud de datos, para el mes que sea.

## Seguridad y servidor

32. **Token de Microsoft:** se guarda cifrada (AES-256-GCM) la caché completa de MSAL, que contiene el refresh token, y se vuelve a guardar cada vez que MSAL la modifica (rotación).
33. **Callback de OAuth:** es pública para el middleware, pero solo se acepta con sesión de administrador y con el mismo "state" generado al iniciar.
34. **Peticiones que modifican estado:** exigen que el encabezado Origin coincida con el host de la app.
35. **CSP:** permite scripts y estilos en línea del propio sitio (los inyecta Next); el resto solo desde el mismo origen.
36. **Dataset en Redis:** comprimido con gzip y partido en trozos de 800 KB si hiciera falta (en vez de claves por mes).
37. **El cliente no vuelve a descargar el dataset si no cambió:** envía la versión que tiene y el servidor responde "sin cambios".
38. **Avisos de Salud de datos:** solo se envían al administrador. Al viewer el error de OneDrive le llega sin detalle técnico.
39. **Next.js 15** (cumple "14+"), porque Next 16 reemplaza middleware.ts por otro mecanismo.
40. **Modo local** (DATA_SOURCE=local, lee fixtures/): solo para desarrollo y QA; en producción se ignora.

## No implementado

41. **Adaptador de CONSOLIDADO VENTAS_:** era opcional y desactivado; no se implementó.
42. **Comparación contra el conteo de servicios del panel** (el "±1 servicio" de la sección 12): no se ubicó con certeza esa celda en el panel; queda pendiente.
