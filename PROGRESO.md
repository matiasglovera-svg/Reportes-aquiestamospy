# Progreso

## Fase 0 — Repo inicial ✔
- Repo git, `.gitignore` (excluye `fixtures/`, `*.xlsx`, `.env*`), `.env.example`.
- `npm run hash-password` y `npm run gen-secrets`.
- Logos en `public/brand/`.
- **Pendiente de Matías:** Azure, GitHub, Vercel, Upstash, contraseñas (ver pedido único al final).

## Fase 1 — Parser y motor de cálculo ✔
- `lib/engine/`: lectura de solo las pestañas necesarias, parsers por títulos, normalización y alias, métricas financieras y operativas, controles de Salud de datos.
- Tests (Vitest): validan la lógica recalculando por un camino independiente sobre la copia local; ningún monto fijo. La comparación con la sección 12 se imprime como informe.
- `npm run salud` imprime tablas de control e informe de Salud de datos.
- Diferencias de la copia local contra la sección 12 (el archivo cambió): gastos de marzo, ingresos de septiembre e ingresos de octubre.
