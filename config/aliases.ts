/**
 * Alias de nombres. Editable.
 * Clave = nombre canónico (así se muestra). Valor = variantes tal como aparecen en la planilla.
 * La comparación ignora mayúsculas, tildes y espacios de más.
 */
export const ALIAS_OPERARIAS: Record<string, string[]> = {
  Kathya: ['KATHYA', 'KATYA', 'KATIA'],
  Leidy: ['LEIDY', 'LEIDI'],
  Daisy: ['DAISY', 'DEISY', 'DEYSI'],
  Alva: ['ALVA', 'ALBA'],
  Olga: ['OLGA'],
  // Persona distinta de Olga salvo que Matías indique lo contrario.
  'Olga Nueva': ['OLGA NUEVA'],
  Maria: ['MARIA'],
  // Persona distinta de Maria.
  'Maria del Carmen': ['MARIA DEL CARMEN'],
};

/** Operarias conocidas sin variantes. Un nombre que no esté acá ni arriba se informa como "nombre nuevo". */
export const OPERARIAS_CONOCIDAS: string[] = [
  'Gloria',
  'Judith',
  'Mirta',
  'Adelina',
  'Clara',
  'Ramona',
  'Dahiana',
  'Blanca',
  'Gessenia',
  'Jonathan',
  'Arnaldo',
  'Hugo',
  'Ignacia',
  'Wilfrida',
  'Tranquilina',
  'Cinthia',
  'Shirley',
  'Yenny',
  'Gabriela',
  'Doris',
  'Pabla',
  'Mirian',
  'Liz',
  'Marlene',
  'Patricia',
];

/** Alias de clientes (mismo formato). Vacío por defecto: los clientes solo se normalizan. */
export const ALIAS_CLIENTES: Record<string, string[]> = {};
