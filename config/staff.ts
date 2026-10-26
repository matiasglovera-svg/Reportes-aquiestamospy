/**
 * Operarias con sueldo fijo mensual. Editable.
 * `fijoDesde` = primer mes (aaaa-mm) en que cobra sueldo fijo. Usar el nombre canónico de config/aliases.ts.
 * `respaldo` = sueldo mensual (salario + movilidad/bono) que se usa SOLO si el panel
 * PERSONAL DE LIMPIEZA (COMISION) de la planilla no trae el dato. La fuente es siempre la planilla.
 */
export const SUELDO_FIJO: Record<string, { fijoDesde: string; respaldo?: number }> = {
  Gloria: { fijoDesde: '2026-02', respaldo: 3_344_000 },
  Judith: { fijoDesde: '2026-05', respaldo: 3_044_000 },
};

/**
 * Filas de la tabla de servicios que en realidad son el pago del sueldo fijo (ej.: "PAGO GLORIA",
 * "PAGO DE SALARIO"). No se cuentan como servicio; se informan aparte en Salud de datos.
 */
export const PATRON_PAGO_SUELDO = /^PAGO\b/;

/** Capacidad en unidades ponderadas (4 h = 1) por operaria. */
export const CAPACIDAD_SEMANAL = 12;
export const CAPACIDAD_MENSUAL = 48;
