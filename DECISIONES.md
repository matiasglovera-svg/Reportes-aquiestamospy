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
