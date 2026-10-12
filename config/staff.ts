/**
 * Operarias con sueldo fijo mensual. Editable.
 * `fijoDesde` = primer mes (aaaa-mm) en que cobra sueldo fijo. Usar el nombre canónico de config/aliases.ts.
 */
export const SUELDO_FIJO: Record<string, { fijoDesde: string }> = {
  Gloria: { fijoDesde: '2026-02' },
  Judith: { fijoDesde: '2026-05' },
};

/**
 * Filas de la tabla de servicios que en realidad son el pago del sueldo fijo (ej.: "PAGO GLORIA",
 * "PAGO DE SALARIO"). No se cuentan como servicio; se informan aparte en Salud de datos.
 */
export const PATRON_PAGO_SUELDO = /^PAGO\b/;

/** Capacidad en unidades ponderadas (4 h = 1) por operaria. */
export const CAPACIDAD_SEMANAL = 12;
export const CAPACIDAD_MENSUAL = 48;
