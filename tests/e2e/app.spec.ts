import { expect, test, type Page } from '@playwright/test';

const USUARIO = process.env.E2E_USER ?? 'matias';
const CLAVE = process.env.E2E_PASSWORD ?? 'desarrollo-local-2026';

const MODULOS = [
  { ruta: '/resumen', titulo: /Resumen de/ },
  { ruta: '/financiero', titulo: 'Financiero' },
  { ruta: '/financiero/flujo', titulo: 'Flujo de caja detallado' },
  { ruta: '/operativo', titulo: 'Operativo' },
  { ruta: '/admin/conexion', titulo: 'Conexión con OneDrive' },
  { ruta: '/admin/datos', titulo: 'Salud de datos' },
];

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(USUARIO);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('**/resumen');
}

/** Sin scroll horizontal de página y sin errores de consola. */
async function revisar(page: Page, errores: string[]) {
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde, 'scroll horizontal de página').toBeLessThanOrEqual(1);
  expect(errores, 'errores de consola').toEqual([]);
}

test('sin sesión redirige al login y una contraseña incorrecta no entra', async ({ page }) => {
  await page.goto('/financiero');
  await expect(page).toHaveURL(/\/login\?next=%2Ffinanciero/);
  await page.getByLabel('Usuario').fill(USUARIO);
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

for (const tema of ['light', 'dark'] as const) {
  test(`login y cada módulo en tema ${tema}`, async ({ page }, info) => {
    const errores: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('pageerror', (e) => errores.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('ae-tema', t), tema);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: info.outputPath(`login-${tema}.png`), fullPage: true });
    await entrar(page);

    for (const m of MODULOS) {
      await page.goto(m.ruta);
      await expect(page.getByRole('heading', { level: 2, name: m.titulo }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
      // Los gráficos terminan su animación de entrada.
      await page.waitForTimeout(1400);
      await revisar(page, errores);
      await page.screenshot({ path: info.outputPath(`${m.ruta.slice(1).replace(/\//g, '-')}-${tema}.png`), fullPage: true });
    }
  });
}

test('filtros, ⓘ, tema y exportaciones', async ({ page }) => {
  await entrar(page);

  // ⓘ: fórmula, fuente y última lectura.
  await page.getByRole('button', { name: 'Cómo se calcula: Facturación del mes' }).click();
  const info = page.getByRole('dialog');
  await expect(info).toContainText('Fórmula');
  await expect(info).toContainText('INGRESOS!');
  await expect(info).toContainText('Última lectura');
  await page.keyboard.press('Escape');

  // El cambio de tema se recuerda.
  const antes = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Cambiar a tema/ }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', antes!);
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', antes!);

  // CSV de una tarjeta: separador ";", BOM y nombre con el formato pedido.
  await page.getByRole('button', { name: 'Opciones de Resumen del mes' }).first().click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Descargar CSV' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^AquiEstamos_Resumen-del-mes_[A-Za-z]+-\d{4}_\d{8}-\d{4}\.csv$/);
  const contenido = await (await import('node:fs/promises')).readFile(await csv.path());
  expect([...contenido.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(contenido.toString('utf8')).toContain('Indicador;Valor\r\n');

  // Exportar todo: un ZIP.
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar todo en CSV' }).click()]);
  expect(zip.suggestedFilename()).toMatch(/^AquiEstamos_Reportes_.+\.zip$/);

  // Toggle A/B del margen.
  await page.goto('/resumen');
  await expect(page.getByText(/^Modo A:/)).toBeVisible();
  await page.getByRole('radio', { name: 'B · Sin sueldo fijo' }).click();
  await expect(page.getByText(/^Modo B:/)).toBeVisible();

  // Mapa de calor: vista anual.
  await page.goto('/operativo');
  await page.getByRole('radio', { name: 'Año' }).click();
  await expect(page.getByRole('columnheader', { name: 'Ene' })).toBeVisible();
});

test('el rol viewer no ve ni accede a Admin', async ({ page }, info) => {
  test.skip(!!process.env.E2E_BASE_URL && !process.env.E2E_VIEWER, 'Definí E2E_VIEWER y E2E_VIEWER_PASSWORD para probarlo en producción.');
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(process.env.E2E_VIEWER ?? 'ariel');
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.E2E_VIEWER_PASSWORD ?? CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('**/resumen');
  // En computadora Financiero es un grupo desplegable del menú lateral; en el teléfono, un botón de la barra inferior.
  await expect(info.project.name === 'movil' ? page.getByRole('link', { name: 'Financiero' }) : page.locator('aside').getByRole('button', { name: 'Financiero' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Salud/ })).toHaveCount(0);
  await page.goto('/admin/datos');
  await expect(page).toHaveURL(/\/resumen$/);
  expect((await page.request.get('/api/admin/conexion')).status()).toBe(403);
});

test('flujo de caja detallado: período, líneas de detalle, matriz y CSV', async ({ page }) => {
  await entrar(page);
  await page.goto('/financiero/flujo');
  await expect(page.getByRole('heading', { level: 2, name: 'Flujo de caja detallado' })).toBeVisible();

  // Por defecto: acumulado de meses cerrados, con seis indicadores.
  await expect(page.getByLabel('Período')).toHaveValue('acumulado');
  for (const t of ['Caja inicial', 'Ingresos totales', 'Gastos totales', 'Ganancia bruta', 'Ganancia real', 'Caja al cierre']) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('Margen bruto', { exact: true })).toBeVisible();
  await expect(page.getByText('Margen neto', { exact: true })).toBeVisible();
  await expect(page.getByText('Cómo se movió la caja')).toBeVisible();
  await expect(page.getByRole('img', { name: /Cascada del flujo de caja/ })).toBeVisible();
  await expect(page.getByText(/^Recursos Humanos fue el .+ de los ingresos\.$/)).toBeVisible();

  // ¿Dónde se fue la plata?: al tocar la categoría se ven sus líneas con el comentario.
  const categoria = page.getByRole('button', { name: /Recursos humanos/ }).first();
  await categoria.click();
  await expect(categoria).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/^GASTOS![A-Z]+\d+$/).first()).toBeVisible();

  // Mes en curso: etiqueta "En vivo · parcial".
  await page.getByLabel('Período').selectOption({ label: 'Octubre · en vivo, parcial' });
  await expect(page.getByText('En vivo · parcial').first()).toBeVisible();

  // Matriz: celda de gasto abre sus líneas; control de coherencia visible.
  await page.getByLabel('Período').selectOption('9');
  // Con teclado: en el teléfono la primera columna fija puede tapar la celda al desplazarla.
  await page.getByRole('button', { name: /Recursos humanos, Septiembre: ver líneas/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Recursos humanos · Septiembre');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('rowheader', { name: 'Caja inicial + Ganancia real = Caja al cierre' })).toBeVisible();

  // CSV de la matriz.
  await page.getByRole('button', { name: 'Opciones de Flujo de caja detallado' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Descargar CSV' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^AquiEstamos_Flujo-de-caja-detallado_2026_\d{8}-\d{4}\.csv$/);
  const texto = (await (await import('node:fs/promises')).readFile(await csv.path())).toString('utf8');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  expect(texto).toContain('Concepto;Enero;');
  expect(texto).toContain('Caja inicial + Ganancia real = Caja al cierre;');
});

test('Análisis está al final de Resumen y Financiero es un submenú desplegable', async ({ page }, info) => {
  await entrar(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Análisis' })).toBeVisible();
  await expect(page.getByText(/^Modo A:/)).toBeVisible();
  await page.goto('/resumen/analisis');
  await expect(page).toHaveURL(/\/resumen#analisis$/);
  await expect(page.getByRole('link', { name: 'Análisis' })).toHaveCount(0);

  test.skip(info.project.name === 'movil', 'El menú lateral solo existe en pantallas grandes.');
  const menu = page.locator('aside');
  const grupo = menu.getByRole('button', { name: 'Financiero' });
  await expect(grupo).toHaveAttribute('aria-expanded', 'false');
  await expect(menu.getByRole('link', { name: 'Flujo de caja' })).toHaveCount(0);
  await grupo.click();
  await expect(grupo).toHaveAttribute('aria-expanded', 'true');
  await menu.getByRole('link', { name: 'Flujo de caja' }).click();
  await expect(page).toHaveURL(/\/financiero\/flujo$/);
  await expect(menu.getByRole('link', { name: 'Resumen financiero' })).toBeVisible();
  await grupo.click();
  await expect(menu.getByRole('link', { name: 'Resumen financiero' })).toHaveCount(0);
});
