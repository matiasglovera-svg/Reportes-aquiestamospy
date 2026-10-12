import { normTexto, texto, tipoClienteDesde, tipoPrecioDesde } from './normalize';
import type { ClienteBase, Hoja } from './types';

/**
 * BBDD CLIENTES: solo se toman TIPO PRECIO y TIPO CLIENTE como respaldo de clasificación.
 * RUC, teléfono, email y dirección no se leen: nunca salen del servidor.
 */
export function parseClientes(hoja: Hoja): Map<string, ClienteBase> {
  const clientes = new Map<string, ClienteBase>();
  for (let r = 0; r < Math.min(hoja.length, 20); r++) {
    const enc = (hoja[r] ?? []).map(normTexto);
    const cCliente = enc.indexOf('CLIENTE');
    const cPrecio = enc.indexOf('TIPO PRECIO');
    const cTipo = enc.indexOf('TIPO CLIENTE');
    if (cCliente < 0 || (cPrecio < 0 && cTipo < 0)) continue;

    for (let k = r + 1; k < hoja.length; k++) {
      const nombre = texto(hoja[k]?.[cCliente]);
      if (!nombre) continue;
      const clave = normTexto(nombre);
      if (clientes.has(clave)) continue;
      clientes.set(clave, {
        tipoPrecio: (cPrecio >= 0 ? tipoPrecioDesde(hoja[k][cPrecio]) : null) ?? 'Sin clasificar',
        tipoCliente: (cTipo >= 0 ? tipoClienteDesde(hoja[k][cTipo]) : null) ?? 'Sin clasificar',
      });
    }
    break;
  }
  return clientes;
}
